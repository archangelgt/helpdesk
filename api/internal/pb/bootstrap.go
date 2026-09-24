package pb

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

func (c *Client) Bootstrap(ctx context.Context) error {
	if err := c.authenticate(ctx); err != nil {
		return err
	}
	if err := c.ensureCollection(ctx, categoriesCollection()); err != nil {
		return fmt.Errorf("categories collection: %w", err)
	}
	if err := c.ensureCategoryFields(ctx); err != nil {
		return fmt.Errorf("category fields: %w", err)
	}
	catID, err := c.collectionID(ctx, "categories")
	if err != nil {
		return fmt.Errorf("categories id: %w", err)
	}
	if err := c.ensureCollection(ctx, tenantsCollection()); err != nil {
		return fmt.Errorf("tenants collection: %w", err)
	}
	if err := c.ensureTenantFields(ctx); err != nil {
		return fmt.Errorf("tenant fields: %w", err)
	}
	tenantColID, err := c.collectionID(ctx, "tenants")
	if err != nil {
		return fmt.Errorf("tenants id: %w", err)
	}
	if err := c.ensureCollection(ctx, ticketsCollection(catID)); err != nil {
		return fmt.Errorf("tickets collection: %w", err)
	}
	if err := c.ensureTicketExtraFields(ctx, tenantColID, ""); err != nil {
		return fmt.Errorf("ticket fields: %w", err)
	}
	ticketID, err := c.collectionID(ctx, "tickets")
	if err != nil {
		return fmt.Errorf("tickets id: %w", err)
	}
	if err := c.ensureCollection(ctx, commentsCollection(ticketID)); err != nil {
		return fmt.Errorf("comments collection: %w", err)
	}
	if err := c.ensureCollection(ctx, stagesCollection(ticketID)); err != nil {
		return fmt.Errorf("stages collection: %w", err)
	}
	if err := c.ensureNumberOrdenOptional(ctx, "stages"); err != nil {
		return fmt.Errorf("stages fields: %w", err)
	}
	stageColID, err := c.collectionID(ctx, "stages")
	if err != nil {
		return fmt.Errorf("stages id: %w", err)
	}
	if err := c.ensureCollection(ctx, attachmentsCollection(ticketID, stageColID)); err != nil {
		return fmt.Errorf("ticket_attachments collection: %w", err)
	}
	if err := c.ensureCollection(ctx, ticketTemplatesCollection(catID)); err != nil {
		return fmt.Errorf("ticket_templates collection: %w", err)
	}
	tplID, err := c.collectionID(ctx, "ticket_templates")
	if err != nil {
		return fmt.Errorf("ticket_templates id: %w", err)
	}
	if err := c.ensureCollection(ctx, templateStagesCollection(tplID)); err != nil {
		return fmt.Errorf("template_stages collection: %w", err)
	}
	if err := c.ensureNumberOrdenOptional(ctx, "template_stages"); err != nil {
		return fmt.Errorf("template_stages fields: %w", err)
	}
	if err := c.migrateBloqueadaToPausada(ctx); err != nil {
		return fmt.Errorf("stage estado migration: %w", err)
	}
	if err := c.ensureCollection(ctx, appUsersCollection(tenantColID)); err != nil {
		return fmt.Errorf("app_users collection: %w", err)
	}
	userColID, err := c.collectionID(ctx, "app_users")
	if err != nil {
		return fmt.Errorf("app_users id: %w", err)
	}
	if err := c.ensureTicketExtraFields(ctx, tenantColID, userColID); err != nil {
		return fmt.Errorf("ticket requester field: %w", err)
	}
	if err := c.ensureCollection(ctx, apiKeysCollection(tenantColID)); err != nil {
		return fmt.Errorf("api_keys collection: %w", err)
	}
	if err := c.seedDemoData(ctx); err != nil {
		return fmt.Errorf("seed: %w", err)
	}
	return nil
}

type collectionMeta struct {
	ID     string           `json:"id"`
	Name   string           `json:"name"`
	Fields []map[string]any `json:"fields"`
	Type   string           `json:"type"`
}

func (c *Client) collectionID(ctx context.Context, name string) (string, error) {
	var meta collectionMeta
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/"+name, nil, &meta); err != nil {
		return "", err
	}
	if meta.ID == "" {
		return "", fmt.Errorf("empty id for collection %s", name)
	}
	return meta.ID, nil
}

