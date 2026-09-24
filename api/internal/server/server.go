package server

import (
	"encoding/json"
	"html/template"
	"log"
	"net/http"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/archangelgt/helpdesk/api/internal/config"
	"github.com/archangelgt/helpdesk/api/internal/i18n"
	"github.com/archangelgt/helpdesk/api/internal/pb"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

type Server struct {
	cfg  config.Config
	pb   *pb.Client
	log  *log.Logger
	tmpl *template.Template
}

var statuses = []string{"abierto", "pendiente", "en_proceso", "resuelto", "cerrado"}
var priorities = []string{"critica", "alta", "media", "baja"}
var ticketTypes = []string{"implementacion", "soporte"}
var stageStates = []string{"pendiente", "en_curso", "hecha", "pausada"}

type boardColumn struct {
	Key     string
	Label   string
	Tickets []boardCard
}

type boardCard struct {
	Ticket       pb.Ticket
	CategoryName string
	NextStatuses []string
	Progress     TicketProgress
}

func New(cfg config.Config, client *pb.Client, logger *log.Logger) *Server {
	funcs := template.FuncMap{
		"labelStatus":   func(code string) string { return i18n.T(i18n.ES, "status."+code) },
		"labelPriority": func(code string) string { return i18n.T(i18n.ES, "priority."+code) },
		"labelType":     func(code string) string { return i18n.T(i18n.ES, "type."+code) },
		"labelVis":      func(code string) string { return i18n.T(i18n.ES, "vis."+code) },
		"labelStage":    func(code string) string { return i18n.T(i18n.ES, "stage."+code) },
		"selected": func(a, b string) template.HTMLAttr {
			if a == b {
				return "selected"
			}
			return ""
		},
		"statusClass":   statusClass,
		"priorityClass": priorityClass,
		"stageClass":    stageClass,
		"activeNav": func(cur, want string) string {
			if cur == want {
				return "is-active"
			}
			return ""
		},
		"call": func(fn func(string) string, key string) string {
			if fn == nil {
				return key
			}
			return fn(key)
		},
	}
	tmpl := template.Must(template.New("root").Funcs(funcs).ParseGlob(filepath.Join(cfg.WebDir, "templates", "*.html")))
	return &Server{cfg: cfg, pb: client, log: logger, tmpl: tmpl}
}

func (s *Server) Routes() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(s.withPrefs)

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	r.Get("/login", s.handleLoginPage)
	r.Post("/login", s.handleLoginForm)
	r.Get("/register", s.handleRegisterPage)
	r.Post("/register", s.handleRegisterForm)
	r.Post("/logout", s.handleLogout)
	r.Get("/prefs", s.handlePrefsPage)
	r.Post("/prefs", s.handlePrefsForm)

	r.Route("/portal", func(pr chi.Router) {
		pr.Use(s.requireAuth("cliente", "maestro"))
		pr.Get("/", s.handlePortal)
		pr.Get("/tickets/{id}", s.handlePortalTicket)
		pr.Post("/tickets/{id}/comments", s.handlePortalComment)
	})

	r.Route("/api/v1/ingest", func(api chi.Router) {
		api.Use(s.requireAPIKey)
		api.Post("/tickets", s.ingestCreateTicket)
		api.Get("/tickets/{id}", s.ingestGetTicket)
		api.Post("/tickets/{id}/comments", s.ingestAddComment)
	})

	r.Group(func(staff chi.Router) {
		staff.Use(s.requireAuth("maestro"))

		staff.Get("/", s.handleBoard)
		staff.Get("/board", s.handleBoard)
		staff.Get("/categories", s.handleCategoriesPage)
		staff.Post("/categories", s.handleCreateCategoryForm)
		staff.Get("/tenants", s.handleTenantsPage)
		staff.Post("/tenants", s.handleCreateTenantForm)
		staff.Post("/tenants/update", s.handleUpdateTenantForm)

		staff.Get("/templates", s.handleTemplatesPage)
		staff.Post("/templates", s.handleCreateTemplateForm)
		staff.Get("/templates/{id}", s.handleTemplateDetail)
		staff.Post("/templates/{id}/update", s.handleUpdateTemplateForm)
		staff.Post("/templates/{id}/stages", s.handleAddTemplateStage)
		staff.Post("/templates/{id}/stages/{stageID}/delete", s.handleDeleteTemplateStage)

		staff.Get("/tickets", s.handleTicketsPage)
		staff.Get("/tickets/new", s.handleNewTicketPage)
		staff.Post("/tickets", s.handleCreateTicketForm)
		staff.Get("/tickets/{id}", s.handleTicketDetail)
		staff.Post("/tickets/{id}/update", s.handleTicketUpdate)
		staff.Post("/tickets/{id}/status", s.handleTicketStatus)
		staff.Post("/tickets/{id}/comments", s.handleAddComment)
		staff.Post("/tickets/{id}/attachments", s.handleUploadTicketAttachment)
		staff.Get("/tickets/{id}/attachments/{attID}/file", s.handleDownloadAttachment)
		staff.Post("/tickets/{id}/stages", s.handleAddStage)
		staff.Post("/tickets/{id}/stages/{stageID}", s.handleUpdateStage)
		staff.Post("/tickets/{id}/stages/{stageID}/estado", s.handleStageEstado)
		staff.Post("/tickets/{id}/stages/{stageID}/complete", s.handleCompleteStage)

		staff.Route("/api", func(api chi.Router) {
			api.Get("/categories", s.apiListCategories)
			api.Post("/categories", s.apiCreateCategory)
			api.Get("/tickets", s.apiListTickets)
			api.Post("/tickets", s.apiCreateTicket)
			api.Get("/tickets/{id}", s.apiGetTicket)
			api.Patch("/tickets/{id}", s.apiPatchTicket)
			api.Post("/tickets/{id}/comments", s.apiAddComment)
			api.Get("/tickets/{id}/comments", s.apiListComments)
			api.Get("/tickets/{id}/stages", s.apiListStages)
			api.Post("/tickets/{id}/stages", s.apiAddStage)
		})
	})

	return r
}

