package server

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/archangelgt/helpdesk/api/internal/i18n"
	"github.com/archangelgt/helpdesk/api/internal/pb"
	"github.com/go-chi/chi/v5"
)

func (s *Server) handlePortal(w http.ResponseWriter, r *http.Request) {
	u := userFrom(r.Context())
	f := pb.TicketFilters{}
	if u.Tenant != "" {
		f.TenantID = u.Tenant
	}
	f.RequesterEmail = u.Email
	// Also include by requester id
	ticketsByEmail, _ := s.pb.ListTickets(r.Context(), f)
	f2 := pb.TicketFilters{RequesterID: u.ID, TenantID: u.Tenant}
	ticketsByID, _ := s.pb.ListTickets(r.Context(), f2)
	seen := map[string]bool{}
	var tickets []pb.Ticket
	for _, t := range append(ticketsByEmail, ticketsByID...) {
		if seen[t.ID] {
			continue
		}
		seen[t.ID] = true
		tickets = append(tickets, t)
	}
	s.render(w, "portal.html", s.pageBase(r, map[string]any{
		"Title":   i18n.T(langFromRequest(r), "portal.title"),
		"Nav":     "portal",
		"Tickets": tickets,
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
	if u.Role == "maestro" {
		return true
	}
	if t.Requester == u.ID {
		return true
	}
	if t.RequesterEmail != "" && strings.EqualFold(t.RequesterEmail, u.Email) {
		return true
	}
	return false
}
