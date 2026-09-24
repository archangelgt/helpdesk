package server

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"github.com/archangelgt/helpdesk/api/internal/i18n"
	"github.com/archangelgt/helpdesk/api/internal/pb"
)

type ctxKey string

const (
	ctxUser  ctxKey = "user"
	ctxLang  ctxKey = "lang"
	ctxTheme ctxKey = "theme"
)

const (
	cookieSession = "hd_session"
	cookieLang    = "hd_lang"
	cookieTheme   = "hd_theme"
	sessionTTL    = 14 * 24 * time.Hour
)

func langFromRequest(r *http.Request) i18n.Lang {
	if c, err := r.Cookie(cookieLang); err == nil {
		return i18n.Parse(c.Value)
	}
	return i18n.ES
}

func themeFromRequest(r *http.Request) string {
	if c, err := r.Cookie(cookieTheme); err == nil {
		switch c.Value {
		case "light", "dark", "auto":
			return c.Value
		}
	}
	return "light"
}

func setPrefCookie(w http.ResponseWriter, name, value string) {
	http.SetCookie(w, &http.Cookie{
		Name: name, Value: value, Path: "/", MaxAge: 365 * 24 * 3600,
		HttpOnly: false, SameSite: http.SameSiteLaxMode,
	})
}

func (s *Server) signSession(userID string, exp time.Time) string {
	payload := userID + "|" + exp.UTC().Format(time.RFC3339)
	mac := hmac.New(sha256.New, []byte(s.cfg.SessionSecret))
	_, _ = mac.Write([]byte(payload))
	sig := hex.EncodeToString(mac.Sum(nil))
	return base64.RawURLEncoding.EncodeToString([]byte(payload + "|" + sig))
}

func (s *Server) parseSession(raw string) (string, bool) {
	b, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return "", false
	}
	parts := strings.Split(string(b), "|")
	if len(parts) != 3 {
		return "", false
	}
	userID, expStr, sig := parts[0], parts[1], parts[2]
	exp, err := time.Parse(time.RFC3339, expStr)
	if err != nil || time.Now().After(exp) {
		return "", false
	}
	mac := hmac.New(sha256.New, []byte(s.cfg.SessionSecret))
	_, _ = mac.Write([]byte(userID + "|" + expStr))
	want := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(want), []byte(sig)) {
		return "", false
	}
	return userID, true
}

func (s *Server) setSession(w http.ResponseWriter, userID string) {
	exp := time.Now().Add(sessionTTL)
	http.SetCookie(w, &http.Cookie{
		Name: cookieSession, Value: s.signSession(userID, exp), Path: "/",
		MaxAge: int(sessionTTL.Seconds()), HttpOnly: true, SameSite: http.SameSiteLaxMode,
	})
}

func (s *Server) clearSession(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name: cookieSession, Value: "", Path: "/", MaxAge: -1, HttpOnly: true,
	})
}

func (s *Server) loadUser(r *http.Request) *pb.AppUser {
	c, err := r.Cookie(cookieSession)
	if err != nil || c.Value == "" {
		return nil
	}
	uid, ok := s.parseSession(c.Value)
	if !ok {
		return nil
	}
	u, err := s.pb.GetUser(r.Context(), uid)
	if err != nil || !u.Active {
		return nil
	}
	return u
}

func userFrom(ctx context.Context) *pb.AppUser {
	u, _ := ctx.Value(ctxUser).(*pb.AppUser)
	return u
}

func (s *Server) withPrefs(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		lang := langFromRequest(r)
		theme := themeFromRequest(r)
		ctx := context.WithValue(r.Context(), ctxLang, lang)
		ctx = context.WithValue(ctx, ctxTheme, theme)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (s *Server) requireAuth(roles ...string) func(http.Handler) http.Handler {
	roleSet := map[string]bool{}
	for _, r := range roles {
		roleSet[r] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			u := s.loadUser(r)
			if u == nil {
				http.Redirect(w, r, "/login?next="+r.URL.RequestURI(), http.StatusSeeOther)
				return
			}
			if len(roleSet) > 0 && !roleSet[u.Role] {
				if u.Role == "cliente" {
					http.Redirect(w, r, "/portal", http.StatusSeeOther)
					return
				}
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
			ctx := context.WithValue(r.Context(), ctxUser, u)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func (s *Server) pageBase(r *http.Request, extra map[string]any) map[string]any {
	lang := langFromRequest(r)
	theme := themeFromRequest(r)
	u := userFrom(r.Context())
	if u == nil {
		u = s.loadUser(r)
	}
	m := map[string]any{
		"Lang":   lang.String(),
		"Theme":  theme,
		"T":      i18n.Func(lang),
		"User":   u,
		"IsAuth": u != nil,
	}
	for k, v := range extra {
		m[k] = v
	}
	return m
}