func (s *Server) handleBoard(w http.ResponseWriter, r *http.Request) {
	group := r.URL.Query().Get("group")
	if group == "" {
		group = "lane"
	}
	f := pb.TicketFilters{
		Type:       r.URL.Query().Get("type"),
		CategoryID: r.URL.Query().Get("category"),
		Q:          r.URL.Query().Get("q"),
		Priority:   r.URL.Query().Get("priority"),
		Status:     r.URL.Query().Get("status"),
		TenantID:   r.URL.Query().Get("tenant"),
	}
	// Board already groups by status/priority — clear the same axis filter to show all columns.
	if group == "status" {
		f.Status = ""
	}
	if group == "priority" {
		f.Priority = ""
	}
	cats, _ := s.pb.ListCategories(r.Context())
	tenants, _ := s.pb.ListTenants(r.Context())
	tickets, err := s.pb.ListTickets(r.Context(), f)
	catNames := map[string]string{}
	for _, c := range cats {
		catNames[c.ID] = c.Name
	}
	progressByTicket := map[string]TicketProgress{}
	for _, tk := range tickets {
		stages, _ := s.pb.ListStages(r.Context(), tk.ID)
		progressByTicket[tk.ID] = computeProgress(stages)
	}
	columns := buildBoardColumns(group, tickets, catNames, progressByTicket)
	errMsg := ""
	if err != nil {
		errMsg = err.Error()
	}
	s.render(w, "board.html", s.pageBase(r, map[string]any{
		"Title":      "Tablero",
		"Nav":        "board",
		"Group":      group,
		"Columns":    columns,
		"Categories": cats,
		"Tenants":    tenants,
		"Filters":    f,
		"Types":      ticketTypes,
		"Priorities": priorities,
		"Statuses":   statuses,
		"Flash":      r.URL.Query().Get("ok"),
		"Error":      errMsg,
	}))
}

func buildBoardColumns(group string, tickets []pb.Ticket, catNames map[string]string, progressByTicket map[string]TicketProgress) []boardColumn {
	keys := []string{"atrasados", "activos", "terminados"}
	if group == "priority" {
		keys = priorities
	}
	buckets := map[string][]boardCard{}
	for _, k := range keys {
		buckets[k] = nil
	}
	for _, t := range tickets {
		prog := progressByTicket[t.ID]
		key := boardLane(t, prog)
		if group == "priority" {
			key = t.Priority
		}
		if key == "" {
			continue // terminados ocultos por antigüedad
		}
		if _, ok := buckets[key]; !ok {
			continue
		}
		name := catNames[t.Category]
		if name == "" {
			name = t.Category
		}
		buckets[key] = append(buckets[key], boardCard{
			Ticket:       t,
			CategoryName: name,
			NextStatuses: nextStatuses(t.Status),
			Progress:     prog,
		})
	}
	out := make([]boardColumn, 0, len(keys))
	for _, k := range keys {
		out = append(out, boardColumn{Key: k, Label: k, Tickets: buckets[k]})
	}
	return out
}

