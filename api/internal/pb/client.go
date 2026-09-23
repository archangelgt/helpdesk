package pb

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

type Client struct {
	baseURL  string
	email    string
	password string
	http     *http.Client

	mu    sync.Mutex
	token string
}

func NewClient(baseURL, email, password string) *Client {
	return &Client{
		baseURL:  strings.TrimRight(baseURL, "/"),
		email:    email,
		password: password,
		http:     &http.Client{Timeout: 20 * time.Second},
	}
}

func (c *Client) WaitHealthy(ctx context.Context) error {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	for {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/health", nil)
		if err != nil {
			return err
		}
		resp, err := c.http.Do(req)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return nil
			}
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("timeout waiting for pocketbase: %w", ctx.Err())
		case <-ticker.C:
		}
	}
}

type Category struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Created     string `json:"created"`
	Updated     string `json:"updated"`
}

type Ticket struct {
	ID          string `json:"id"`
	Number      string `json:"number"`
	Subject     string `json:"subject"`
	Description string `json:"description"`
	Category    string `json:"category"`
	Status      string `json:"status"`
	Priority    string `json:"priority"`
	Type        string `json:"type"`
	Assignee    string `json:"assignee"`
	Created     string `json:"created"`
	Updated     string `json:"updated"`
}

type Comment struct {
	ID         string `json:"id"`
	Ticket     string `json:"ticket"`
	Body       string `json:"body"`
	Visibility string `json:"visibility"`
	Author     string `json:"author"`
	Created    string `json:"created"`
	Updated    string `json:"updated"`
}

type Stage struct {
	ID               string  `json:"id"`
	Ticket           string  `json:"ticket"`
	Name             string  `json:"name"`
	Orden            float64 `json:"orden"`
	FechaPlanInicio  string  `json:"fecha_plan_inicio"`
	FechaPlanFin     string  `json:"fecha_plan_fin"`
	Estado           string  `json:"estado"`
	Avance           float64 `json:"avance"`
	Created          string  `json:"created"`
	Updated          string  `json:"updated"`
}

type TicketFilters struct {
	Status     string
	Priority   string
	Type       string
	CategoryID string
	Q          string
}

type listResponse[T any] struct {
	Items []T `json:"items"`
}

func (c *Client) ListCategories(ctx context.Context) ([]Category, error) {
	var out listResponse[Category]
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/categories/records?sort=name&perPage=200", nil, &out); err != nil {
		return nil, err
	}
	return out.Items, nil
}

