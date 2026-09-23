package pb

import (
	"context"
	"fmt"
	"net/http"
)

func (c *Client) Bootstrap(ctx context.Context) error {
	if err := c.authenticate(ctx); err != nil {
		return err
	}
	if err := c.ensureCollection(ctx, categoriesCollection()); err != nil {
		return fmt.Errorf("categories collection: %w", err)
	}
	catID, err := c.collectionID(ctx, "categories")
	if err != nil {
		return fmt.Errorf("categories id: %w", err)
	}
	if err := c.ensureCollection(ctx, ticketsCollection(catID)); err != nil {
		return fmt.Errorf("tickets collection: %w", err)
	}
	if err := c.ensureTicketExtraFields(ctx); err != nil {
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

func (c *Client) ensureTicketExtraFields(ctx context.Context) error {
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
	if !have["assignee"] {
		fields = append(fields, map[string]any{"name": "assignee", "type": "text", "required": false, "max": 120})
		changed = true
	}
	if !have["created"] {
		fields = append(fields, map[string]any{"name": "created", "type": "autodate", "onCreate": true, "onUpdate": false})
		changed = true
	}
	if !have["updated"] {
		fields = append(fields, map[string]any{"name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true})
		changed = true
	}
	if !changed {
		return nil
	}
	payload := map[string]any{"fields": fields}
	return c.doJSON(ctx, http.MethodPatch, "/api/collections/tickets", payload, nil)
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
			{"name": "created", "type": "autodate", "onCreate": true, "onUpdate": false},
			{"name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true},
		},
		"indexes": []string{
			"CREATE UNIQUE INDEX idx_categories_name ON categories (`name`)",
		},
	}
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
				"values":    []string{"pendiente", "en_curso", "hecha", "bloqueada"},
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
				"values":    []string{"pendiente", "en_curso", "hecha", "bloqueada"},
			},
			{"name": "created", "type": "autodate", "onCreate": true, "onUpdate": false},
			{"name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true},
		},
	}
}
