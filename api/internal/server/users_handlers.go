package server

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/archangelgt/helpdesk/api/internal/i18n"
	"github.com/archangelgt/helpdesk/api/internal/pb"
	"github.com/go-chi/chi/v5"
)

func (s *Server) handleUsersPage(w http.ResponseWriter, r *http.Request) {
	users, err := s.pb.ListUsers(r.Context())
	tenants, _ := s.pb.ListTenants(r.Context())
	errMsg := r.URL.Query().Get("err")
	if err != nil && errMsg == "" {
		errMsg = err.Error()
	}
	tenantNames := map[string]string{}
	for _, t := range tenants {
		tenantNames[t.ID] = t.Name
	}
	s.render(w, "users.html", s.pageBase(r, map[string]any{
		"Title":       i18n.T(langFromRequest(r), "users.title"),
		"Nav":         "users",
		"Users":       users,
		"Tenants":     tenants,
		"TenantNames": tenantNames,
		"Roles":       pb.AllRoles,
		"Permissions": pb.AllPermissions,
		"Error":       errMsg,
		"Flash":       r.URL.Query().Get("ok"),
	}))
}

func (s *Server) handleCreateUserForm(w http.ResponseWriter, r *http.Request) {
	lang := langFromRequest(r)
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/users?err=form", http.StatusSeeOther)
		return
	}
	email := strings.TrimSpace(r.FormValue("email"))
	name := strings.TrimSpace(r.FormValue("name"))
	pass := r.FormValue("password")
	role := defaultSelect(r.FormValue("role"), pb.RoleCliente)
	tenantID := strings.TrimSpace(r.FormValue("tenant"))
	perms := parseFormPerms(r)
	if email == "" || pass == "" {
		http.Redirect(w, r, "/users?err="+url.QueryEscape(i18n.T(lang, "err.register_required")), http.StatusSeeOther)
		return
	}
	if len(pass) < 6 {
		http.Redirect(w, r, "/users?err="+url.QueryEscape(i18n.T(lang, "err.register_password")), http.StatusSeeOther)
		return
	}
	if name == "" {
		name = strings.Split(email, "@")[0]
	}
	if role == pb.RoleMaestro {
		tenantID = ""
		perms = pb.DefaultPermissions(pb.RoleMaestro)
	}
	if _, err := s.pb.CreateUser(r.Context(), email, name, pass, role, tenantID, perms); err != nil {
		http.Redirect(w, r, "/users?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/users?ok="+url.QueryEscape(i18n.T(lang, "flash.user_created")), http.StatusSeeOther)
}

func (s *Server) handleUpdateUserForm(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	lang := langFromRequest(r)
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/users?err=form", http.StatusSeeOther)
		return
	}
	name := strings.TrimSpace(r.FormValue("name"))
	role := defaultSelect(r.FormValue("role"), pb.RoleCliente)
	tenantID := strings.TrimSpace(r.FormValue("tenant"))
	perms := parseFormPerms(r)
	active := r.FormValue("active") == "1" || r.FormValue("active") == "on" || r.FormValue("active") == "true"
	if role == pb.RoleMaestro {
		tenantID = ""
		perms = pb.DefaultPermissions(pb.RoleMaestro)
	}
	if _, err := s.pb.UpdateUser(r.Context(), id, name, role, tenantID, perms, active); err != nil {
		http.Redirect(w, r, "/users?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/users?ok="+url.QueryEscape(i18n.T(lang, "flash.user_updated")), http.StatusSeeOther)
}
