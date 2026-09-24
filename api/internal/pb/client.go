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
	Workflow    string `json:"workflow"` // implementacion | soporte
	Created     string `json:"created"`
	Updated     string `json:"updated"`
}

type Ticket struct {
	ID             string `json:"id"`
	Number         string `json:"number"`
	Subject        string `json:"subject"`
	Description    string `json:"description"`
	Category       string `json:"category"`
	Status         string `json:"status"`
	Priority       string `json:"priority"`
	Type           string `json:"type"`
	Assignee       string `json:"assignee"`
	Tenant         string `json:"tenant"`
	Requester      string `json:"requester"`
	RequesterEmail string `json:"requester_email"`
	Source         string `json:"source"`
	ExternalID     string `json:"external_id"`
	Created        string `json:"created"`
	Updated        string `json:"updated"`
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
	Status         string
	Priority       string
	Type           string
	CategoryID     string
	TenantID       string
	RequesterID    string
	RequesterEmail string
	Q              string
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

func (c *Client) CreateCategory(ctx context.Context, name, description, workflow string) (*Category, error) {
	workflow = strings.TrimSpace(workflow)
	if workflow != "soporte" {
		workflow = "implementacion"
	}
	payload := map[string]any{
		"name":        strings.TrimSpace(name),
		"description": strings.TrimSpace(description),
		"workflow":    workflow,
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

// EnsureCategoryForWorkflow returns (or creates) the internal category used for a ticket type.
// Categories are an implementation detail; plantillas drive the product UX.
func (c *Client) EnsureCategoryForWorkflow(ctx context.Context, workflow string) (*Category, error) {
	workflow = strings.TrimSpace(workflow)
	if workflow != "soporte" {
		workflow = "implementacion"
	}
	cats, err := c.ListCategories(ctx)
	if err != nil {
		return nil, err
	}
	var fallback *Category
	for i := range cats {
		cat := &cats[i]
		wf := cat.Workflow
		if wf == "" {
			lname := strings.ToLower(cat.Name)
			if strings.Contains(lname, "soporte") || strings.Contains(lname, "support") {
				wf = "soporte"
			} else {
				wf = "implementacion"
			}
		}
		if wf == workflow {
			if strings.EqualFold(cat.Name, "Soporte") || strings.EqualFold(cat.Name, "ERPSYS") {
				return cat, nil
			}
			if fallback == nil {
				fallback = cat
			}
		}
	}
	if fallback != nil {
		return fallback, nil
	}
	name, desc := "ERPSYS", "Implementaciones erpsys / ERPNext"
	if workflow == "soporte" {
		name, desc = "Soporte", "Incidencias operativas sin etapas"
	}
	return c.CreateCategory(ctx, name, desc, workflow)
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
	if f.TenantID != "" {
		filters = append(filters, fmt.Sprintf("tenant='%s'", escapeFilter(f.TenantID)))
	}
	if f.RequesterID != "" {
		filters = append(filters, fmt.Sprintf("requester='%s'", escapeFilter(f.RequesterID)))
	}
	if f.RequesterEmail != "" {
		filters = append(filters, fmt.Sprintf("requester_email='%s'", escapeFilter(strings.ToLower(f.RequesterEmail))))
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
	return c.CreateTicketFull(ctx, TicketCreate{
		Subject: subject, Description: description, CategoryID: categoryID,
		Status: status, Priority: priority, Type: ticketType, Assignee: assignee,
		Source: "ui",
	})
}

type TicketCreate struct {
	Subject        string
	Description    string
	CategoryID     string
	Status         string
	Priority       string
	Type           string
	Assignee       string
	TenantID       string
	RequesterID    string
	RequesterEmail string
	Source         string
	ExternalID     string
}

func (c *Client) CreateTicketFull(ctx context.Context, in TicketCreate) (*Ticket, error) {
	number, err := c.nextTicketNumber(ctx)
	if err != nil {
		return nil, err
	}
	if in.Status == "" {
		in.Status = "abierto"
	}
	if in.Priority == "" {
		in.Priority = "media"
	}
	if in.Type == "" {
		in.Type = "soporte"
	}
	if in.Source == "" {
		in.Source = "ui"
	}
	if strings.TrimSpace(in.CategoryID) == "" {
		cat, err := c.EnsureCategoryForWorkflow(ctx, in.Type)
		if err != nil {
			return nil, err
		}
		in.CategoryID = cat.ID
	}
	payload := map[string]any{
		"number":      number,
		"subject":     strings.TrimSpace(in.Subject),
		"description": strings.TrimSpace(in.Description),
		"category":    in.CategoryID,
		"status":      in.Status,
		"priority":    in.Priority,
		"type":        in.Type,
		"assignee":    strings.TrimSpace(in.Assignee),
		"source":      in.Source,
	}
	if in.TenantID != "" {
		payload["tenant"] = in.TenantID
	}
	if in.RequesterID != "" {
		payload["requester"] = in.RequesterID
	}
	if in.RequesterEmail != "" {
		payload["requester_email"] = strings.ToLower(strings.TrimSpace(in.RequesterEmail))
	}
	if in.ExternalID != "" {
		payload["external_id"] = strings.TrimSpace(in.ExternalID)
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
	TenantID    *string
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
	if upd.TenantID != nil {
		tid := strings.TrimSpace(*upd.TenantID)
		if tid == "" {
			payload["tenant"] = nil
		} else {
			payload["tenant"] = tid
		}
		if tid != before.Tenant {
			notes = append(notes, "Clasificación (empresa) actualizada")
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

type TicketTemplate struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Description     string `json:"description"`
	Type            string `json:"type"`
	Category        string `json:"category"`
	Priority        string `json:"priority"`
	SubjectTemplate string `json:"subject_template"`
	BodyTemplate    string `json:"body_template"`
	Created         string `json:"created"`
	Updated         string `json:"updated"`
}

type TemplateStage struct {
	ID              string  `json:"id"`
	Template        string  `json:"template"`
	Name            string  `json:"name"`
	Orden           float64 `json:"orden"`
	OffsetStartDays float64 `json:"offset_start_days"`
	DurationDays    float64 `json:"duration_days"`
	Estado          string  `json:"estado"`
	Created         string  `json:"created"`
	Updated         string  `json:"updated"`
}

func (c *Client) ListTemplates(ctx context.Context) ([]TicketTemplate, error) {
	var out listResponse[TicketTemplate]
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/ticket_templates/records?sort=name&perPage=200", nil, &out); err != nil {
		return nil, err
	}
	return out.Items, nil
}

func (c *Client) GetTemplate(ctx context.Context, id string) (*TicketTemplate, error) {
	var out TicketTemplate
	path := "/api/collections/ticket_templates/records/" + url.PathEscape(id)
	if err := c.doJSON(ctx, http.MethodGet, path, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) CreateTemplate(ctx context.Context, name, description, ticketType, categoryID, priority, subjectTpl, bodyTpl string) (*TicketTemplate, error) {
	if priority == "" {
		priority = "media"
	}
	if ticketType == "" {
		ticketType = "implementacion"
	}
	payload := map[string]any{
		"name":             strings.TrimSpace(name),
		"description":      strings.TrimSpace(description),
		"type":             ticketType,
		"priority":         priority,
		"subject_template": strings.TrimSpace(subjectTpl),
		"body_template":    strings.TrimSpace(bodyTpl),
	}
	if strings.TrimSpace(categoryID) != "" {
		payload["category"] = categoryID
	}
	var out TicketTemplate
	if err := c.doJSON(ctx, http.MethodPost, "/api/collections/ticket_templates/records", payload, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) UpdateTemplate(ctx context.Context, id, name, description, ticketType, categoryID, priority, subjectTpl, bodyTpl string) (*TicketTemplate, error) {
	payload := map[string]any{
		"name":             strings.TrimSpace(name),
		"description":      strings.TrimSpace(description),
		"type":             ticketType,
		"priority":         priority,
		"subject_template": strings.TrimSpace(subjectTpl),
		"body_template":    strings.TrimSpace(bodyTpl),
	}
	if strings.TrimSpace(categoryID) != "" {
		payload["category"] = categoryID
	} else {
		payload["category"] = nil
	}
	var out TicketTemplate
	path := "/api/collections/ticket_templates/records/" + url.PathEscape(id)
	if err := c.doJSON(ctx, http.MethodPatch, path, payload, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) ListTemplateStages(ctx context.Context, templateID string) ([]TemplateStage, error) {
	q := url.Values{}
	q.Set("sort", "orden,id")
	q.Set("perPage", "100")
	q.Set("filter", fmt.Sprintf("template='%s'", escapeFilter(templateID)))
	var out listResponse[TemplateStage]
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/template_stages/records?"+q.Encode(), nil, &out); err != nil {
		return nil, err
	}
	return out.Items, nil
}

func (c *Client) CreateTemplateStage(ctx context.Context, templateID, name string, orden, offsetStart, duration float64, estado string) (*TemplateStage, error) {
	if estado == "" {
		estado = "pendiente"
	}
	payload := map[string]any{
		"template":          templateID,
		"name":              strings.TrimSpace(name),
		"orden":             orden,
		"offset_start_days": offsetStart,
		"duration_days":     duration,
		"estado":            estado,
	}
	var out TemplateStage
	if err := c.doJSON(ctx, http.MethodPost, "/api/collections/template_stages/records", payload, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) DeleteTemplateStage(ctx context.Context, id string) error {
	path := "/api/collections/template_stages/records/" + url.PathEscape(id)
	return c.doJSON(ctx, http.MethodDelete, path, nil, nil)
}

// CreateTicketFromTemplate creates a ticket and copies template stages with dates from startDate (YYYY-MM-DD) or today.
func (c *Client) CreateTicketFromTemplate(ctx context.Context, templateID, clientName, subject, description, categoryID, status, priority, ticketType, assignee, startDate string) (*Ticket, error) {
	return c.CreateTicketFromTemplateOpts(ctx, TemplateTicketOpts{
		TemplateID: templateID, ClientName: clientName, Subject: subject, Description: description,
		CategoryID: categoryID, Status: status, Priority: priority, Type: ticketType,
		Assignee: assignee, StartDate: startDate,
	})
}

type TemplateTicketOpts struct {
	TemplateID     string
	ClientName     string
	Subject        string
	Description    string
	CategoryID     string
	Status         string
	Priority       string
	Type           string
	Assignee       string
	StartDate      string
	TenantID       string
	RequesterID    string
	RequesterEmail string
}

func (c *Client) CreateTicketFromTemplateOpts(ctx context.Context, opts TemplateTicketOpts) (*Ticket, error) {
	tpl, err := c.GetTemplate(ctx, opts.TemplateID)
	if err != nil {
		return nil, err
	}
	subject := opts.Subject
	clientName := opts.ClientName
	description := opts.Description
	categoryID := opts.CategoryID
	priority := opts.Priority
	ticketType := opts.Type
	status := opts.Status
	if subject == "" {
		subject = tpl.SubjectTemplate
		if clientName != "" && subject != "" {
			subject = strings.ReplaceAll(subject, "{{cliente}}", clientName)
		}
		if subject == "" && clientName != "" {
			subject = tpl.Name + " — " + clientName
		}
		if subject == "" {
			subject = tpl.Name
		}
	} else if clientName != "" {
		subject = strings.ReplaceAll(subject, "{{cliente}}", clientName)
	}
	if description == "" {
		description = tpl.BodyTemplate
		description = strings.ReplaceAll(description, "{{cliente}}", clientName)
	}
	if categoryID == "" {
		categoryID = tpl.Category
	}
	if priority == "" {
		priority = tpl.Priority
	}
	if ticketType == "" {
		ticketType = tpl.Type
	}
	if status == "" {
		status = "abierto"
	}
	if categoryID == "" {
		cat, err := c.EnsureCategoryForWorkflow(ctx, ticketType)
		if err != nil {
			return nil, err
		}
		categoryID = cat.ID
	}
	reqEmail := opts.RequesterEmail
	if reqEmail == "" && clientName != "" {
		reqEmail = ""
	}
	ticket, err := c.CreateTicketFull(ctx, TicketCreate{
		Subject: subject, Description: description, CategoryID: categoryID,
		Status: status, Priority: priority, Type: ticketType, Assignee: opts.Assignee,
		TenantID: opts.TenantID, RequesterID: opts.RequesterID, RequesterEmail: reqEmail,
		Source: "ui",
	})
	if err != nil {
		return nil, err
	}
	stages, err := c.ListTemplateStages(ctx, opts.TemplateID)
	if err != nil {
		return ticket, nil
	}
	base := time.Now()
	if opts.StartDate != "" {
		if parsed, perr := time.Parse("2006-01-02", opts.StartDate); perr == nil {
			base = parsed
		}
	}
	for _, st := range stages {
		start := base.AddDate(0, 0, int(st.OffsetStartDays))
		dur := int(st.DurationDays)
		if dur <= 0 {
			dur = 1
		}
		end := start.AddDate(0, 0, dur)
		estado := st.Estado
		if estado == "" {
			estado = "pendiente"
		}
		_, _ = c.CreateStage(ctx, ticket.ID, st.Name, st.Orden, start.Format("2006-01-02"), end.Format("2006-01-02"), estado, 0)
	}
	_, _ = c.CreateComment(ctx, ticket.ID, "Creado desde plantilla: "+tpl.Name, "sistema", "sistema")
	return ticket, nil
}

func (c *Client) nextTicketNumber(ctx context.Context) (string, error) {
	var out listResponse[Ticket]
	q := "/api/collections/tickets/records?sort=-id&perPage=200&fields=number"
	if err := c.doJSON(ctx, http.MethodGet, q, nil, &out); err != nil {
		return "", err
	}
	n := 0
	for _, item := range out.Items {
		var parsed int
		if _, scanErr := fmt.Sscanf(item.Number, "HD-%d", &parsed); scanErr == nil && parsed > n {
			n = parsed
		}
	}
	return fmt.Sprintf("HD-%05d", n+1), nil
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
