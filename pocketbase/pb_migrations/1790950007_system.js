/// <reference path="../pb_data/types.d.ts" />
// G. Sistema: configuración de la empresa, textos propios, vistas guardadas, respuestas rápidas, sesiones y auditoría.

const COLLECTIONS = [
  "settings",
  "settings_history",
  "translations_overrides",
  "saved_views",
  "canned_responses",
  "sessions",
  "audit_logs",
];

migrate(
  (app) => {
    const s = require("/pb_hooks/lib/schema.js");
    const { createCollection, text, longText, bool, date, json, select, rel, editor, active } = s;

    createCollection(app, {
      name: "settings",
      fields: [
        {
          name: "key",
          type: "text",
          required: true,
          max: 120,
          presentable: true,
          pattern: "^[a-z0-9_]+(\\.[a-z0-9_]+)+$",
          help: "grupo.clave, ej. email.default_sender",
        },
        select(
          "group",
          ["general", "appearance", "language", "email", "notifications", "work_items", "integrations", "files", "security"],
          { required: true },
        ),
        json("value"),
        bool("is_secret", { help: "true = el valor va cifrado y no se devuelve por la API." }),
        rel("updated_by", "users"),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_settings_key ON settings (key)"],
    });

    createCollection(app, {
      name: "settings_history",
      fields: [
        rel("setting", "settings", { required: true, cascade: true }),
        json("old_value"),
        json("new_value"),
        rel("changed_by", "users"),
      ],
      indexes: ["CREATE INDEX idx_settings_history_setting ON settings_history (setting, created)"],
    });

    createCollection(app, {
      name: "translations_overrides",
      fields: [
        text("key", { required: true, max: 160, presentable: true }),
        select("language", s.LANGUAGES, { required: true }),
        longText("text", { required: true }),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_translations_overrides_unique ON translations_overrides (key, language)"],
    });

    createCollection(app, {
      name: "saved_views",
      fields: [
        text("name", { required: true, presentable: true }),
        rel("owner_user", "users", { cascade: true, help: "Dueño: un usuario, un equipo o ninguno (vista global)." }),
        rel("owner_team", "teams", { cascade: true }),
        rel("work_item_type", "work_item_types", { cascade: true }),
        select("layout", ["board", "list"], { required: true }),
        select("board_mode", ["status", "due", "assignee", "priority", "client", "product"]),
        select("density", ["classic", "compact"]),
        json("filters"),
        json("sort"),
        bool("is_favorite"),
      ],
      indexes: [
        "CREATE INDEX idx_saved_views_user ON saved_views (owner_user)",
        "CREATE INDEX idx_saved_views_team ON saved_views (owner_team)",
      ],
    });

    createCollection(app, {
      name: "canned_responses",
      fields: [
        text("title", { required: true, presentable: true }),
        editor("body", { required: true }),
        select("language", s.LANGUAGES, { required: true }),
        rel("work_item_type", "work_item_types", { cascade: true }),
        rel("created_by", "users"),
        active(),
      ],
    });

    createCollection(app, {
      name: "sessions",
      fields: [
        rel("user", "users", { required: true, cascade: true }),
        { name: "refresh_token_hash", type: "text", required: true, max: 255, hidden: true },
        text("user_agent", { max: 500 }),
        text("ip", { max: 64 }),
        date("expires_at", { required: true }),
        date("last_used_at"),
        date("revoked_at"),
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_sessions_token ON sessions (refresh_token_hash)",
        "CREATE INDEX idx_sessions_user ON sessions (user, revoked_at)",
      ],
    });

    createCollection(app, {
      name: "audit_logs",
      fields: [
        rel("actor", "users"),
        text("action", { required: true, max: 120, presentable: true }),
        text("target_collection", { max: 80 }),
        text("target_id", { max: 40 }),
        text("ip", { max: 64 }),
        json("metadata"),
      ],
      indexes: [
        "CREATE INDEX idx_audit_logs_created ON audit_logs (created)",
        "CREATE INDEX idx_audit_logs_actor ON audit_logs (actor, created)",
      ],
    });
  },
  (app) => {
    require("/pb_hooks/lib/schema.js").dropCollections(app, COLLECTIONS);
  },
);
