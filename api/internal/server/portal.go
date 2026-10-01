package server

import (
	"net/http"
	"net/url"
	"sort"
	"strings"

	"github.com/archangelgt/helpdesk/api/internal/i18n"
	"github.com/archangelgt/helpdesk/api/internal/pb"
	"github.com/go-chi/chi/v5"
)

func (s *Server) handlePortal(w http.ResponseWriter, r *http.Request) {
	u := userFrom(r.Context())
	// Los tickets donde el usuario es solicitante se listan aunque estén en otra empresa.
	var all []pb.Ticket
	if strings.TrimSpace(u.Email) != "" {
		byEmail, _ := s.pb.ListTickets(r.Context(), pb.TicketFilters{RequesterEmail: u.Email})
		all = append(all, byEmail...)
	}
	if u.ID != "" {
		byID, _ := s.pb.ListTickets(r.Context(), pb.TicketFilters{RequesterID: u.ID})
		all = append(all, byID...)
	}
	// Las implementaciones de la empresa las ven todos sus usuarios.
	if u.Tenant != "" {
		impl, _ := s.pb.ListTickets(r.Context(), pb.TicketFilters{TenantID: u.Tenant, Type: "implementacion"})
		all = append(all, impl...)
	}
	seen := map[string]bool{}
	var tickets []pb.Ticket
	progress := map[string]TicketProgress{}
	for _, t := range all {
		if seen[t.ID] {
			continue
		}
		seen[t.ID] = true
		tickets = append(tickets, t)
		if t.Type == "implementacion" {
			stages, _ := s.pb.ListStages(r.Context(), t.ID)
			progress[t.ID] = computeProgress(stages)
		}
	}
	sort.SliceStable(tickets, func(i, j int) bool { return tickets[i].Created > tickets[j].Created })
	s.render(w, "portal.html", s.pageBase(r, map[string]any{
		"Title":    i18n.T(langFromRequest(r), "portal.title"),
		"Nav":      "portal",
		"Tickets":  tickets,
		"Progress": progress,
	}))
}

func (s *Server) handlePortalTicket(w http.ResponseWriter, r *http.Request) {
	u := userFrom(r.Context())
	id := chi.URLParam(r, "id")
	t, err := s.pb.GetTicket(r.Context(), id)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if !portalCanView(u, t) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	comments, _ := s.pb.ListComments(r.Context(), id)
	var visible []pb.Comment
	for _, c := range comments {
		if c.Visibility != "interno" {
			visible = append(visible, c)
		}
	}
	stages, _ := s.pb.ListStages(r.Context(), id)
	s.render(w, "portal_ticket.html", s.pageBase(r, map[string]any{
		"Title":    t.Number,
		"Nav":      "portal",
		"Ticket":   t,
		"Comments": visible,
		"Stages":   stages,
		"Progress": computeProgress(stages),
		"Flash":    r.URL.Query().Get("ok"),
		"Error":    r.URL.Query().Get("err"),
	}))
}

func (s *Server) handlePortalComment(w http.ResponseWriter, r *http.Request) {
	u := userFrom(r.Context())
	id := chi.URLParam(r, "id")
	t, err := s.pb.GetTicket(r.Context(), id)
	if err != nil || !portalCanView(u, t) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/portal/tickets/"+id+"?err=form", http.StatusSeeOther)
		return
	}
	body := strings.TrimSpace(r.FormValue("body"))
	if body == "" {
		http.Redirect(w, r, "/portal/tickets/"+id+"?err="+url.QueryEscape("empty"), http.StatusSeeOther)
		return
	}
	if _, err := s.pb.CreateComment(r.Context(), id, body, "cliente", u.Name); err != nil {
		http.Redirect(w, r, "/portal/tickets/"+id+"?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/portal/tickets/"+id+"?ok=1", http.StatusSeeOther)
}

func portalCanView(u *pb.AppUser, t *pb.Ticket) bool {
	if u == nil || t == nil {
		return false
	}
	if u.IsStaff() {
		return true
	}
	if t.Requester == u.ID {
		return true
	}
	if t.RequesterEmail != "" && strings.EqualFold(t.RequesterEmail, u.Email) {
		return true
	}
	if t.Type == "implementacion" && u.Tenant != "" && t.Tenant == u.Tenant {
		return true
	}
	return false
}
