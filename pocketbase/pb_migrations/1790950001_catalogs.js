/// <reference path="../pb_data/types.d.ts" />
// B. Catálogos configurables (y catálogos de seguridad/eventos que usan los demás dominios).

const COLLECTIONS = [
  "roles",
  "permissions",
  "role_permissions",
  "event_types",
  "connectors",
  "workflows",
  "statuses",
  "workflow_transitions",
  "priorities",
  "channels",
  "tags",
  "products",
  "work_item_types",
  "categories",
  "custom_fields",
];

migrate(
  (app) => {
    const s = require("/pb_hooks/lib/schema.js");
    const { createCollection, text, longText, code, labelKey, bool, int, json, select, rel, color, url, sortOrder, active, secret } = s;

    createCollection(app, {
      name: "roles",
      fields: [
        code(),
        text("name", { required: true }),
        labelKey(),
        select("scope", ["staff", "client"], { required: true }),
        longText("description"),
        bool("is_system"),
        active(),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_roles_code ON roles (code)"],
    });

    createCollection(app, {
      name: "permissions",
      fields: [code(), text("module", { required: true, max: 60 }), labelKey(), longText("description")],
      indexes: ["CREATE UNIQUE INDEX idx_permissions_code ON permissions (code)"],
    });

    createCollection(app, {
      name: "role_permissions",
      fields: [
        rel("role", "roles", { required: true, cascade: true }),
        rel("permission", "permissions", { required: true, cascade: true }),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_role_permissions_unique ON role_permissions (role, permission)"],
    });

    createCollection(app, {
      name: "event_types",
      fields: [
        code(),
        text("module", { required: true, max: 60 }),
        labelKey(),
        longText("description"),
        bool("client_visible"),
        active(),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_event_types_code ON event_types (code)"],
    });

    createCollection(app, {
      name: "connectors",
      fields: [
        code(),
        text("name", { required: true }),
        select("kind", ["erpsys", "erpsyschat", "rest", "csv", "email"], { required: true }),
        url("base_url"),
        secret("credentials_encrypted"),
        json("field_mapping"),
        int("sync_interval_minutes", { min: 0 }),
        select("health", ["unknown", "ok", "degraded", "down"]),
        { name: "last_sync_at", type: "date" },
        active(),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_connectors_code ON connectors (code)"],
    });

    createCollection(app, {
      name: "workflows",
      fields: [
        code(),
        text("name", { required: true }),
        labelKey(),
        select("applies_to", ["work_item", "stage"], { required: true }),
        longText("description"),
        bool("is_system"),
        active(),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_workflows_code ON workflows (code)"],
    });

    createCollection(app, {
      name: "statuses",
      fields: [
        rel("workflow", "workflows", { required: true, cascade: true }),
        code(),
        text("name", { required: true, presentable: true }),
        labelKey(),
        select("category", s.STATUS_CATEGORIES, { required: true }),
        text("client_label"),
        color(),
        sortOrder(),
        bool("is_initial"),
        bool("is_final"),
        bool("pauses_sla"),
        active(),
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_statuses_workflow_code ON statuses (workflow, code)",
        "CREATE INDEX idx_statuses_category ON statuses (category)",
      ],
    });

    createCollection(app, {
      name: "workflow_transitions",
      fields: [
        rel("from_status", "statuses", { required: true, cascade: true }),
        rel("to_status", "statuses", { required: true, cascade: true }),
        rel("allowed_roles", "roles", { multiple: true }),
        labelKey(),
        bool("requires_comment"),
        bool("requires_evidence"),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_workflow_transitions_unique ON workflow_transitions (from_status, to_status)"],
    });

    createCollection(app, {
      name: "priorities",
      fields: [
        code(),
        text("name", { required: true }),
        labelKey(),
        int("level", { required: true, min: 1, max: 10 }),
        color(),
        bool("is_default"),
        active(),
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_priorities_code ON priorities (code)",
        "CREATE UNIQUE INDEX idx_priorities_level ON priorities (level)",
      ],
    });

    createCollection(app, {
      name: "channels",
      fields: [code(), text("name", { required: true }), labelKey(), active()],
      indexes: ["CREATE UNIQUE INDEX idx_channels_code ON channels (code)"],
    });

    createCollection(app, {
      name: "tags",
      fields: [text("name", { required: true, max: 60, presentable: true }), color()],
      indexes: ["CREATE UNIQUE INDEX idx_tags_name ON tags (name COLLATE NOCASE)"],
    });

    createCollection(app, {
      name: "products",
      fields: [code(), text("name", { required: true }), longText("description"), active()],
      indexes: ["CREATE UNIQUE INDEX idx_products_code ON products (code)"],
    });

    createCollection(app, {
      name: "work_item_types",
      fields: [
        code(),
        text("name", { required: true }),
        labelKey(),
        text("icon", { max: 60 }),
        color(),
        text("number_prefix", { required: true, max: 10, pattern: "^[A-Z][A-Z0-9]{1,9}$" }),
        int("number_padding", { min: 0, max: 10 }),
        int("last_number", { min: 0, help: "Secuencia de numeración; solo la escribe el hook de work_items." }),
        rel("workflow", "workflows", { required: true }),
        rel("stage_workflow", "workflows", { help: "Flujo de las etapas; obligatorio si has_stages." }),
        rel("default_priority", "priorities"),
        bool("has_stages"),
        bool("client_visible"),
        bool("requires_product"),
        sortOrder(),
        active(),
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_work_item_types_code ON work_item_types (code)",
        "CREATE UNIQUE INDEX idx_work_item_types_prefix ON work_item_types (number_prefix)",
      ],
    });

    createCollection(app, {
      name: "categories",
      fields: [
        rel("type", "work_item_types", { required: true, cascade: true }),
        text("name", { required: true, presentable: true }),
        labelKey(),
        sortOrder(),
        active(),
      ],
      selfRelations: [rel("parent", "@self")],
      indexes: ["CREATE UNIQUE INDEX idx_categories_unique ON categories (type, parent, name)"],
    });

    createCollection(app, {
      name: "custom_fields",
      fields: [
        rel("type", "work_item_types", { required: true, cascade: true }),
        code("key"),
        text("name", { required: true }),
        labelKey(),
        select("data_type", ["text", "number", "date", "bool", "select", "user", "file"], { required: true }),
        json("options"),
        bool("is_required"),
        bool("client_visible"),
        sortOrder(),
        active(),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_custom_fields_type_key ON custom_fields (type, key)"],
    });
  },
  (app) => {
    require("/pb_hooks/lib/schema.js").dropCollections(app, COLLECTIONS);
  },
);