func (c *Client) CreateCategory(ctx context.Context, name, description string) (*Category, error) {
	payload := map[string]any{
		"name":        strings.TrimSpace(name),
		"description": strings.TrimSpace(description),
	}
	var out Category
	if err := c.doJSON(ctx, http.MethodPost, "/api/collections/categories/records", payload, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) GetCategory(ctx context.Context, id string) (*Category, error) {
	var out Category
	path := "/api/collections/categories/records/" + url.PathEscape(id)
	if err := c.doJSON(ctx, http.MethodGet, path, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) ListTickets(ctx context.Context, f TicketFilters) ([]Ticket, error) {
	q := url.Values{}
	q.Set("sort", "-updated,-id")
	q.Set("perPage", "200")
	var filters []string
	if f.Status != "" {
		filters = append(filters, fmt.Sprintf("status='%s'", escapeFilter(f.Status)))
	}
	if f.Priority != "" {
		filters = append(filters, fmt.Sprintf("priority='%s'", escapeFilter(f.Priority)))
	}
	if f.Type != "" {
		filters = append(filters, fmt.Sprintf("type='%s'", escapeFilter(f.Type)))
	}
	if f.CategoryID != "" {
		filters = append(filters, fmt.Sprintf("category='%s'", escapeFilter(f.CategoryID)))
	}
	if f.Q != "" {
		qq := escapeFilter(f.Q)
		filters = append(filters, fmt.Sprintf("(subject~'%s' || number~'%s' || description~'%s')", qq, qq, qq))
	}
	if len(filters) > 0 {
		q.Set("filter", strings.Join(filters, " && "))
	}
	var out listResponse[Ticket]
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/tickets/records?"+q.Encode(), nil, &out); err != nil {
		return nil, err
	}
	return out.Items, nil
}

func (c *Client) GetTicket(ctx context.Context, id string) (*Ticket, error) {
	var out Ticket
	path := "/api/collections/tickets/records/" + url.PathEscape(id)
	if err := c.doJSON(ctx, http.MethodGet, path, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) CreateTicket(ctx context.Context, subject, description, categoryID, status, priority, ticketType, assignee string) (*Ticket, error) {
	number, err := c.nextTicketNumber(ctx)
	if err != nil {
		return nil, err
	}
	payload := map[string]any{
		"number":      number,
		"subject":     strings.TrimSpace(subject),
		"description": strings.TrimSpace(description),
		"category":    categoryID,
		"status":      status,
		"priority":    priority,
		"type":        ticketType,
		"assignee":    strings.TrimSpace(assignee),
	}
	var out Ticket
	if err := c.doJSON(ctx, http.MethodPost, "/api/collections/tickets/records", payload, &out); err != nil {
		return nil, err
	}
	_, _ = c.CreateComment(ctx, out.ID, "Ticket creado.", "sistema", "sistema")
	return &out, nil
}

type TicketUpdate struct {
	Subject     *string
	Description *string
	CategoryID  *string
	Status      *string
	Priority    *string
	Type        *string
	Assignee    *string
}

func (c *Client) UpdateTicket(ctx context.Context, id string, upd TicketUpdate) (*Ticket, error) {
	before, err := c.GetTicket(ctx, id)
	if err != nil {
		return nil, err
	}
	payload := map[string]any{}
	var notes []string
	if upd.Subject != nil {
		payload["subject"] = strings.TrimSpace(*upd.Subject)
	}
	if upd.Description != nil {
		payload["description"] = strings.TrimSpace(*upd.Description)
	}
	if upd.CategoryID != nil {
		payload["category"] = *upd.CategoryID
	}
	if upd.Status != nil && *upd.Status != before.Status {
		payload["status"] = *upd.Status
		notes = append(notes, fmt.Sprintf("Estado: %s → %s", before.Status, *upd.Status))
	}
	if upd.Priority != nil && *upd.Priority != before.Priority {
		payload["priority"] = *upd.Priority
		notes = append(notes, fmt.Sprintf("Prioridad: %s → %s", before.Priority, *upd.Priority))
	}
	if upd.Type != nil {
		payload["type"] = *upd.Type
	}
	if upd.Assignee != nil {
		payload["assignee"] = strings.TrimSpace(*upd.Assignee)
		if strings.TrimSpace(*upd.Assignee) != before.Assignee {
			notes = append(notes, fmt.Sprintf("Asignado: %q → %q", before.Assignee, strings.TrimSpace(*upd.Assignee)))
		}
	}
	if len(payload) == 0 {
		return before, nil
	}
	var out Ticket
	path := "/api/collections/tickets/records/" + url.PathEscape(id)
	if err := c.doJSON(ctx, http.MethodPatch, path, payload, &out); err != nil {
		return nil, err
	}
	if len(notes) > 0 {
		_, _ = c.CreateComment(ctx, id, strings.Join(notes, "; "), "sistema", "sistema")
	}
	return &out, nil
}

func (c *Client) ListComments(ctx context.Context, ticketID string) ([]Comment, error) {
	q := url.Values{}
	q.Set("sort", "created,id")
	q.Set("perPage", "200")
	q.Set("filter", fmt.Sprintf("ticket='%s'", escapeFilter(ticketID)))
	var out listResponse[Comment]
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/comments/records?"+q.Encode(), nil, &out); err != nil {
		return nil, err
	}
	return out.Items, nil
}

func (c *Client) CreateComment(ctx context.Context, ticketID, body, visibility, author string) (*Comment, error) {
	payload := map[string]any{
		"ticket":     ticketID,
		"body":       strings.TrimSpace(body),
		"visibility": visibility,
		"author":     strings.TrimSpace(author),
	}
	var out Comment
	if err := c.doJSON(ctx, http.MethodPost, "/api/collections/comments/records", payload, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) ListStages(ctx context.Context, ticketID string) ([]Stage, error) {
	q := url.Values{}
	q.Set("sort", "orden,id")
	q.Set("perPage", "100")
	q.Set("filter", fmt.Sprintf("ticket='%s'", escapeFilter(ticketID)))
	var out listResponse[Stage]
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/stages/records?"+q.Encode(), nil, &out); err != nil {
		return nil, err
	}
	return out.Items, nil
}

func (c *Client) CreateStage(ctx context.Context, ticketID, name string, orden float64, planInicio, planFin, estado string, avance float64) (*Stage, error) {
	if estado == "" {
		estado = "pendiente"
	}
	payload := map[string]any{
		"ticket":            ticketID,
		"name":              strings.TrimSpace(name),
		"orden":             orden,
		"fecha_plan_inicio": strings.TrimSpace(planInicio),
		"fecha_plan_fin":    strings.TrimSpace(planFin),
		"estado":            estado,
		"avance":            avance,
	}
	var out Stage
	if err := c.doJSON(ctx, http.MethodPost, "/api/collections/stages/records", payload, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) UpdateStage(ctx context.Context, id, name, estado string, orden, avance float64, planInicio, planFin string) (*Stage, error) {
	payload := map[string]any{}
	if name != "" {
		payload["name"] = strings.TrimSpace(name)
	}
	if estado != "" {
		payload["estado"] = estado
	}
	payload["orden"] = orden
	payload["avance"] = avance
	payload["fecha_plan_inicio"] = strings.TrimSpace(planInicio)
	payload["fecha_plan_fin"] = strings.TrimSpace(planFin)
	var out Stage
	path := "/api/collections/stages/records/" + url.PathEscape(id)
	if err := c.doJSON(ctx, http.MethodPatch, path, payload, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) nextTicketNumber(ctx context.Context) (string, error) {
	var out listResponse[Ticket]
	q := "/api/collections/tickets/records?sort=-id&perPage=1&fields=number"
	if err := c.doJSON(ctx, http.MethodGet, q, nil, &out); err != nil {
		return "", err
	}
	n := 1
	if len(out.Items) > 0 && out.Items[0].Number != "" {
		var parsed int
		_, scanErr := fmt.Sscanf(out.Items[0].Number, "HD-%d", &parsed)
		if scanErr == nil {
			n = parsed + 1
		}
	}
	return fmt.Sprintf("HD-%05d", n), nil
}

func escapeFilter(s string) string {
	return strings.ReplaceAll(s, "'", "\\'")
}

func (c *Client) authenticate(ctx context.Context) error {
	body := map[string]string{
		"identity": c.email,
		"password": c.password,
	}
	var auth struct {
		Token string `json:"token"`
	}
	if err := c.doJSONUnauth(ctx, http.MethodPost, "/api/collections/_superusers/auth-with-password", body, &auth); err != nil {
		return fmt.Errorf("auth: %w", err)
	}
	if auth.Token == "" {
		return fmt.Errorf("auth: empty token")
	}
	c.mu.Lock()
	c.token = auth.Token
	c.mu.Unlock()
	return nil
}

func (c *Client) ensureCollection(ctx context.Context, spec map[string]any) error {
	name, _ := spec["name"].(string)
	exists, err := c.collectionExists(ctx, name)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}
	return c.doJSON(ctx, http.MethodPost, "/api/collections", spec, nil)
}

func (c *Client) collectionExists(ctx context.Context, name string) (bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/collections/"+url.PathEscape(name), nil)
	if err != nil {
		return false, err
	}
	c.mu.Lock()
	token := c.token
	c.mu.Unlock()
	req.Header.Set("Authorization", token)
	resp, err := c.http.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		return true, nil
	}
	if resp.StatusCode == http.StatusNotFound {
		return false, nil
	}
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
	return false, fmt.Errorf("get collection %s: %s (%s)", name, resp.Status, strings.TrimSpace(string(b)))
}

func (c *Client) doJSON(ctx context.Context, method, path string, payload any, out any) error {
	if err := c.ensureToken(ctx); err != nil {
		return err
	}
	return c.doJSONWithToken(ctx, method, path, payload, out, true)
}

func (c *Client) doJSONUnauth(ctx context.Context, method, path string, payload any, out any) error {
	return c.doJSONWithToken(ctx, method, path, payload, out, false)
}

func (c *Client) ensureToken(ctx context.Context) error {
	c.mu.Lock()
	ok := c.token != ""
	c.mu.Unlock()
	if ok {
		return nil
	}
	return c.authenticate(ctx)
}

func (c *Client) doJSONWithToken(ctx context.Context, method, path string, payload any, out any, authed bool) error {
	var body io.Reader
	if payload != nil {
		b, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		body = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return err
	}
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if authed {
		c.mu.Lock()
		token := c.token
		c.mu.Unlock()
		req.Header.Set("Authorization", token)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode == http.StatusUnauthorized && authed {
		if err := c.authenticate(ctx); err != nil {
			return err
		}
		return c.doJSONWithToken(ctx, method, path, payload, out, true)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("%s %s: %s (%s)", method, path, resp.Status, strings.TrimSpace(string(raw)))
	}
	if out == nil || len(raw) == 0 {
		return nil
	}
	return json.Unmarshal(raw, out)
}
