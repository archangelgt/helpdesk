package server

import (
	"encoding/json"
	"html/template"
	"log"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/archangelgt/helpdesk/api/internal/config"
	"github.com/archangelgt/helpdesk/api/internal/pb"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

type Server struct {
	cfg    config.Config
	pb     *pb.Client
	log    *log.Logger
	tmpl   *template.Template
}

func New(cfg config.Config, client *pb.Client, logger *log.Logger) *Server {
	tmpl := template.Must(template.ParseGlob(filepath.Join(cfg.WebDir, "templates", "*.html")))
	return &Server{cfg: cfg, pb: client, log: logger, tmpl: tmpl}
}

func (s *Server) Routes() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	r.Get("/", s.handleHome)
	r.Get("/categories", s.handleCategoriesPage)
	r.Post("/categories", s.handleCreateCategoryForm)
	r.Get("/tickets", s.handleTicketsPage)
	r.Post("/tickets", s.handleCreateTicketForm)

	r.Route("/api", func(api chi.Router) {
		api.Get("/categories", s.apiListCategories)
		api.Post("/categories", s.apiCreateCategory)
		api.Get("/tickets", s.apiListTickets)
		api.Post("/tickets", s.apiCreateTicket)
	})

	return r
}

func (s *Server) handleHome(w http.ResponseWriter, r *http.Request) {
	cats, _ := s.pb.ListCategories(r.Context())
	tickets, _ := s.pb.ListTickets(r.Context())
	s.render(w, "home.html", map[string]any{
		"Title":           "Helpdesk",
		"CategoryCount":   len(cats),
		"TicketCount":     len(tickets),
		"Flash":           r.URL.Query().Get("ok"),
		"Error":           r.URL.Query().Get("err"),
	})
}

func (s *Server) handleCategoriesPage(w http.ResponseWriter, r *http.Request) {
	cats, err := s.pb.ListCategories(r.Context())
	data := map[string]any{
		"Title":      "Categorías",
		"Categories": cats,
		"Error":      "",
		"Flash":      r.URL.Query().Get("ok"),
	}
	if err != nil {
		data["Error"] = err.Error()
	}
	s.render(w, "categories.html", data)
}

func (s *Server) handleCreateCategoryForm(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/categories?err=form", http.StatusSeeOther)
		return
	}
	name := strings.TrimSpace(r.FormValue("name"))
	desc := strings.TrimSpace(r.FormValue("description"))
	if name == "" {
		http.Redirect(w, r, "/categories?err=nombre+requerido", http.StatusSeeOther)
		return
	}
	if _, err := s.pb.CreateCategory(r.Context(), name, desc); err != nil {
		s.log.Printf("create category: %v", err)
		http.Redirect(w, r, "/categories?err="+urlQuery(err.Error()), http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/categories?ok=Categoria+creada", http.StatusSeeOther)
}

func (s *Server) handleTicketsPage(w http.ResponseWriter, r *http.Request) {
	cats, errCats := s.pb.ListCategories(r.Context())
	tickets, errTickets := s.pb.ListTickets(r.Context())
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
	s.render(w, "tickets.html", map[string]any{
		"Title":      "Tickets",
		"Categories": cats,
		"Tickets":    tickets,
		"CatNames":   catNames,
		"Error":      errMsg,
		"Flash":      r.URL.Query().Get("ok"),
	})
}

func (s *Server) handleCreateTicketForm(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/tickets?err=form", http.StatusSeeOther)
		return
	}
	subject := strings.TrimSpace(r.FormValue("subject"))
	description := strings.TrimSpace(r.FormValue("description"))
	categoryID := strings.TrimSpace(r.FormValue("category"))
	status := defaultSelect(r.FormValue("status"), "abierto")
	priority := defaultSelect(r.FormValue("priority"), "media")
	ticketType := defaultSelect(r.FormValue("type"), "implementacion")
	if subject == "" || categoryID == "" {
		http.Redirect(w, r, "/tickets?err=asunto+y+categoria+requeridos", http.StatusSeeOther)
		return
	}
	if _, err := s.pb.CreateTicket(r.Context(), subject, description, categoryID, status, priority, ticketType); err != nil {
		s.log.Printf("create ticket: %v", err)
		http.Redirect(w, r, "/tickets?err="+urlQuery(err.Error()), http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/tickets?ok=Ticket+creado", http.StatusSeeOther)
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
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if strings.TrimSpace(body.Name) == "" {
		writeErr(w, http.StatusBadRequest, errNameRequired)
		return
	}
	item, err := s.pb.CreateCategory(r.Context(), body.Name, body.Description)
	if err != nil {
		writeErr(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) apiListTickets(w http.ResponseWriter, r *http.Request) {
	items, err := s.pb.ListTickets(r.Context())
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
	)
	if err != nil {
		writeErr(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) render(w http.ResponseWriter, name string, data any) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := s.tmpl.ExecuteTemplate(w, name, data); err != nil {
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

func urlQuery(s string) string {
	return strings.ReplaceAll(s, " ", "+")
}

type simpleError string

func (e simpleError) Error() string { return string(e) }

const (
	errNameRequired   simpleError = "name is required"
	errTicketRequired simpleError = "subject and category_id are required"
)
