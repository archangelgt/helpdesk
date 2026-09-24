package pb

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

type Tenant struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Slug    string `json:"slug"`
	Nit     string `json:"nit"`
	Created string `json:"created"`
	Updated string `json:"updated"`
}

type AppUser struct {
	ID           string `json:"id"`
	Email        string `json:"email"`
	Name         string `json:"name"`
	PasswordHash string `json:"password_hash"`
	Role         string `json:"role"` // maestro | cliente
	Tenant       string `json:"tenant"`
	Active       bool   `json:"active"`
	Created      string `json:"created"`
	Updated      string `json:"updated"`
}

type APIKey struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	KeyHash   string `json:"key_hash"`
	KeyPrefix string `json:"key_prefix"`
	Tenant    string `json:"tenant"`
	Channel   string `json:"channel"`
	Active    bool   `json:"active"`
	Created   string `json:"created"`
	Updated   string `json:"updated"`
}

func HashPassword(password string) string {
	salt := make([]byte, 8)
	_, _ = rand.Read(salt)
	sum := sha256.Sum256(append(salt, []byte(password)...))
	return "sha256$" + hex.EncodeToString(salt) + "$" + hex.EncodeToString(sum[:])
}

func CheckPassword(stored, password string) bool {
	parts := strings.Split(stored, "$")
	if len(parts) != 3 || parts[0] != "sha256" {
		return false
	}
	salt, err := hex.DecodeString(parts[1])
	if err != nil {
		return false
	}
	sum := sha256.Sum256(append(salt, []byte(password)...))
	return hex.EncodeToString(sum[:]) == parts[2]
}

func HashAPIKey(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func (c *Client) ListTenants(ctx context.Context) ([]Tenant, error) {
	var out listResponse[Tenant]
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/tenants/records?sort=name&perPage=200", nil, &out); err != nil {
		return nil, err
	}
	return out.Items, nil
}

func (c *Client) GetTenant(ctx context.Context, id string) (*Tenant, error) {
	var out Tenant
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/tenants/records/"+url.PathEscape(id), nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) GetTenantBySlug(ctx context.Context, slug string) (*Tenant, error) {
	q := url.Values{}
	q.Set("filter", fmt.Sprintf("slug='%s'", escapeFilter(slug)))
	q.Set("perPage", "1")
	var out listResponse[Tenant]
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/tenants/records?"+q.Encode(), nil, &out); err != nil {
		return nil, err
	}
	if len(out.Items) == 0 {
		return nil, fmt.Errorf("tenant not found: %s", slug)
	}
	return &out.Items[0], nil
}

func (c *Client) GetTenantByNit(ctx context.Context, nit string) (*Tenant, error) {
	nit = normalizeNIT(nit)
	if nit == "" {
		return nil, fmt.Errorf("tenant not found: empty nit")
	}
	q := url.Values{}
	q.Set("filter", fmt.Sprintf("nit='%s'", escapeFilter(nit)))
	q.Set("perPage", "1")
	var out listResponse[Tenant]
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/tenants/records?"+q.Encode(), nil, &out); err != nil {
		return nil, err
	}
	if len(out.Items) == 0 {
		return nil, fmt.Errorf("tenant not found: %s", nit)
	}
	return &out.Items[0], nil
}

func normalizeNIT(nit string) string {
	nit = strings.TrimSpace(nit)
	nit = strings.ToUpper(nit)
	return nit
}

