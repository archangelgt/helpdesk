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
	Created     string `json:"created"`
	Updated     string `json:"updated"`
}

type listResponse[T any] struct {
	Items []T `json:"items"`
}

func (c *Client) ListCategories(ctx context.Context) ([]Category, error) {
	var out listResponse[Category]
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/categories/records?sort=-id&perPage=200", nil, &out); err != nil {
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

func (c *Client) ListTickets(ctx context.Context) ([]Ticket, error) {
	var out listResponse[Ticket]
	q := "/api/collections/tickets/records?sort=-id&perPage=200"
	if err := c.doJSON(ctx, http.MethodGet, q, nil, &out); err != nil {
		return nil, err
	}
	return out.Items, nil
}

func (c *Client) CreateTicket(ctx context.Context, subject, description, categoryID, status, priority, ticketType string) (*Ticket, error) {
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
	}
	var out Ticket
	if err := c.doJSON(ctx, http.MethodPost, "/api/collections/tickets/records", payload, &out); err != nil {
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
