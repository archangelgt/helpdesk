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
		"Flash": r.URL.Query().Get("ok"),
	}))
}

func (s *Server) handleLoginForm(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/login?err=form", http.StatusSeeOther)
		return
	}
	seraphID := strings.TrimSpace(r.FormValue("seraph_id"))
	email := strings.TrimSpace(r.FormValue("email"))
	pass := r.FormValue("password")
	next := r.FormValue("next")
	lang := langFromRequest(r)

	tenant, err := s.pb.GetTenantByNit(r.Context(), seraphID)
	if err != nil {
		http.Redirect(w, r, "/login?err="+url.QueryEscape(i18n.T(lang, "err.auth")), http.StatusSeeOther)
		return
	}
	u, err := s.pb.GetUserByEmail(r.Context(), email)
	if err != nil || !u.Active || !pb.CheckPassword(u.PasswordHash, pass) {
		http.Redirect(w, r, "/login?err="+url.QueryEscape(i18n.T(lang, "err.auth")), http.StatusSeeOther)
		return
	}
	// Cliente debe pertenecer a la empresa del seraph_id (NIT). Maestro puede entrar con cualquier NIT válido.
	if u.Role == "cliente" && u.Tenant != tenant.ID {
		http.Redirect(w, r, "/login?err="+url.QueryEscape(i18n.T(lang, "err.auth")), http.StatusSeeOther)
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
	if !strings.HasPrefix(next, "/") || strings.HasPrefix(next, "//") {
		next = "/board"
	}
	http.Redirect(w, r, next, http.StatusSeeOther)
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	s.clearSession(w)
	http.Redirect(w, r, "/login", http.StatusSeeOther)
}

func (s *Server) handleRegisterPage(w http.ResponseWriter, r *http.Request) {
	if u := s.loadUser(r); u != nil {
		if u.Role == "cliente" {
			http.Redirect(w, r, "/portal", http.StatusSeeOther)
			return
		}
		http.Redirect(w, r, "/board", http.StatusSeeOther)
		return
	}
	s.render(w, "register.html", s.pageBase(r, map[string]any{
		"Title": i18n.T(langFromRequest(r), "register.title"),
		"Nav":   "register",
		"Error": r.URL.Query().Get("err"),
		"Flash": r.URL.Query().Get("ok"),
	}))
}

func (s *Server) handleRegisterForm(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/register?err=form", http.StatusSeeOther)
		return
	}
	lang := langFromRequest(r)
	seraphID := strings.TrimSpace(r.FormValue("seraph_id"))
	email := strings.TrimSpace(r.FormValue("email"))
	name := strings.TrimSpace(r.FormValue("name"))
	pass := r.FormValue("password")
	pass2 := r.FormValue("password2")

	if seraphID == "" || email == "" || pass == "" {
		http.Redirect(w, r, "/register?err="+url.QueryEscape(i18n.T(lang, "err.register_required")), http.StatusSeeOther)
		return
	}
	if len(pass) < 6 {
		http.Redirect(w, r, "/register?err="+url.QueryEscape(i18n.T(lang, "err.register_password")), http.StatusSeeOther)
		return
	}
	if pass != pass2 {
		http.Redirect(w, r, "/register?err="+url.QueryEscape(i18n.T(lang, "err.register_mismatch")), http.StatusSeeOther)
		return
	}
	tenant, err := s.pb.GetTenantByNit(r.Context(), seraphID)
	if err != nil {
		http.Redirect(w, r, "/register?err="+url.QueryEscape(i18n.T(lang, "err.register_nit")), http.StatusSeeOther)
		return
	}
	if _, err := s.pb.GetUserByEmail(r.Context(), email); err == nil {
		http.Redirect(w, r, "/register?err="+url.QueryEscape(i18n.T(lang, "err.register_exists")), http.StatusSeeOther)
		return
	}
	if name == "" {
		name = strings.Split(email, "@")[0]
	}
	if _, err := s.pb.CreateUser(r.Context(), email, name, pass, "cliente", tenant.ID); err != nil {
		http.Redirect(w, r, "/register?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/login?ok="+url.QueryEscape(i18n.T(lang, "flash.registered")), http.StatusSeeOther)
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
		http.Redirect(w, r, "/board", http.StatusSeeOther)
		return
	}
	lang := i18n.Parse(r.FormValue("lang"))
	theme := r.FormValue("theme")
	if theme != "light" && theme != "dark" && theme != "auto" {
		theme = "light"
	}
	setPrefCookie(w, cookieLang, lang.String())
	setPrefCookie(w, cookieTheme, theme)
	next := strings.TrimSpace(r.FormValue("next"))
	if next == "" || !strings.HasPrefix(next, "/") || strings.HasPrefix(next, "//") {
		next = "/board"
	}
	http.Redirect(w, r, next, http.StatusSeeOther)
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
		"Flash":   r.URL.Query().Get("ok"),
		"Error":   firstNonEmpty(errMsg, r.URL.Query().Get("err")),
		"EditID":  r.URL.Query().Get("edit"),
	}))
}

