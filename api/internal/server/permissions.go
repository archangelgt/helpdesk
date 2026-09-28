package server

import (
	"net/http"
	"net/url"

	"github.com/archangelgt/helpdesk/api/internal/i18n"
	"github.com/archangelgt/helpdesk/api/internal/pb"
)

func (s *Server) requirePerm(perm string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			u := userFrom(r.Context())
			if u == nil || !u.HasPerm(perm) {
				lang := langFromRequest(r)
				if u != nil && u.IsCliente() {
					http.Redirect(w, r, "/portal?err="+url.QueryEscape(i18n.T(lang, "err.forbidden")), http.StatusSeeOther)
					return
				}
				http.Error(w, i18n.T(lang, "err.forbidden"), http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func permFlags(u *pb.AppUser) map[string]any {
	return map[string]any{
		"IsStaff":    u != nil && u.IsStaff(),
		"IsAdmin":    u != nil && u.HasPerm(pb.PermAdmin),
		"CanCreate":  u != nil && u.HasPerm(pb.PermCrear),
		"CanEdit":    u != nil && u.HasPerm(pb.PermEditar),
		"CanResolve": u != nil && u.HasPerm(pb.PermResolver),
		"CanAdmin":   u != nil && u.HasPerm(pb.PermAdmin),
	}
}

func homeForUser(u *pb.AppUser) string {
	if u == nil {
		return "/login"
	}
	if u.IsStaff() {
		return "/board"
	}
	return "/portal"
}