func (c *Client) ensureTicketExtraFields(ctx context.Context, tenantColID, userColID string) error {
	var meta collectionMeta
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/tickets", nil, &meta); err != nil {
		return err
	}
	have := map[string]bool{}
	for _, f := range meta.Fields {
		if n, ok := f["name"].(string); ok {
			have[n] = true
		}
	}
	fields := append([]map[string]any{}, meta.Fields...)
	changed := false
	add := func(f map[string]any) {
		fields = append(fields, f)
		changed = true
	}
	if !have["assignee"] {
		add(map[string]any{"name": "assignee", "type": "text", "required": false, "max": 120})
	}
	if !have["created"] {
		add(map[string]any{"name": "created", "type": "autodate", "onCreate": true, "onUpdate": false})
	}
	if !have["updated"] {
		add(map[string]any{"name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true})
	}
	if !have["requester_email"] {
		add(map[string]any{"name": "requester_email", "type": "text", "required": false, "max": 200})
	}
	if !have["source"] {
		add(map[string]any{
			"name": "source", "type": "select", "required": false, "maxSelect": 1,
			"values": []string{"ui", "api", "email", "whatsapp", "chat"},
		})
	}
	if !have["external_id"] {
		add(map[string]any{"name": "external_id", "type": "text", "required": false, "max": 200})
	}
	if tenantColID != "" && !have["tenant"] {
		add(map[string]any{
			"name": "tenant", "type": "relation", "required": false,
			"collectionId": tenantColID, "maxSelect": 1, "cascadeDelete": false,
		})
	}
	if userColID != "" && !have["requester"] {
		add(map[string]any{
			"name": "requester", "type": "relation", "required": false,
			"collectionId": userColID, "maxSelect": 1, "cascadeDelete": false,
		})
	}
	if !changed {
		return nil
	}
	return c.doJSON(ctx, http.MethodPatch, "/api/collections/tickets", map[string]any{"fields": fields}, nil)
}

func (c *Client) seedDemoData(ctx context.Context) error {
	cap, err := c.EnsureTenant(ctx, "Cap World", "cap-world", "900123456")
	if err != nil {
		return err
	}
	power, err := c.EnsureTenant(ctx, "Power Tech", "power-tech", "900654321")
	if err != nil {
		return err
	}
	if _, err := c.EnsureUser(ctx, "maestro@helpdesk.local", "Maestro Helpdesk", "maestro123", "maestro", ""); err != nil {
		return err
	}
	if _, err := c.EnsureUser(ctx, "cliente.cap@helpdesk.local", "Cliente Cap World", "cliente123", "cliente", cap.ID); err != nil {
		return err
	}
	if _, err := c.EnsureUser(ctx, "cliente.power@helpdesk.local", "Cliente Power Tech", "cliente123", "cliente", power.ID); err != nil {
		return err
	}
	if err := c.EnsureAPIKey(ctx, "Cap World chat/API", "hd_cap_demo_key_change_me", cap.ID, "chat"); err != nil {
		return err
	}
	if err := c.EnsureAPIKey(ctx, "Power Tech chat/API", "hd_power_demo_key_change_me", power.ID, "chat"); err != nil {
		return err
	}
	_ = c.ensureDemoCategories(ctx)
	return nil
}

func (c *Client) ensureDemoCategories(ctx context.Context) error {
	cats, err := c.ListCategories(ctx)
	if err != nil {
		return err
	}
	byName := map[string]Category{}
	for _, cat := range cats {
		byName[strings.ToLower(cat.Name)] = cat
		if cat.Workflow == "" {
			wf := "implementacion"
			lname := strings.ToLower(cat.Name)
			if strings.Contains(lname, "soporte") || strings.Contains(lname, "support") {
				wf = "soporte"
			}
			_ = c.doJSON(ctx, http.MethodPatch, "/api/collections/categories/records/"+cat.ID, map[string]any{"workflow": wf}, nil)
		}
	}
	if _, ok := byName["erpsys"]; !ok {
		if _, err := c.CreateCategory(ctx, "ERPSYS", "Implementaciones erpsys / ERPNext", "implementacion"); err != nil {
			return err
		}
	}
	if _, ok := byName["soporte chat"]; !ok {
		if _, err := c.CreateCategory(ctx, "Soporte Chat", "Incidencias operativas sin etapas", "soporte"); err != nil {
			return err
		}
	}
	return nil
}

func categoriesCollection() map[string]any {
	return map[string]any{
		"name":       "categories",
		"type":       "base",
		"listRule":   nil,
		"viewRule":   nil,
		"createRule": nil,
		"updateRule": nil,
		"deleteRule": nil,
		"fields": []map[string]any{
			{"name": "name", "type": "text", "required": true, "max": 120},
			{"name": "description", "type": "text", "required": false, "max": 500},
			{
				"name": "workflow", "type": "select", "required": true, "maxSelect": 1,
				"values": []string{"implementacion", "soporte"},
			},
			{"name": "created", "type": "autodate", "onCreate": true, "onUpdate": false},
			{"name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true},
		},
		"indexes": []string{
			"CREATE UNIQUE INDEX idx_categories_name ON categories (`name`)",
		},
	}
}

func (c *Client) ensureCategoryFields(ctx context.Context) error {
	var meta collectionMeta
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/categories", nil, &meta); err != nil {
		return err
	}
	have := map[string]bool{}
	for _, f := range meta.Fields {
		if n, ok := f["name"].(string); ok {
			have[n] = true
		}
	}
	if have["workflow"] {
		return nil
	}
	fields := append([]map[string]any{}, meta.Fields...)
	fields = append(fields, map[string]any{
		"name": "workflow", "type": "select", "required": false, "maxSelect": 1,
		"values": []string{"implementacion", "soporte"},
	})
	return c.doJSON(ctx, http.MethodPatch, "/api/collections/categories", map[string]any{"fields": fields}, nil)
}

func tenantsCollection() map[string]any {
	return map[string]any{
		"name": "tenants", "type": "base",
		"listRule": nil, "viewRule": nil, "createRule": nil, "updateRule": nil, "deleteRule": nil,
		"fields": []map[string]any{
			{"name": "name", "type": "text", "required": true, "max": 160},
			{"name": "slug", "type": "text", "required": true, "max": 80},
			{"name": "nit", "type": "text", "required": true, "max": 40},
			{"name": "created", "type": "autodate", "onCreate": true, "onUpdate": false},
			{"name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true},
		},
		"indexes": []string{
			"CREATE UNIQUE INDEX idx_tenants_slug ON tenants (`slug`)",
			"CREATE UNIQUE INDEX idx_tenants_nit ON tenants (`nit`)",
		},
	}
}

func (c *Client) ensureTenantFields(ctx context.Context) error {
	var meta collectionMeta
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/tenants", nil, &meta); err != nil {
		return err
	}
	have := map[string]bool{}
	for _, f := range meta.Fields {
		if n, ok := f["name"].(string); ok {
			have[n] = true
		}
	}
	fields := append([]map[string]any{}, meta.Fields...)
	changed := false
	if !have["nit"] {
		fields = append(fields, map[string]any{"name": "nit", "type": "text", "required": false, "max": 40})
		changed = true
	}
	indexes := []string{
		"CREATE UNIQUE INDEX idx_tenants_slug ON tenants (`slug`)",
		"CREATE UNIQUE INDEX idx_tenants_nit ON tenants (`nit`)",
	}
	payload := map[string]any{"indexes": indexes}
	if changed {
		payload["fields"] = fields
	}
	if err := c.doJSON(ctx, http.MethodPatch, "/api/collections/tenants", payload, nil); err != nil {
		// Index may already exist; retry fields-only if needed.
		if changed {
			if err2 := c.doJSON(ctx, http.MethodPatch, "/api/collections/tenants", map[string]any{"fields": fields}, nil); err2 != nil {
				return err2
			}
		}
	}
	return nil
}

func appUsersCollection(tenantColID string) map[string]any {
	return map[string]any{
		"name": "app_users", "type": "base",
		"listRule": nil, "viewRule": nil, "createRule": nil, "updateRule": nil, "deleteRule": nil,
		"fields": []map[string]any{
			{"name": "email", "type": "text", "required": true, "max": 200},
			{"name": "name", "type": "text", "required": true, "max": 160},
			{"name": "password_hash", "type": "text", "required": true, "max": 200},
			{
				"name": "role", "type": "select", "required": true, "maxSelect": 1,
				"values": []string{"maestro", "cliente"},
			},
			{
				"name": "tenant", "type": "relation", "required": false,
				"collectionId": tenantColID, "maxSelect": 1, "cascadeDelete": false,
			},
			{"name": "active", "type": "bool", "required": false},
			{"name": "created", "type": "autodate", "onCreate": true, "onUpdate": false},
			{"name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true},
		},
		"indexes": []string{
			"CREATE UNIQUE INDEX idx_app_users_email ON app_users (`email`)",
		},
	}
}

func apiKeysCollection(tenantColID string) map[string]any {
	return map[string]any{
		"name": "api_keys", "type": "base",
		"listRule": nil, "viewRule": nil, "createRule": nil, "updateRule": nil, "deleteRule": nil,
		"fields": []map[string]any{
			{"name": "name", "type": "text", "required": true, "max": 120},
			{"name": "key_hash", "type": "text", "required": true, "max": 128},
			{"name": "key_prefix", "type": "text", "required": false, "max": 32},
			{
				"name": "tenant", "type": "relation", "required": true,
				"collectionId": tenantColID, "maxSelect": 1, "cascadeDelete": true,
			},
			{
				"name": "channel", "type": "select", "required": true, "maxSelect": 1,
				"values": []string{"generic", "chat", "email", "whatsapp"},
			},
			{"name": "active", "type": "bool", "required": false},
			{"name": "created", "type": "autodate", "onCreate": true, "onUpdate": false},
			{"name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true},
		},
		"indexes": []string{
			"CREATE UNIQUE INDEX idx_api_keys_hash ON api_keys (`key_hash`)",
		},
	}
}

// PocketBase treats numeric 0 as blank when required=true; orden must allow 0.
func (c *Client) ensureNumberOrdenOptional(ctx context.Context, collection string) error {
	var meta collectionMeta
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/"+collection, nil, &meta); err != nil {
		return err
	}
	fields := append([]map[string]any{}, meta.Fields...)
	changed := false
	for i, f := range fields {
		name, _ := f["name"].(string)
		if name != "orden" && name != "offset_start_days" && name != "duration_days" && name != "avance" {
			continue
		}
		if req, ok := f["required"].(bool); ok && req {
			fields[i]["required"] = false
			changed = true
		}
	}
	if !changed {
		return nil
	}
	return c.doJSON(ctx, http.MethodPatch, "/api/collections/"+collection, map[string]any{"fields": fields}, nil)
}

func (c *Client) migrateBloqueadaToPausada(ctx context.Context) error {
	for _, col := range []string{"stages", "template_stages"} {
		both := []string{"pendiente", "en_curso", "hecha", "bloqueada", "pausada"}
		final := []string{"pendiente", "en_curso", "hecha", "pausada"}
		if err := c.setSelectValues(ctx, col, "estado", both); err != nil {
			return err
		}
		q := "/api/collections/" + col + "/records?perPage=200&filter=" + url.QueryEscape("estado='bloqueada'")
		var out listResponse[struct {
			ID string `json:"id"`
		}]
		if err := c.doJSON(ctx, http.MethodGet, q, nil, &out); err == nil {
			for _, item := range out.Items {
				_ = c.doJSON(ctx, http.MethodPatch, "/api/collections/"+col+"/records/"+item.ID, map[string]any{"estado": "pausada"}, nil)
			}
		}
		if err := c.setSelectValues(ctx, col, "estado", final); err != nil {
			return err
		}
	}
	return nil
}

func (c *Client) setSelectValues(ctx context.Context, collection, field string, values []string) error {
	var meta collectionMeta
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/"+collection, nil, &meta); err != nil {
		return err
	}
	fields := append([]map[string]any{}, meta.Fields...)
	changed := false
	for i, f := range fields {
		name, _ := f["name"].(string)
		if name != field {
			continue
		}
		fields[i]["values"] = values
		changed = true
	}
	if !changed {
		return nil
	}
	return c.doJSON(ctx, http.MethodPatch, "/api/collections/"+collection, map[string]any{"fields": fields}, nil)
}

func ticketsCollection(categoryCollectionID string) map[string]any {
	return map[string]any{
		"name":       "tickets",
		"type":       "base",
		"listRule":   nil,
		"viewRule":   nil,
		"createRule": nil,
		"updateRule": nil,
		"deleteRule": nil,
		"fields": []map[string]any{
			{"name": "number", "type": "text", "required": true, "max": 32},
			{"name": "subject", "type": "text", "required": true, "max": 200},
			{"name": "description", "type": "text", "required": false, "max": 5000},
			{
				"name":          "category",
				"type":          "relation",
				"required":      true,
				"collectionId":  categoryCollectionID,
				"maxSelect":     1,
				"cascadeDelete": false,
			},
			{
				"name":      "status",
				"type":      "select",
				"required":  true,
				"maxSelect": 1,
				"values":    []string{"abierto", "pendiente", "en_proceso", "resuelto", "cerrado"},
			},
			{
				"name":      "priority",
				"type":      "select",
				"required":  true,
				"maxSelect": 1,
				"values":    []string{"baja", "media", "alta", "critica"},
			},
			{
				"name":      "type",
				"type":      "select",
				"required":  true,
				"maxSelect": 1,
				"values":    []string{"implementacion", "soporte"},
			},
			{"name": "assignee", "type": "text", "required": false, "max": 120},
			{"name": "created", "type": "autodate", "onCreate": true, "onUpdate": false},
			{"name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true},
		},
		"indexes": []string{
			"CREATE UNIQUE INDEX idx_tickets_number ON tickets (`number`)",
		},
	}
}

func commentsCollection(ticketCollectionID string) map[string]any {
	return map[string]any{
		"name":       "comments",
		"type":       "base",
		"listRule":   nil,
		"viewRule":   nil,
		"createRule": nil,
		"updateRule": nil,
		"deleteRule": nil,
		"fields": []map[string]any{
			{
				"name":          "ticket",
				"type":          "relation",
				"required":      true,
				"collectionId":  ticketCollectionID,
				"maxSelect":     1,
				"cascadeDelete": true,
			},
			{"name": "body", "type": "text", "required": true, "max": 5000},
			{
				"name":      "visibility",
				"type":      "select",
				"required":  true,
				"maxSelect": 1,
				"values":    []string{"interno", "cliente", "sistema"},
			},
			{"name": "author", "type": "text", "required": false, "max": 120},
			{"name": "created", "type": "autodate", "onCreate": true, "onUpdate": false},
			{"name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true},
		},
	}
}

func stagesCollection(ticketCollectionID string) map[string]any {
	return map[string]any{
		"name":       "stages",
		"type":       "base",
		"listRule":   nil,
		"viewRule":   nil,
		"createRule": nil,
		"updateRule": nil,
		"deleteRule": nil,
		"fields": []map[string]any{
			{
				"name":          "ticket",
				"type":          "relation",
				"required":      true,
				"collectionId":  ticketCollectionID,
				"maxSelect":     1,
				"cascadeDelete": true,
			},
			{"name": "name", "type": "text", "required": true, "max": 120},
			{"name": "orden", "type": "number", "required": false},
			{"name": "fecha_plan_inicio", "type": "text", "required": false, "max": 32},
			{"name": "fecha_plan_fin", "type": "text", "required": false, "max": 32},
			{
				"name":      "estado",
				"type":      "select",
				"required":  true,
				"maxSelect": 1,
				"values":    []string{"pendiente", "en_curso", "hecha", "pausada"},
			},
			{"name": "avance", "type": "number", "required": false},
			{"name": "created", "type": "autodate", "onCreate": true, "onUpdate": false},
			{"name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true},
		},
	}
}

func ticketTemplatesCollection(categoryCollectionID string) map[string]any {
	return map[string]any{
		"name":       "ticket_templates",
		"type":       "base",
		"listRule":   nil,
		"viewRule":   nil,
		"createRule": nil,
		"updateRule": nil,
		"deleteRule": nil,
		"fields": []map[string]any{
			{"name": "name", "type": "text", "required": true, "max": 160},
			{"name": "description", "type": "text", "required": false, "max": 2000},
			{
				"name":      "type",
				"type":      "select",
				"required":  true,
				"maxSelect": 1,
				"values":    []string{"implementacion", "soporte"},
			},
			{
				"name":          "category",
				"type":          "relation",
				"required":      false,
				"collectionId":  categoryCollectionID,
				"maxSelect":     1,
				"cascadeDelete": false,
			},
			{
				"name":      "priority",
				"type":      "select",
				"required":  true,
				"maxSelect": 1,
				"values":    []string{"baja", "media", "alta", "critica"},
			},
			{"name": "subject_template", "type": "text", "required": false, "max": 200},
			{"name": "body_template", "type": "text", "required": false, "max": 5000},
			{"name": "created", "type": "autodate", "onCreate": true, "onUpdate": false},
			{"name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true},
		},
	}
}

func templateStagesCollection(templateCollectionID string) map[string]any {
	return map[string]any{
		"name":       "template_stages",
		"type":       "base",
		"listRule":   nil,
		"viewRule":   nil,
		"createRule": nil,
		"updateRule": nil,
		"deleteRule": nil,
		"fields": []map[string]any{
			{
				"name":          "template",
				"type":          "relation",
				"required":      true,
				"collectionId":  templateCollectionID,
				"maxSelect":     1,
				"cascadeDelete": true,
			},
			{"name": "name", "type": "text", "required": true, "max": 120},
			{"name": "orden", "type": "number", "required": false},
			{"name": "offset_start_days", "type": "number", "required": false},
			{"name": "duration_days", "type": "number", "required": false},
			{
				"name":      "estado",
				"type":      "select",
				"required":  true,
				"maxSelect": 1,
				"values":    []string{"pendiente", "en_curso", "hecha", "pausada"},
			},
			{"name": "created", "type": "autodate", "onCreate": true, "onUpdate": false},
			{"name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true},
		},
	}
}
