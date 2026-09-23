package pb

import (
	"context"
	"fmt"
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
	return nil
}

type collectionMeta struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func (c *Client) collectionID(ctx context.Context, name string) (string, error) {
	var meta collectionMeta
	if err := c.doJSON(ctx, "GET", "/api/collections/"+name, nil, &meta); err != nil {
		return "", err
	}
	if meta.ID == "" {
		return "", fmt.Errorf("empty id for collection %s", name)
	}
	return meta.ID, nil
}

func categoriesCollection() map[string]any {
	return map[string]any{
		"name":     "categories",
		"type":     "base",
		"listRule": nil,
		"viewRule": nil,
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
			{"name": "created", "type": "autodate", "onCreate": true, "onUpdate": false},
			{"name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true},
		},
		"indexes": []string{
			"CREATE UNIQUE INDEX idx_tickets_number ON tickets (`number`)",
		},
	}
}
