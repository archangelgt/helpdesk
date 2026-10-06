/// <reference path="../pb_data/types.d.ts" />
// C. Casos y su trabajo: una sola entidad (work_items) para soporte, implementación, tarea y tipos futuros.

const COLLECTIONS = [
  "work_items",
  "custom_field_values",
  "work_item_participants",
  "stages",
  "stage_dependencies",
  "work_item_assignments",
  "work_item_status_history",
  "work_item_links",
  "work_item_tags",
  "checklist_items",
  "client_requests",
  "comments",
  "attachments",
  "work_item_events",
  "sla_timers",
  "time_entries",
];

migrate(
  (app) => {
    const s = require("/pb_hooks/lib/schema.js");
    const { createCollection, text, longText, labelKey, bool, int, date, json, select, rel, editor, sortOrder } = s;
    const CACHE = "(caché) Lo escribe el hook; se recalcula desde el historial.";

    createCollection(app, {
      name: "work_items",
      fields: [
        text("number", { max: 20, presentable: true, help: "Lo asigna el hook: prefijo del tipo + secuencia (ej. SOP-0001)." }),
        rel("type", "work_item_types", { required: true }),
        text("title", { required: true, presentable: true }),
        editor("description"),
        rel("status", "statuses", { required: true }),
        rel("priority", "priorities"),
        rel("category", "categories"),
        rel("product", "products"),
        rel("client", "clients"),
        rel("channel", "channels"),
        rel("requester", "users"),
        rel("created_by", "users"),
        rel("updated_by", "users", { help: "Último usuario que modificó el caso (lo usa el historial)." }),
        rel("assignee", "users"),
        rel("team", "teams"),
        rel("template", "templates"),
        rel("sla_policy", "sla_policies"),
        date("due_at"),
        date("planned_start"),
        date("planned_end"),
        date("first_response_at"),
        date("resolved_at"),
        date("closed_at"),
        select("status_category", s.STATUS_CATEGORIES, { help: CACHE }),
        int("progress_percent", { min: 0, max: 100, help: CACHE }),
        rel("resolved_by", "users", { help: CACHE }),
        date("deleted_at"),
      ],
      selfRelations: [rel("parent", "@self")],
      indexes: [
        "CREATE UNIQUE INDEX idx_work_items_number ON work_items (number) WHERE number != ''",
        "CREATE INDEX idx_work_items_type_status ON work_items (type, status_category)",
        "CREATE INDEX idx_work_items_client ON work_items (client)",
        "CREATE INDEX idx_work_items_assignee ON work_items (assignee, status_category)",
        "CREATE INDEX idx_work_items_requester ON work_items (requester)",
        "CREATE INDEX idx_work_items_due_at ON work_items (due_at)",
        "CREATE INDEX idx_work_items_parent ON work_items (parent)",
      ],
    });

    createCollection(app, {
      name: "custom_field_values",
      fields: [
        rel("work_item", "work_items", { required: true, cascade: true }),
        rel("field", "custom_fields", { required: true, cascade: true }),
        longText("value_text"),
        { name: "value_number", type: "number" },
        date("value_date"),
        json("value_json"),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_custom_field_values_unique ON custom_field_values (work_item, field)"],
    });

    createCollection(app, {
      name: "work_item_participants",
      fields: [
        rel("work_item", "work_items", { required: true, cascade: true }),
        rel("user", "users", { required: true, cascade: true }),
        select("participant_role", ["watcher", "collaborator", "approver", "client_contact"], { required: true }),
        bool("receives_notifications"),
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_work_item_participants_unique ON work_item_participants (work_item, user, participant_role)",
        "CREATE INDEX idx_work_item_participants_user ON work_item_participants (user)",
      ],
    });

    createCollection(app, {
      name: "stages",
      fields: [
        rel("work_item", "work_items", { required: true, cascade: true }),
        rel("template_stage", "template_stages"),
        text("name", { required: true, presentable: true }),
        labelKey(),
        longText("description"),
        sortOrder(),
        rel("status", "statuses", { required: true }),
        select("responsible_side", s.RESPONSIBLE_SIDES, { required: true }),
        rel("owner", "users"),
        date("planned_start"),
        date("planned_end"),
        date("started_at"),
        date("completed_at"),
        rel("completed_by", "users"),
        int("weight", { min: 0 }),
        bool("client_visible"),
        bool("requires_evidence"),
        bool("requires_client_approval"),
      ],
      indexes: ["CREATE INDEX idx_stages_work_item ON stages (work_item, sort_order)"],
    });

    createCollection(app, {
      name: "stage_dependencies",
      fields: [
        rel("stage", "stages", { required: true, cascade: true }),
        rel("depends_on", "stages", { required: true, cascade: true }),
        select("dependency_type", ["finish_to_start"], { required: true }),
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_stage_dependencies_unique ON stage_dependencies (stage, depends_on)",
        "CREATE INDEX idx_stage_dependencies_depends_on ON stage_dependencies (depends_on)",
      ],
    });

    createCollection(app, {
      name: "work_item_assignments",
      fields: [
        rel("work_item", "work_items", { required: true, cascade: true }),
        rel("stage", "stages", { cascade: true }),
        rel("assignee", "users", { required: true }),
        rel("team", "teams"),
        rel("assigned_by", "users"),
        date("started_at", { required: true }),
        date("ended_at"),
      ],
      indexes: [
        "CREATE INDEX idx_work_item_assignments_item ON work_item_assignments (work_item, started_at)",
        "CREATE INDEX idx_work_item_assignments_assignee ON work_item_assignments (assignee)",
      ],
    });

    createCollection(app, {
      name: "work_item_status_history",
      fields: [
        rel("work_item", "work_items", { required: true, cascade: true }),
        rel("from_status", "statuses"),
        rel("to_status", "statuses", { required: true }),
        select("to_category", s.STATUS_CATEGORIES, { required: true }),
        rel("changed_by", "users"),
        int("seconds_in_previous", { min: 0 }),
      ],
      indexes: ["CREATE INDEX idx_work_item_status_history_item ON work_item_status_history (work_item, created)"],
    });

    createCollection(app, {
      name: "work_item_links",
      fields: [
        rel("source", "work_items", { required: true, cascade: true }),
        rel("target", "work_items", { required: true, cascade: true }),
        select("link_type", ["relates_to", "duplicates", "blocks", "caused_by"], { required: true }),
        rel("created_by", "users"),
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_work_item_links_unique ON work_item_links (source, target, link_type)",
        "CREATE INDEX idx_work_item_links_target ON work_item_links (target)",
      ],
    });

    createCollection(app, {
      name: "work_item_tags",
      fields: [
        rel("work_item", "work_items", { required: true, cascade: true }),
        rel("tag", "tags", { required: true, cascade: true }),
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_work_item_tags_unique ON work_item_tags (work_item, tag)",
        "CREATE INDEX idx_work_item_tags_tag ON work_item_tags (tag)",
      ],
    });

    createCollection(app, {
      name: "checklist_items",
      fields: [
        rel("work_item", "work_items", { cascade: true, help: "Dueño: caso o etapa (exactamente uno)." }),
        rel("stage", "stages", { cascade: true }),
        text("title", { required: true, presentable: true }),
        sortOrder(),
        bool("is_done"),
        rel("done_by", "users"),
        date("done_at"),
      ],
      indexes: [
        "CREATE INDEX idx_checklist_items_stage ON checklist_items (stage, sort_order)",
        "CREATE INDEX idx_checklist_items_work_item ON checklist_items (work_item, sort_order)",
      ],
    });

    createCollection(app, {
      name: "client_requests",
      fields: [
        rel("work_item", "work_items", { required: true, cascade: true }),
        rel("stage", "stages", { cascade: true, help: "Debe pertenecer al mismo caso." }),
        rel("template_request", "template_client_requests"),
        text("title", { required: true, presentable: true }),
        longText("description"),
        select("request_type", s.CLIENT_REQUEST_TYPES, { required: true }),
        rel("requested_by", "users"),
        rel("contact", "users", { help: "Contacto del cliente responsable de entregar." }),
        date("due_at"),
        bool("blocking"),
        select("status", ["pending", "submitted", "in_review", "accepted", "rejected", "cancelled"], { required: true }),
        date("submitted_at"),
        rel("reviewed_by", "users"),
        date("reviewed_at"),
        longText("rejection_reason"),
        int("reminders_sent", { min: 0 }),
        date("last_reminder_at"),
      ],
      indexes: [
        "CREATE INDEX idx_client_requests_item ON client_requests (work_item, status)",
        "CREATE INDEX idx_client_requests_stage ON client_requests (stage)",
        "CREATE INDEX idx_client_requests_contact ON client_requests (contact, status)",
        "CREATE INDEX idx_client_requests_due ON client_requests (status, due_at)",
      ],
    });

    createCollection(app, {
      name: "comments",
      fields: [
        rel("work_item", "work_items", { required: true, cascade: true }),
        rel("stage", "stages", { cascade: true }),
        rel("client_request", "client_requests", { cascade: true }),
        rel("author", "users"),
        editor("body", { required: true }),
        select("visibility", ["public", "internal"], { required: true }),
        rel("channel", "channels"),
      ],
      indexes: ["CREATE INDEX idx_comments_item ON comments (work_item, created)"],
    });

    createCollection(app, {
      name: "attachments",
      fields: [
        rel("work_item", "work_items", { cascade: true, help: "Dueño único: caso, comentario, etapa o requerimiento." }),
        rel("comment", "comments", { cascade: true }),
        rel("stage", "stages", { cascade: true }),
        rel("client_request", "client_requests", { cascade: true }),
        { name: "file", type: "file", required: true, maxSelect: 1, maxSize: 104857600, protected: true, thumbs: ["100x100", "480x0"] },
        text("original_name"),
        text("mime_type", { max: 120 }),
        int("size_bytes", { min: 0 }),
        select("purpose", ["general", "evidence", "client_submission", "template_file"], { required: true }),
        rel("uploaded_by", "users"),
      ],
      indexes: [
        "CREATE INDEX idx_attachments_work_item ON attachments (work_item)",
        "CREATE INDEX idx_attachments_comment ON attachments (comment)",
        "CREATE INDEX idx_attachments_stage ON attachments (stage)",
        "CREATE INDEX idx_attachments_client_request ON attachments (client_request)",
      ],
    });

    createCollection(app, {
      name: "work_item_events",
      fields: [
        rel("work_item", "work_items", { required: true, cascade: true }),
        rel("event_type", "event_types", { required: true }),
        rel("actor", "users"),
        json("old_value"),
        json("new_value"),
        json("metadata"),
      ],
      indexes: ["CREATE INDEX idx_work_item_events_item ON work_item_events (work_item, created)"],
    });

    createCollection(app, {
      name: "sla_timers",
      fields: [
        rel("work_item", "work_items", { required: true, cascade: true }),
        select("metric", ["first_response", "resolution"], { required: true }),
        rel("target", "sla_targets"),
        date("started_at"),
        date("paused_since"),
        int("paused_seconds", { min: 0 }),
        date("due_at"),
        date("breached_at"),
        date("stopped_at"),
        select("state", ["running", "paused", "met", "breached", "cancelled"], { required: true }),
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_sla_timers_unique ON sla_timers (work_item, metric)",
        "CREATE INDEX idx_sla_timers_due ON sla_timers (state, due_at)",
      ],
    });

    createCollection(app, {
      name: "time_entries",
      fields: [
        rel("work_item", "work_items", { required: true, cascade: true }),
        rel("stage", "stages", { cascade: true }),
        rel("user", "users", { required: true }),
        int("minutes", { required: true, min: 1 }),
        date("worked_on", { required: true }),
        bool("billable"),
        longText("note"),
      ],
      indexes: [
        "CREATE INDEX idx_time_entries_item ON time_entries (work_item)",
        "CREATE INDEX idx_time_entries_user ON time_entries (user, worked_on)",
      ],
    });
  },
  (app) => {
    require("/pb_hooks/lib/schema.js").dropCollections(app, COLLECTIONS);
  },
);