func nextStatuses(current string) []string {
	out := make([]string, 0, len(statuses)-1)
	for _, st := range statuses {
		if st != current {
			out = append(out, st)
		}
	}
	return out
}

func (s *Server) handleHome(w http.ResponseWriter, r *http.Request) {
	http.Redirect(w, r, "/board", http.StatusSeeOther)
}

func (s *Server) handleCategoriesPage(w http.ResponseWriter, r *http.Request) {
	cats, err := s.pb.ListCategories(r.Context())
	errMsg := ""
	if err != nil {
		errMsg = err.Error()
	}
	s.render(w, "categories.html", s.pageBase(r, map[string]any{
		"Title":      "Categorías",
		"Nav":        "categories",
		"Categories": cats,
		"Error":      errMsg,
		"Flash":      r.URL.Query().Get("ok"),
	}))
}

func (s *Server) handleCreateCategoryForm(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/categories?err=form", http.StatusSeeOther)
		return
	}
	name := strings.TrimSpace(r.FormValue("name"))
	desc := strings.TrimSpace(r.FormValue("description"))
	workflow := defaultSelect(r.FormValue("workflow"), "implementacion")
	if name == "" {
		http.Redirect(w, r, "/categories?err="+url.QueryEscape("nombre requerido"), http.StatusSeeOther)
		return
	}
	if _, err := s.pb.CreateCategory(r.Context(), name, desc, workflow); err != nil {
		s.log.Printf("create category: %v", err)
		http.Redirect(w, r, "/categories?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/categories?ok="+url.QueryEscape("Categoría creada"), http.StatusSeeOther)
}

func (s *Server) handleTicketsPage(w http.ResponseWriter, r *http.Request) {
	f := pb.TicketFilters{
		Status:     r.URL.Query().Get("status"),
		Priority:   r.URL.Query().Get("priority"),
		Type:       r.URL.Query().Get("type"),
		CategoryID: r.URL.Query().Get("category"),
		Q:          r.URL.Query().Get("q"),
	}
	cats, errCats := s.pb.ListCategories(r.Context())
	tickets, errTickets := s.pb.ListTickets(r.Context(), f)
	catNames := map[string]string{}
	for _, c := range cats {
		catNames[c.ID] = c.Name
	}
	errMsg := ""
	if errCats != nil {
		errMsg = errCats.Error()
	}
	if errTickets != nil {
		errMsg = errTickets.Error()
	}
	s.render(w, "tickets.html", s.pageBase(r, map[string]any{
		"Title":      "Lista",
		"Nav":        "list",
		"Categories": cats,
		"Tickets":    tickets,
		"CatNames":   catNames,
		"Filters":    f,
		"Statuses":   statuses,
		"Priorities": priorities,
		"Types":      ticketTypes,
		"Error":      errMsg,
		"Flash":      r.URL.Query().Get("ok"),
	}))
}

func (s *Server) handleNewTicketPage(w http.ResponseWriter, r *http.Request) {
	cats, err := s.pb.ListCategories(r.Context())
	tenants, _ := s.pb.ListTenants(r.Context())
	templates, _ := s.pb.ListTemplates(r.Context())
	tplID := r.URL.Query().Get("template")
	var selected *pb.TicketTemplate
	var tplStages []pb.TemplateStage
	if tplID != "" {
		if t, e := s.pb.GetTemplate(r.Context(), tplID); e == nil {
			selected = t
			tplStages, _ = s.pb.ListTemplateStages(r.Context(), tplID)
		}
	}
	errMsg := r.URL.Query().Get("err")
	if err != nil && errMsg == "" {
		errMsg = err.Error()
	}
	s.render(w, "ticket_new.html", s.pageBase(r, map[string]any{
		"Title":          "Nuevo ticket",
		"Nav":            "new",
		"Categories":     cats,
		"Tenants":        tenants,
		"Templates":      templates,
		"SelectedTpl":    selected,
		"TemplateStages": tplStages,
		"Statuses":       statuses,
		"Priorities":     priorities,
		"Types":          ticketTypes,
		"Error":          errMsg,
		"Today":          time.Now().Format("2006-01-02"),
	}))
}

