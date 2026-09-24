package server

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/archangelgt/helpdesk/api/internal/pb"
	"github.com/go-chi/chi/v5"
)

type apiKeyCtxKey struct{}

func (s *Server) extractAPIKey(r *http.Request) string {
	if k := strings.TrimSpace(r.Header.Get("X-API-Key")); k != "" {
		return k
	}
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(strings.ToLower(auth), "bearer ") {
		return strings.TrimSpace(auth[7:])
	}
	return ""
}

func (s *Server) requireAPIKey(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw := s.extractAPIKey(r)
		if raw == "" {
			writeErr(w, http.StatusUnauthorized, simpleError("missing api key"))
			return
		}
		key, err := s.pb.FindAPIKeyByRaw(r.Context(), raw)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, simpleError("invalid api key"))
			return
		}
		ctx := context.WithValue(r.Context(), apiKeyCtxKey{}, key)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func apiKeyFrom(ctx context.Context) *pb.APIKey {
	k, _ := ctx.Value(apiKeyCtxKey{}).(*pb.APIKey)
	return k
}

func (s *Server) ingestCreateTicket(w http.ResponseWriter, r *http.Request) {
	key := apiKeyFrom(r.Context())
	var body struct {
		Subject        string `json:"subject"`
		Description    string `json:"description"`
		Type           string `json:"type"`
		Priority       string `json:"priority"`
		Status         string `json:"status"`
		CategoryID     string `json:"category_id"`
		CategoryName   string `json:"category"`
		RequesterEmail string `json:"requester_email"`
		RequesterName  string `json:"requester_name"`
		Assignee       string `json:"assignee"`
		Channel        string `json:"channel"`
		ExternalID     string `json:"external_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if strings.TrimSpace(body.Subject) == "" {
		writeErr(w, http.StatusBadRequest, simpleError("subject is required"))
		return
	}
	if body.ExternalID != "" {
		if existing, err := s.pb.GetTicketByExternalID(r.Context(), key.Tenant, body.ExternalID); err == nil {
			writeJSON(w, http.StatusOK, map[string]any{"ticket": existing, "idempotent": true})
			return
		}
	}
	catID := body.CategoryID
	if catID == "" && body.CategoryName != "" {
		cats, _ := s.pb.ListCategories(r.Context())
		want := strings.ToLower(strings.TrimSpace(body.CategoryName))
		for _, c := range cats {
			if strings.ToLower(c.Name) == want {
				catID = c.ID
				break
			}
		}
	}
	if catID == "" {
		cats, _ := s.pb.ListCategories(r.Context())
		if len(cats) == 0 {
			writeErr(w, http.StatusBadRequest, simpleError("no categories; create one in UI first"))
			return
		}
		catID = cats[0].ID
	}
	source := "api"
	ch := body.Channel
	if ch == "" {
		ch = key.Channel
	}
	switch ch {
	case "chat", "email", "whatsapp":
		source = ch
	}
	requesterID := ""
	email := strings.ToLower(strings.TrimSpace(body.RequesterEmail))
	if email != "" {
		if u, err := s.pb.GetUserByEmail(r.Context(), email); err == nil {
			requesterID = u.ID
		}
	}
	ticket, err := s.pb.CreateTicketFull(r.Context(), pb.TicketCreate{
		Subject: body.Subject, Description: body.Description, CategoryID: catID,
		Status: defaultSelect(body.Status, "abierto"), Priority: defaultSelect(body.Priority, "media"),
		Type: defaultSelect(body.Type, "soporte"), Assignee: body.Assignee,
		TenantID: key.Tenant, RequesterID: requesterID, RequesterEmail: email,
		Source: source, ExternalID: body.ExternalID,
	})
	if err != nil {
		writeErr(w, http.StatusBadGateway, err)
		return
	}
	if body.RequesterName != "" {
		_, _ = s.pb.CreateComment(r.Context(), ticket.ID, "Solicitante: "+body.RequesterName+" <"+email+">", "sistema", "api")
	}
	writeJSON(w, http.StatusCreated, map[string]any{"ticket": ticket})
}

func (s *Server) ingestAddComment(w http.ResponseWriter, r *http.Request) {
	key := apiKeyFrom(r.Context())
	id := chi.URLParam(r, "id")
	t, err := s.pb.GetTicket(r.Context(), id)
	if err != nil {
		writeErr(w, http.StatusNotFound, err)
		return
	}
	if t.Tenant != "" && t.Tenant != key.Tenant {
		writeErr(w, http.StatusForbidden, simpleError("ticket belongs to another tenant"))
		return
	}
	var body struct {
		Body       string `json:"body"`
		Visibility string `json:"visibility"`
		Author     string `json:"author"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if strings.TrimSpace(body.Body) == "" {
		writeErr(w, http.StatusBadRequest, simpleError("body is required"))
		return
	}
	vis := defaultSelect(body.Visibility, "cliente")
	if vis == "interno" {
		vis = "cliente" // ingest from external systems stays client-visible by default unless explicit sistema
	}
	item, err := s.pb.CreateComment(r.Context(), id, body.Body, vis, defaultSelect(body.Author, "api"))
	if err != nil {
		writeErr(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) ingestGetTicket(w http.ResponseWriter, r *http.Request) {
	key := apiKeyFrom(r.Context())
	id := chi.URLParam(r, "id")
	t, err := s.pb.GetTicket(r.Context(), id)
	if err != nil {
		writeErr(w, http.StatusNotFound, err)
		return
	}
	if t.Tenant != "" && t.Tenant != key.Tenant {
		writeErr(w, http.StatusForbidden, simpleError("ticket belongs to another tenant"))
		return
	}
	comments, _ := s.pb.ListComments(r.Context(), id)
	stages, _ := s.pb.ListStages(r.Context(), id)
	writeJSON(w, http.StatusOK, map[string]any{"ticket": t, "comments": comments, "stages": stages})
}