func (s *Server) handleCreateTenantForm(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/tenants?err=form", http.StatusSeeOther)
		return
	}
	lang := langFromRequest(r)
	name := strings.TrimSpace(r.FormValue("name"))
	slug := strings.TrimSpace(r.FormValue("slug"))
	nit := strings.TrimSpace(r.FormValue("nit"))
	if name == "" || nit == "" {
		http.Redirect(w, r, "/tenants?err="+url.QueryEscape(i18n.T(lang, "err.tenant_required")), http.StatusSeeOther)
		return
	}
	if slug == "" {
		slug = slugify(name)
	}
	if _, err := s.pb.GetTenantByNit(r.Context(), nit); err == nil {
		http.Redirect(w, r, "/tenants?err="+url.QueryEscape(i18n.T(lang, "err.tenant_nit_exists")), http.StatusSeeOther)
		return
	}
	if _, err := s.pb.CreateTenant(r.Context(), name, slug, nit); err != nil {
		http.Redirect(w, r, "/tenants?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/tenants?ok="+url.QueryEscape(i18n.T(lang, "flash.tenant_created")), http.StatusSeeOther)
}

func (s *Server) handleUpdateTenantForm(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/tenants?err=form", http.StatusSeeOther)
		return
	}
	lang := langFromRequest(r)
	id := strings.TrimSpace(r.FormValue("id"))
	name := strings.TrimSpace(r.FormValue("name"))
	slug := strings.TrimSpace(r.FormValue("slug"))
	nit := strings.TrimSpace(r.FormValue("nit"))
	if id == "" || name == "" || nit == "" {
		http.Redirect(w, r, "/tenants?err="+url.QueryEscape(i18n.T(lang, "err.tenant_required")), http.StatusSeeOther)
		return
	}
	if slug == "" {
		slug = slugify(name)
	}
	if other, err := s.pb.GetTenantByNit(r.Context(), nit); err == nil && other.ID != id {
		http.Redirect(w, r, "/tenants?err="+url.QueryEscape(i18n.T(lang, "err.tenant_nit_exists")), http.StatusSeeOther)
		return
	}
	if _, err := s.pb.UpdateTenant(r.Context(), id, name, slug, nit); err != nil {
		http.Redirect(w, r, "/tenants?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/tenants?ok="+url.QueryEscape(i18n.T(lang, "flash.tenant_saved")), http.StatusSeeOther)
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	var b strings.Builder
	prevDash := false
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			prevDash = false
		case r == ' ' || r == '_' || r == '-':
			if !prevDash && b.Len() > 0 {
				b.WriteByte('-')
				prevDash = true
			}
		}
	}
	out := strings.Trim(b.String(), "-")
	if out == "" {
		return "empresa"
	}
	return out
}