func (c *Client) CreateTenant(ctx context.Context, name, slug, nit string) (*Tenant, error) {
	payload := map[string]any{
		"name": strings.TrimSpace(name),
		"slug": strings.TrimSpace(slug),
		"nit":  normalizeNIT(nit),
	}
	var out Tenant
	if err := c.doJSON(ctx, http.MethodPost, "/api/collections/tenants/records", payload, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) UpdateTenant(ctx context.Context, id, name, slug, nit string) (*Tenant, error) {
	payload := map[string]any{
		"name": strings.TrimSpace(name),
		"slug": strings.TrimSpace(slug),
		"nit":  normalizeNIT(nit),
	}
	var out Tenant
	if err := c.doJSON(ctx, http.MethodPatch, "/api/collections/tenants/records/"+url.PathEscape(id), payload, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) EnsureTenant(ctx context.Context, name, slug, nit string) (*Tenant, error) {
	nit = normalizeNIT(nit)
	if t, err := c.GetTenantBySlug(ctx, slug); err == nil {
		if strings.TrimSpace(t.Nit) == "" && nit != "" {
			return c.UpdateTenant(ctx, t.ID, t.Name, t.Slug, nit)
		}
		return t, nil
	}
	if nit != "" {
		if t, err := c.GetTenantByNit(ctx, nit); err == nil {
			return t, nil
		}
	}
	return c.CreateTenant(ctx, name, slug, nit)
}

func (c *Client) GetUserByEmail(ctx context.Context, email string) (*AppUser, error) {
	q := url.Values{}
	q.Set("filter", fmt.Sprintf("email='%s'", escapeFilter(strings.ToLower(strings.TrimSpace(email)))))
	q.Set("perPage", "1")
	var out listResponse[AppUser]
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/app_users/records?"+q.Encode(), nil, &out); err != nil {
		return nil, err
	}
	if len(out.Items) == 0 {
		return nil, fmt.Errorf("user not found")
	}
	return &out.Items[0], nil
}

func (c *Client) GetUser(ctx context.Context, id string) (*AppUser, error) {
	var out AppUser
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/app_users/records/"+url.PathEscape(id), nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) CreateUser(ctx context.Context, email, name, password, role, tenantID string) (*AppUser, error) {
	payload := map[string]any{
		"email":         strings.ToLower(strings.TrimSpace(email)),
		"name":          strings.TrimSpace(name),
		"password_hash": HashPassword(password),
		"role":          role,
		"active":        true,
	}
	if tenantID != "" {
		payload["tenant"] = tenantID
	}
	var out AppUser
	if err := c.doJSON(ctx, http.MethodPost, "/api/collections/app_users/records", payload, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) EnsureUser(ctx context.Context, email, name, password, role, tenantID string) (*AppUser, error) {
	if u, err := c.GetUserByEmail(ctx, email); err == nil {
		return u, nil
	}
	return c.CreateUser(ctx, email, name, password, role, tenantID)
}

func (c *Client) FindAPIKeyByRaw(ctx context.Context, raw string) (*APIKey, error) {
	hash := HashAPIKey(raw)
	q := url.Values{}
	q.Set("filter", fmt.Sprintf("key_hash='%s' && active=true", escapeFilter(hash)))
	q.Set("perPage", "1")
	var out listResponse[APIKey]
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/api_keys/records?"+q.Encode(), nil, &out); err != nil {
		return nil, err
	}
	if len(out.Items) == 0 {
		return nil, fmt.Errorf("invalid api key")
	}
	return &out.Items[0], nil
}

func (c *Client) CreateAPIKey(ctx context.Context, name, raw, tenantID, channel string) (*APIKey, error) {
	if channel == "" {
		channel = "generic"
	}
	prefix := raw
	if len(prefix) > 12 {
		prefix = prefix[:12]
	}
	payload := map[string]any{
		"name":       strings.TrimSpace(name),
		"key_hash":   HashAPIKey(raw),
		"key_prefix": prefix,
		"tenant":     tenantID,
		"channel":    channel,
		"active":     true,
	}
	var out APIKey
	if err := c.doJSON(ctx, http.MethodPost, "/api/collections/api_keys/records", payload, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) EnsureAPIKey(ctx context.Context, name, raw, tenantID, channel string) error {
	hash := HashAPIKey(raw)
	q := url.Values{}
	q.Set("filter", fmt.Sprintf("key_hash='%s'", escapeFilter(hash)))
	q.Set("perPage", "1")
	var out listResponse[APIKey]
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/api_keys/records?"+q.Encode(), nil, &out); err != nil {
		return err
	}
	if len(out.Items) > 0 {
		return nil
	}
	_, err := c.CreateAPIKey(ctx, name, raw, tenantID, channel)
	return err
}

func (c *Client) GetTicketByExternalID(ctx context.Context, tenantID, externalID string) (*Ticket, error) {
	q := url.Values{}
	q.Set("filter", fmt.Sprintf("tenant='%s' && external_id='%s'", escapeFilter(tenantID), escapeFilter(externalID)))
	q.Set("perPage", "1")
	var out listResponse[Ticket]
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/tickets/records?"+q.Encode(), nil, &out); err != nil {
		return nil, err
	}
	if len(out.Items) == 0 {
		return nil, fmt.Errorf("ticket not found")
	}
	return &out.Items[0], nil
}