func (s *Server) handleCreateTicketForm(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/tickets/new?err=form", http.StatusSeeOther)
		return
	}
	subject := strings.TrimSpace(r.FormValue("subject"))
	description := strings.TrimSpace(r.FormValue("description"))
	categoryID := strings.TrimSpace(r.FormValue("category"))
	status := defaultSelect(r.FormValue("status"), "abierto")
	priority := defaultSelect(r.FormValue("priority"), "media")
	ticketType := defaultSelect(r.FormValue("type"), "implementacion")
	assignee := strings.TrimSpace(r.FormValue("assignee"))
	templateID := strings.TrimSpace(r.FormValue("template_id"))
	clientName := strings.TrimSpace(r.FormValue("client_name"))
	startDate := strings.TrimSpace(r.FormValue("start_date"))
	tenantID := strings.TrimSpace(r.FormValue("tenant"))
	requesterEmail := strings.TrimSpace(r.FormValue("requester_email"))

	if categoryID != "" {
		if cat, err := s.pb.GetCategory(r.Context(), categoryID); err == nil && cat.Workflow != "" {
			ticketType = cat.Workflow
		}
	}
	isSupport := ticketType == "soporte"
	if isSupport {
		templateID = "" // soporte no usa plantillas con etapas
	}

	var t *pb.Ticket
	var err error
	if templateID != "" {
		t, err = s.pb.CreateTicketFromTemplateOpts(r.Context(), pb.TemplateTicketOpts{
			TemplateID: templateID, ClientName: clientName, Subject: subject, Description: description,
			CategoryID: categoryID, Status: status, Priority: priority, Type: ticketType,
			Assignee: assignee, StartDate: startDate, TenantID: tenantID, RequesterEmail: requesterEmail,
		})
	} else {
		if subject == "" || categoryID == "" {
			http.Redirect(w, r, "/tickets/new?err="+url.QueryEscape("asunto y categoría requeridos"), http.StatusSeeOther)
			return
		}
		t, err = s.pb.CreateTicketFull(r.Context(), pb.TicketCreate{
			Subject: subject, Description: description, CategoryID: categoryID,
			Status: status, Priority: priority, Type: ticketType, Assignee: assignee,
			TenantID: tenantID, RequesterEmail: requesterEmail, Source: "ui",
		})
	}
	if err != nil {
		s.log.Printf("create ticket: %v", err)
		q := "/tickets/new?err=" + url.QueryEscape(err.Error())
		if templateID != "" {
			q += "&template=" + url.QueryEscape(templateID)
		}
		http.Redirect(w, r, q, http.StatusSeeOther)
		return
	}
	_ = s.syncTicketFromStages(r, t.ID)
	http.Redirect(w, r, "/tickets/"+t.ID+"?ok="+url.QueryEscape("Ticket "+t.Number+" creado"), http.StatusSeeOther)
}

func (s *Server) handleTemplatesPage(w http.ResponseWriter, r *http.Request) {
	items, err := s.pb.ListTemplates(r.Context())
	cats, _ := s.pb.ListCategories(r.Context())
	errMsg := r.URL.Query().Get("err")
	if err != nil && errMsg == "" {
		errMsg = err.Error()
	}
	s.render(w, "templates.html", s.pageBase(r, map[string]any{
		"Title":      "Plantillas",
		"Nav":        "templates",
		"Templates":  items,
		"Categories": cats,
		"Types":      ticketTypes,
		"Priorities": priorities,
		"Error":      errMsg,
		"Flash":      r.URL.Query().Get("ok"),
	}))
}

func (s *Server) handleCreateTemplateForm(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/templates?err=form", http.StatusSeeOther)
		return
	}
	name := strings.TrimSpace(r.FormValue("name"))
	if name == "" {
		http.Redirect(w, r, "/templates?err="+url.QueryEscape("nombre requerido"), http.StatusSeeOther)
		return
	}
	tpl, err := s.pb.CreateTemplate(
		r.Context(),
		name,
		r.FormValue("description"),
		defaultSelect(r.FormValue("type"), "implementacion"),
		r.FormValue("category"),
		defaultSelect(r.FormValue("priority"), "media"),
		r.FormValue("subject_template"),
		r.FormValue("body_template"),
	)
	if err != nil {
		http.Redirect(w, r, "/templates?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/templates/"+tpl.ID+"?ok="+url.QueryEscape("Plantilla creada — agrega etapas"), http.StatusSeeOther)
}

