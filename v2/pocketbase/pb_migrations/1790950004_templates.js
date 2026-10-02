/// <reference path="../pb_data/types.d.ts" />
// D. Plantillas: de aquí se generan etapas, dependencias, checklists y requerimientos al cliente.

const COLLECTIONS = [
  "templates",
  "template_stages",
  "template_stage_dependencies",
  "template_client_requests",
  "template_checklist_items",
];

migrate(
  (app) => {
    const s = require("/pb_hooks/lib/schema.js");
    const { createCollection, text, longText, labelKey, bool, int, select, rel, sortOrder, active } = s;

    createCollection(app, {
      name: "templates",
      fields: [
        rel("type", "work_item_types", { required: true }),
        rel("product", "products"),
        text("name", { required: true, presentable: true }),
        longText("description"),
        active(),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_templates_type_name ON templates (type, name)"],
    });

    createCollection(app, {
      name: "template_stages",
      fields: [
        rel("template", "templates", { required: true, cascade: true }),
        text("name", { required: true, presentable: true }),
        labelKey(),
        longText("description"),
        sortOrder(),
        int("duration_days", { min: 0, help: "Duración en días hábiles." }),
        select("responsible_side", s.RESPONSIBLE_SIDES, { required: true }),
        rel("suggested_role", "roles"),
        int("weight", { min: 0 }),
        bool("client_visible"),
        bool("requires_evidence"),
        bool("requires_client_approval"),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_template_stages_name ON template_stages (template, name)"],
    });

    createCollection(app, {
      name: "template_stage_dependencies",
      fields: [
        rel("stage", "template_stages", { required: true, cascade: true }),
        rel("depends_on", "template_stages", { required: true, cascade: true }),
        select("dependency_type", ["finish_to_start"], { required: true }),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_template_stage_deps_unique ON template_stage_dependencies (stage, depends_on)"],
    });

    createCollection(app, {
      name: "template_client_requests",
      fields: [
        rel("stage", "template_stages", { required: true, cascade: true }),
        text("title", { required: true, presentable: true }),
        longText("description"),
        select("request_type", s.CLIENT_REQUEST_TYPES, { required: true }),
        bool("blocking"),
        int("due_in_days", { min: 0, help: "Días hábiles para entregar desde que inicia la etapa." }),
        { name: "sample_file", type: "file", maxSelect: 1, maxSize: 20971520, protected: true },
        sortOrder(),
      ],
      indexes: ["CREATE INDEX idx_template_client_requests_stage ON template_client_requests (stage)"],
    });

    createCollection(app, {
      name: "template_checklist_items",
      fields: [
        rel("stage", "template_stages", { required: true, cascade: true }),
        text("title", { required: true, presentable: true }),
        sortOrder(),
      ],
      indexes: ["CREATE INDEX idx_template_checklist_items_stage ON template_checklist_items (stage)"],
    });
  },
  (app) => {
    require("/pb_hooks/lib/schema.js").dropCollections(app, COLLECTIONS);
  },
);
