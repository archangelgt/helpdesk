package server

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/archangelgt/helpdesk/api/internal/i18n"
	"github.com/archangelgt/helpdesk/api/internal/pb"
)

func (s *Server) handleLoginPage(w http.ResponseWriter, r *http.Request) {
	if u := s.loadUser(r); u != nil {
		if u.Role == "cliente" {
			http.Redirect(w, r, "/portal", http.StatusSeeOther)
			return
		}
		http.Redirect(w, r, "/board", http.StatusSeeOther)
		return
	}
	s.render(w, "login.html", s.pageBase(r, map[string]any{
		"Title": i18n.T(langFromRequest(r), "login.title"),
		"Nav":   "login",
		"Next":  r.URL.Query().Get("next"),
		"Error": r.URL.Query().Get("err"),
	}))
}

func (s *Server) handleLoginForm(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/login?err=form", http.StatusSeeOther)
		return
	}
	email := strings.TrimSpace(r.FormValue("email"))
	pass := r.FormValue("password")
	next := r.FormValue("next")
	u, err := s.pb.GetUserByEmail(r.Context(), email)
	if err != nil || !u.Active || !pb.CheckPassword(u.PasswordHash, pass) {
		http.Redirect(w, r, "/login?err="+url.QueryEscape(i18n.T(langFromRequest(r), "err.auth")), http.StatusSeeOther)
		return
	}
	s.setSession(w, u.ID)
	if next == "" {
		if u.Role == "cliente" {
			next = "/portal"
		} else {
			next = "/board"
		}
	}
	if !strings.HasPrefix(next, "/") {
		next = "/board"
	}
	http.Redirect(w, r, next, http.StatusSeeOther)
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	s.clearSession(w)
	http.Redirect(w, r, "/login", http.StatusSeeOther)
}

func (s *Server) handlePrefsPage(w http.ResponseWriter, r *http.Request) {
	s.render(w, "prefs.html", s.pageBase(r, map[string]any{
		"Title": i18n.T(langFromRequest(r), "prefs.title"),
		"Nav":   "prefs",
		"Flash": r.URL.Query().Get("ok"),
	}))
}

func (s *Server) handlePrefsForm(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/prefs", http.StatusSeeOther)
		return
	}
	lang := i18n.Parse(r.FormValue("lang"))
	theme := r.FormValue("theme")
	if theme != "light" && theme != "dark" && theme != "auto" {
		theme = "light"
	}
	setPrefCookie(w, cookieLang, lang.String())
	setPrefCookie(w, cookieTheme, theme)
	http.Redirect(w, r, "/prefs?ok=1", http.StatusSeeOther)
}

func (s *Server) handleTenantsPage(w http.ResponseWriter, r *http.Request) {
	items, err := s.pb.ListTenants(r.Context())
	errMsg := ""
	if err != nil {
		errMsg = err.Error()
	}
	s.render(w, "tenants.html", s.pageBase(r, map[string]any{
		"Title":   i18n.T(langFromRequest(r), "tenants.title"),
		"Nav":     "tenants",
		"Tenants": items,
		"Error":   errMsg,
	}))
}