func (s *Server) handleTemplateDetail(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tpl, err := s.pb.GetTemplate(r.Context(), id)
	if err != nil {
		http.Error(w, "plantilla no encontrada", http.StatusNotFound)
		return
	}
	stages, _ := s.pb.ListTemplateStages(r.Context(), id)
	cats, _ := s.pb.ListCategories(r.Context())
	s.render(w, "template_detail.html", s.pageBase(r, map[string]any{
		"Title":      tpl.Name,
		"Nav":        "templates",
		"Template":   tpl,
		"Stages":     stages,
		"Categories": cats,
		"Types":      ticketTypes,
		"Priorities": priorities,
		"StageStates": stageStates,
		"Flash":      r.URL.Query().Get("ok"),
		"Error":      r.URL.Query().Get("err"),
	}))
}

func (s *Server) handleUpdateTemplateForm(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/templates/"+id+"?err=form", http.StatusSeeOther)
		return
	}
	if _, err := s.pb.UpdateTemplate(
		r.Context(), id,
		r.FormValue("name"),
		r.FormValue("description"),
		defaultSelect(r.FormValue("type"), "implementacion"),
		r.FormValue("category"),
		defaultSelect(r.FormValue("priority"), "media"),
		r.FormValue("subject_template"),
		r.FormValue("body_template"),
	); err != nil {
		http.Redirect(w, r, "/templates/"+id+"?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/templates/"+id+"?ok="+url.QueryEscape("Plantilla actualizada"), http.StatusSeeOther)
}

func (s *Server) handleAddTemplateStage(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/templates/"+id+"?err=form", http.StatusSeeOther)
		return
	}
	name := strings.TrimSpace(r.FormValue("name"))
	orden, _ := strconv.ParseFloat(r.FormValue("orden"), 64)
	offset, _ := strconv.ParseFloat(r.FormValue("offset_start_days"), 64)
	duration, _ := strconv.ParseFloat(r.FormValue("duration_days"), 64)
	if name == "" {
		http.Redirect(w, r, "/templates/"+id+"?err="+url.QueryEscape("nombre de etapa requerido"), http.StatusSeeOther)
		return
	}
	if _, err := s.pb.CreateTemplateStage(r.Context(), id, name, orden, offset, duration, defaultSelect(r.FormValue("estado"), "pendiente")); err != nil {
		http.Redirect(w, r, "/templates/"+id+"?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/templates/"+id+"?ok="+url.QueryEscape("Etapa agregada"), http.StatusSeeOther)
}

func (s *Server) handleDeleteTemplateStage(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	stageID := chi.URLParam(r, "stageID")
	if err := s.pb.DeleteTemplateStage(r.Context(), stageID); err != nil {
		http.Redirect(w, r, "/templates/"+id+"?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/templates/"+id+"?ok="+url.QueryEscape("Etapa eliminada"), http.StatusSeeOther)
}

func (s *Server) handleTicketDetail(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ticket, err := s.pb.GetTicket(r.Context(), id)
	if err != nil {
		http.Error(w, "ticket no encontrado", http.StatusNotFound)
		return
	}
	cats, _ := s.pb.ListCategories(r.Context())
	comments, _ := s.pb.ListComments(r.Context(), id)
	stages, _ := s.pb.ListStages(r.Context(), id)
	atts, _ := s.pb.ListAttachments(r.Context(), id)
	catName := ticket.Category
	catWorkflow := ticket.Type
	if c, err := s.pb.GetCategory(r.Context(), ticket.Category); err == nil {
		catName = c.Name
		if c.Workflow != "" {
			catWorkflow = c.Workflow
		}
	}
	isSupport := ticket.Type == "soporte" || catWorkflow == "soporte"
	evidenceByStage := map[string][]pb.Attachment{}
	ticketFiles := make([]pb.Attachment, 0)
	for _, a := range atts {
		if a.Kind == "evidence" && a.Stage != "" {
			evidenceByStage[a.Stage] = append(evidenceByStage[a.Stage], a)
		} else {
			ticketFiles = append(ticketFiles, a)
		}
	}
	s.render(w, "ticket_detail.html", s.pageBase(r, map[string]any{
		"Title":            ticket.Number,
		"Nav":              "board",
		"Ticket":           ticket,
		"CategoryName":     catName,
		"Categories":       cats,
		"Comments":         comments,
		"Stages":           stages,
		"Progress":         computeProgress(stages),
		"IsSupport":        isSupport,
		"TicketFiles":      ticketFiles,
		"EvidenceByStage":  evidenceByStage,
		"Statuses":         statuses,
		"Priorities":       priorities,
		"Types":            ticketTypes,
		"StageStates":      stageStates,
		"Flash":            r.URL.Query().Get("ok"),
		"Error":            r.URL.Query().Get("err"),
	}))
}

func (s *Server) handleTicketUpdate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/tickets/"+id+"?err=form", http.StatusSeeOther)
		return
	}
	subject := r.FormValue("subject")
	description := r.FormValue("description")
	category := r.FormValue("category")
	priority := r.FormValue("priority")
	ticketType := r.FormValue("type")
	assignee := r.FormValue("assignee")
	upd := pb.TicketUpdate{
		Subject:     &subject,
		Description: &description,
		CategoryID:  &category,
		Priority:    &priority,
		Type:        &ticketType,
		Assignee:    &assignee,
	}
	stagesCheck, _ := s.pb.ListStages(r.Context(), id)
	if len(stagesCheck) == 0 {
		st := r.FormValue("status")
		if st != "" {
			upd.Status = &st
		}
	}
	if _, err := s.pb.UpdateTicket(r.Context(), id, upd); err != nil {
		s.log.Printf("update ticket: %v", err)
		http.Redirect(w, r, "/tickets/"+id+"?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/tickets/"+id+"?ok="+url.QueryEscape("Ticket actualizado"), http.StatusSeeOther)
}

