package server

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strings"

	"github.com/archangelgt/helpdesk/api/internal/erp"
	"github.com/archangelgt/helpdesk/api/internal/i18n"
	"github.com/archangelgt/helpdesk/api/internal/pb"
)

func (s *Server) handleLoginPage(w http.ResponseWriter, r *http.Request) {
	if u := s.loadUser(r); u != nil {
		http.Redirect(w, r, homeForUser(u), http.StatusSeeOther)
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
	if err != nil || !u.Active {
		http.Redirect(w, r, "/login?err="+url.QueryEscape(i18n.T(lang, "err.auth")), http.StatusSeeOther)
		return
	}
	// Cliente/agente con tenant deben coincidir con el NIT. Maestro puede usar cualquier NIT válido.
	if u.Role != pb.RoleMaestro && u.Tenant != "" && u.Tenant != tenant.ID {
		http.Redirect(w, r, "/login?err="+url.QueryEscape(i18n.T(lang, "err.auth")), http.StatusSeeOther)
		return
	}
	if u.UsesERPAuth() {
		// La contraseña vive en el ERP de la empresa del usuario, no en la del seraph_id
		// escrito (un maestro puede entrar con cualquier seraph_id).
		home := tenant
		if u.Tenant != "" && u.Tenant != tenant.ID {
			if home, err = s.pb.GetTenant(r.Context(), u.Tenant); err != nil {
				http.Redirect(w, r, "/login?err="+url.QueryEscape(i18n.T(lang, "err.auth")), http.StatusSeeOther)
				return
			}
		}
		erpUser, err := s.erp.Authenticate(r.Context(), home.Nit, email, pass)
		if err != nil {
			s.log.Printf("login ERP %s/%s: %v", home.Nit, email, err)
			http.Redirect(w, r, "/login?err="+url.QueryEscape(i18n.T(lang, "err.erp_unavailable")), http.StatusSeeOther)
			return
		}
		if erpUser == nil {
			http.Redirect(w, r, "/login?err="+url.QueryEscape(i18n.T(lang, "err.auth")), http.StatusSeeOther)
			return
		}
		if role, perms := s.erpRole(home.Nit); role == pb.RoleMaestro && u.Role != pb.RoleMaestro {
			if updated, err := s.pb.UpdateUser(r.Context(), u.ID, u.Name, role, u.Tenant, perms, true); err == nil {
				u = updated
			}
		}
	} else if !pb.CheckPassword(u.PasswordHash, pass) {
		http.Redirect(w, r, "/login?err="+url.QueryEscape(i18n.T(lang, "err.auth")), http.StatusSeeOther)
		return
	}
	s.setSession(w, u.ID)
	if next == "" {
		next = homeForUser(u)
	}
	if !strings.HasPrefix(next, "/") || strings.HasPrefix(next, "//") {
		next = homeForUser(u)
	}
	http.Redirect(w, r, next, http.StatusSeeOther)
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	s.clearSession(w)
	http.Redirect(w, r, "/login", http.StatusSeeOther)
}

func (s *Server) handleRegisterPage(w http.ResponseWriter, r *http.Request) {
	if u := s.loadUser(r); u != nil {
		http.Redirect(w, r, homeForUser(u), http.StatusSeeOther)
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
	email := strings.ToLower(strings.TrimSpace(r.FormValue("email")))
	fail := func(key string) {
		http.Redirect(w, r, "/register?err="+url.QueryEscape(i18n.T(lang, key)), http.StatusSeeOther)
	}

	if seraphID == "" || email == "" {
		fail("err.register_required")
		return
	}
	if !s.erp.Enabled() {
		fail("err.erp_unavailable")
		return
	}
	if _, err := s.pb.GetUserByEmail(r.Context(), email); err == nil {
		fail("err.register_exists")
		return
	}
	company, erpUser, err := s.erp.LookupUser(r.Context(), seraphID, email)
	if errors.Is(err, erp.ErrCompanyNotFound) {
		fail("err.register_nit")
		return
	}
	if err != nil {
		s.log.Printf("registro ERP %s/%s: %v", seraphID, email, err)
		fail("err.erp_unavailable")
		return
	}
	if erpUser == nil {
		fail("err.register_erp_user")
		return
	}
	tenant, err := s.tenantFromERP(r.Context(), *company)
	if err != nil {
		http.Redirect(w, r, "/register?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	role, perms := s.erpRole(company.SeraphID)
	if _, err := s.pb.CreateERPUser(r.Context(), email, erpUser.Nombre, role, tenant.ID, perms); err != nil {
		http.Redirect(w, r, "/register?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/login?ok="+url.QueryEscape(i18n.T(lang, "flash.registered_erp")), http.StatusSeeOther)
}

// erpRole: los usuarios del ERP de la empresa maestra son maestros; el resto, clientes
// que solo crean tickets.
func (s *Server) erpRole(seraphID string) (string, []string) {
	if normalizeTenantNit(seraphID) == normalizeTenantNit(s.cfg.MasterSeraphID) {
		return pb.RoleMaestro, pb.DefaultPermissions(pb.RoleMaestro)
	}
	return pb.RoleCliente, pb.DefaultPermissions(pb.RoleCliente)
}

// tenantFromERP crea o actualiza en Helpdesk la empresa del ERP (NIT = seraph_id).
func (s *Server) tenantFromERP(ctx context.Context, c erp.Company) (*pb.Tenant, error) {
	name := strings.TrimSpace(c.Nombre)
	if name == "" {
		name = c.SeraphID
	}
	slug := slugify(name)
	if len(slug) > 60 {
		slug = strings.Trim(slug[:60], "-")
	}
	return s.pb.UpsertTenantByNit(ctx, name, slug+"-"+c.SeraphID, c.SeraphID)
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

type erpCompanyRow struct {
	Company erp.Company
	Tenant  *pb.Tenant
	Users   int
}

// handleTenantsPage muestra las empresas del ERP y las sincroniza como tenants de Helpdesk
// (para poder clasificar tickets y registrar usuarios con su seraph_id).
func (s *Server) handleTenantsPage(w http.ResponseWriter, r *http.Request) {
	lang := langFromRequest(r)
	var errs []string
	var rows []erpCompanyRow
	erpNits := map[string]bool{}

	if s.erp.Enabled() {
		companies, err := s.erp.Companies(r.Context())
		if err != nil {
			s.log.Printf("empresas ERP: %v", err)
			errs = append(errs, i18n.T(lang, "err.erp_unavailable"))
		}
		for _, c := range companies {
			erpNits[normalizeTenantNit(c.SeraphID)] = true
			t, err := s.tenantFromERP(r.Context(), c)
			if err != nil {
				errs = append(errs, c.SeraphID+": "+err.Error())
			}
			rows = append(rows, erpCompanyRow{Company: c, Tenant: t})
		}
	} else {
		errs = append(errs, i18n.T(lang, "err.erp_unavailable"))
	}

	usersByTenant := map[string]int{}
	if users, err := s.pb.ListUsers(r.Context()); err == nil {
		for _, u := range users {
			usersByTenant[u.Tenant]++
		}
	}
	for i := range rows {
		if rows[i].Tenant != nil {
			rows[i].Users = usersByTenant[rows[i].Tenant.ID]
		}
	}
	var localOnly []pb.Tenant
	if items, err := s.pb.ListTenants(r.Context()); err == nil {
		for _, t := range items {
			if !erpNits[normalizeTenantNit(t.Nit)] {
				localOnly = append(localOnly, t)
			}
		}
	} else {
		errs = append(errs, err.Error())
	}

	s.render(w, "tenants.html", s.pageBase(r, map[string]any{
		"Title":         i18n.T(lang, "tenants.title"),
		"Nav":           "tenants",
		"Companies":     rows,
		"LocalTenants":  localOnly,
		"UsersByTenant": usersByTenant,
		"Flash":         r.URL.Query().Get("ok"),
		"Error":         firstNonEmpty(strings.Join(errs, " · "), r.URL.Query().Get("err")),
	}))
}

func normalizeTenantNit(nit string) string {
	return strings.ToUpper(strings.TrimSpace(nit))
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