func (s *Server) handleTicketStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/tickets/"+id+"?err=form", http.StatusSeeOther)
		return
	}
	status := strings.TrimSpace(r.FormValue("status"))
	returnTo := strings.TrimSpace(r.FormValue("return_to"))
	if status == "" {
		http.Redirect(w, r, "/tickets/"+id+"?err="+url.QueryEscape("estado requerido"), http.StatusSeeOther)
		return
	}
	upd := pb.TicketUpdate{Status: &status}
	if _, err := s.pb.UpdateTicket(r.Context(), id, upd); err != nil {
		dest := "/tickets/" + id
		if returnTo == "board" {
			dest = "/board"
		}
		http.Redirect(w, r, dest+"?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	if returnTo == "board" {
		http.Redirect(w, r, "/board?ok="+url.QueryEscape("Estado → "+i18n.T(langFromRequest(r), "status."+status)), http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/tickets/"+id+"?ok="+url.QueryEscape("Estado cambiado a "+status), http.StatusSeeOther)
}

func (s *Server) handleAddComment(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/tickets/"+id+"?err=form", http.StatusSeeOther)
		return
	}
	body := strings.TrimSpace(r.FormValue("body"))
	vis := defaultSelect(r.FormValue("visibility"), "interno")
	author := defaultSelect(r.FormValue("author"), "agente")
	if body == "" {
		http.Redirect(w, r, "/tickets/"+id+"?err="+url.QueryEscape("comentario vacío"), http.StatusSeeOther)
		return
	}
	if _, err := s.pb.CreateComment(r.Context(), id, body, vis, author); err != nil {
		http.Redirect(w, r, "/tickets/"+id+"?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/tickets/"+id+"?ok="+url.QueryEscape("Comentario agregado"), http.StatusSeeOther)
}

func (s *Server) handleAddStage(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/tickets/"+id+"?err=form", http.StatusSeeOther)
		return
	}
	name := strings.TrimSpace(r.FormValue("name"))
	orden, _ := strconv.ParseFloat(r.FormValue("orden"), 64)
	if name == "" {
		http.Redirect(w, r, "/tickets/"+id+"?err="+url.QueryEscape("nombre de etapa requerido"), http.StatusSeeOther)
		return
	}
	estado := defaultSelect(r.FormValue("estado"), "pendiente")
	if estado == "hecha" {
		estado = "pendiente"
	}
	if _, err := s.pb.CreateStage(r.Context(), id, name, orden, r.FormValue("fecha_plan_inicio"), r.FormValue("fecha_plan_fin"), estado, avanceForEstado(estado, 0)); err != nil {
		http.Redirect(w, r, "/tickets/"+id+"?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	_ = s.syncTicketFromStages(r, id)
	http.Redirect(w, r, "/tickets/"+id+"?ok="+url.QueryEscape("Etapa agregada"), http.StatusSeeOther)
}

func (s *Server) handleUpdateStage(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	stageID := chi.URLParam(r, "stageID")
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/tickets/"+id+"?err=form", http.StatusSeeOther)
		return
	}
	orden, _ := strconv.ParseFloat(r.FormValue("orden"), 64)
	avance, _ := strconv.ParseFloat(r.FormValue("avance"), 64)
	estado := defaultSelect(r.FormValue("estado"), "pendiente")
	if estado == "hecha" {
		http.Redirect(w, r, "/tickets/"+id+"?err="+url.QueryEscape(i18n.T(langFromRequest(r), "err.evidence_required")), http.StatusSeeOther)
		return
	}
	avance = avanceForEstado(estado, avance)
	if _, err := s.pb.UpdateStage(r.Context(), stageID, r.FormValue("name"), estado, orden, avance, r.FormValue("fecha_plan_inicio"), r.FormValue("fecha_plan_fin")); err != nil {
		http.Redirect(w, r, "/tickets/"+id+"?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	_ = s.syncTicketFromStages(r, id)
	http.Redirect(w, r, "/tickets/"+id+"?ok="+url.QueryEscape("Etapa actualizada"), http.StatusSeeOther)
}

func (s *Server) handleStageEstado(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	stageID := chi.URLParam(r, "stageID")
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/tickets/"+id+"?err=form", http.StatusSeeOther)
		return
	}
	estado := defaultSelect(r.FormValue("estado"), "pendiente")
	if estado == "hecha" {
		http.Redirect(w, r, "/tickets/"+id+"?err="+url.QueryEscape(i18n.T(langFromRequest(r), "err.evidence_required")), http.StatusSeeOther)
		return
	}
	stages, err := s.pb.ListStages(r.Context(), id)
	if err != nil {
		http.Redirect(w, r, "/tickets/"+id+"?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	var cur *pb.Stage
	for i := range stages {
		if stages[i].ID == stageID {
			cur = &stages[i]
			break
		}
	}
	if cur == nil {
		http.Redirect(w, r, "/tickets/"+id+"?err="+url.QueryEscape("etapa no encontrada"), http.StatusSeeOther)
		return
	}
	if _, err := s.pb.UpdateStage(r.Context(), stageID, cur.Name, estado, cur.Orden, avanceForEstado(estado, cur.Avance), cur.FechaPlanInicio, cur.FechaPlanFin); err != nil {
		http.Redirect(w, r, "/tickets/"+id+"?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	_ = s.syncTicketFromStages(r, id)
	http.Redirect(w, r, "/tickets/"+id+"?ok="+url.QueryEscape("Etapa → "+estado), http.StatusSeeOther)
}

func (s *Server) syncTicketFromStages(r *http.Request, ticketID string) error {
	stages, err := s.pb.ListStages(r.Context(), ticketID)
	if err != nil {
		return err
	}
	st := statusFromStages(stages)
	if st == "" {
		return nil
	}
	upd := pb.TicketUpdate{Status: &st}
	_, err = s.pb.UpdateTicket(r.Context(), ticketID, upd)
	return err
}

func (s *Server) apiListCategories(w http.ResponseWriter, r *http.Request) {
	items, err := s.pb.ListCategories(r.Context())
	if err != nil {
		writeErr(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) apiCreateCategory(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Workflow    string `json:"workflow"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if strings.TrimSpace(body.Name) == "" {
		writeErr(w, http.StatusBadRequest, errNameRequired)
		return
	}
	item, err := s.pb.CreateCategory(r.Context(), body.Name, body.Description, body.Workflow)
	if err != nil {
		writeErr(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) apiListTickets(w http.ResponseWriter, r *http.Request) {
	f := pb.TicketFilters{
		Status:     r.URL.Query().Get("status"),
		Priority:   r.URL.Query().Get("priority"),
		Type:       r.URL.Query().Get("type"),
		CategoryID: r.URL.Query().Get("category"),
		Q:          r.URL.Query().Get("q"),
	}
	items, err := s.pb.ListTickets(r.Context(), f)
	if err != nil {
		writeErr(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) apiCreateTicket(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Subject     string `json:"subject"`
		Description string `json:"description"`
		CategoryID  string `json:"category_id"`
		Status      string `json:"status"`
		Priority    string `json:"priority"`
		Type        string `json:"type"`
		Assignee    string `json:"assignee"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if strings.TrimSpace(body.Subject) == "" || strings.TrimSpace(body.CategoryID) == "" {
		writeErr(w, http.StatusBadRequest, errTicketRequired)
		return
	}
	item, err := s.pb.CreateTicket(
		r.Context(),
		body.Subject,
		body.Description,
		body.CategoryID,
		defaultSelect(body.Status, "abierto"),
		defaultSelect(body.Priority, "media"),
		defaultSelect(body.Type, "implementacion"),
		body.Assignee,
	)
	if err != nil {
		writeErr(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) apiGetTicket(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	item, err := s.pb.GetTicket(r.Context(), id)
	if err != nil {
		writeErr(w, http.StatusNotFound, err)
		return
	}
	comments, _ := s.pb.ListComments(r.Context(), id)
	stages, _ := s.pb.ListStages(r.Context(), id)
	writeJSON(w, http.StatusOK, map[string]any{"ticket": item, "comments": comments, "stages": stages})
}

func (s *Server) apiPatchTicket(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		Subject     *string `json:"subject"`
		Description *string `json:"description"`
		CategoryID  *string `json:"category_id"`
		Status      *string `json:"status"`
		Priority    *string `json:"priority"`
		Type        *string `json:"type"`
		Assignee    *string `json:"assignee"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	item, err := s.pb.UpdateTicket(r.Context(), id, pb.TicketUpdate{
		Subject: body.Subject, Description: body.Description, CategoryID: body.CategoryID,
		Status: body.Status, Priority: body.Priority, Type: body.Type, Assignee: body.Assignee,
	})
	if err != nil {
		writeErr(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) apiAddComment(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		Body       string `json:"body"`
		Visibility string `json:"visibility"`
		Author     string `json:"author"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	item, err := s.pb.CreateComment(r.Context(), id, body.Body, defaultSelect(body.Visibility, "interno"), defaultSelect(body.Author, "agente"))
	if err != nil {
		writeErr(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) apiListComments(w http.ResponseWriter, r *http.Request) {
	items, err := s.pb.ListComments(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeErr(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) apiListStages(w http.ResponseWriter, r *http.Request) {
	items, err := s.pb.ListStages(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeErr(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) apiAddStage(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		Name            string  `json:"name"`
		Orden           float64 `json:"orden"`
		FechaPlanInicio string  `json:"fecha_plan_inicio"`
		FechaPlanFin    string  `json:"fecha_plan_fin"`
		Estado          string  `json:"estado"`
		Avance          float64 `json:"avance"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	item, err := s.pb.CreateStage(r.Context(), id, body.Name, body.Orden, body.FechaPlanInicio, body.FechaPlanFin, body.Estado, body.Avance)
	if err != nil {
		writeErr(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) render(w http.ResponseWriter, name string, data any) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	lang := i18n.ES
	if m, ok := data.(map[string]any); ok {
		if v, ok := m["Lang"].(string); ok {
			lang = i18n.Parse(v)
		}
	}
	tmpl, err := s.tmpl.Clone()
	if err != nil {
		s.log.Printf("clone template: %v", err)
		http.Error(w, "template error", http.StatusInternalServerError)
		return
	}
	// Request-scoped label helpers (language from page data).
	tmpl.Funcs(template.FuncMap{
		"labelStatus":   func(code string) string { return i18n.T(lang, "status."+code) },
		"labelPriority": func(code string) string { return i18n.T(lang, "priority."+code) },
		"labelType":     func(code string) string { return i18n.T(lang, "type."+code) },
		"labelVis":      func(code string) string { return i18n.T(lang, "vis."+code) },
		"labelStage":    func(code string) string { return i18n.T(lang, "stage."+code) },
		"stageClass":    stageClass,
	})
	if err := tmpl.ExecuteTemplate(w, name, data); err != nil {
		s.log.Printf("template %s: %v", name, err)
		http.Error(w, "template error", http.StatusInternalServerError)
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func defaultSelect(v, fallback string) string {
	v = strings.TrimSpace(v)
	if v == "" {
		return fallback
	}
	return v
}

func firstN(items []pb.Ticket, n int) []pb.Ticket {
	if len(items) <= n {
		return items
	}
	return items[:n]
}

func statusClass(s string) string {
	switch s {
	case "abierto":
		return "st-open"
	case "pendiente":
		return "st-wait"
	case "en_proceso":
		return "st-prog"
	case "resuelto":
		return "st-done"
	case "cerrado":
		return "st-closed"
	default:
		return ""
	}
}

func priorityClass(s string) string {
	switch s {
	case "critica":
		return "pr-crit"
	case "alta":
		return "pr-high"
	case "media":
		return "pr-mid"
	case "baja":
		return "pr-low"
	default:
		return ""
	}
}

type simpleError string

func (e simpleError) Error() string { return string(e) }

const (
	errNameRequired   simpleError = "name is required"
	errTicketRequired simpleError = "subject and category_id are required"
)
