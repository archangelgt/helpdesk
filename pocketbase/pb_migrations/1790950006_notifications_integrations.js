/// <reference path="../pb_data/types.d.ts" />
// F. Notificaciones, canales e integraciones.

const COLLECTIONS = [
  "notification_channels",
  "email_senders",
  "notification_templates",
  "notification_rules",
  "notifications",
  "user_notification_prefs",
  "inbound_mailboxes",
  "email_threads",
  "sync_runs",
  "external_refs",
  "event_outbox",
  "api_keys",
  "webhooks",
  "webhook_deliveries",
];

migrate(
  (app) => {
    const s = require("/pb_hooks/lib/schema.js");
    const { createCollection, text, longText, bool, int, date, json, select, rel, editor, email, url, active, secret } = s;
    const CHANNEL_TYPES = ["email", "webhook", "erpsyschat", "slack", "teams", "whatsapp", "telegram"];

    createCollection(app, {
      name: "notification_channels",
      fields: [
        s.code(),
        text("name", { required: true }),
        select("channel_type", CHANNEL_TYPES, { required: true }),
        secret("config_encrypted"),
        active(),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_notification_channels_code ON notification_channels (code)"],
    });

    createCollection(app, {
      name: "email_senders",
      fields: [
        text("name", { required: true, presentable: true }),
        email("from_email", { required: true }),
        email("reply_to"),
        select("provider", ["smtp", "zeptomail", "ses", "mailgun", "sendgrid", "postmark"], { required: true }),
        text("smtp_host"),
        int("smtp_port", { min: 0, max: 65535 }),
        secret("credentials_encrypted"),
        bool("spf_ok"),
        bool("dkim_ok"),
        date("verified_at"),
        bool("is_default"),
        active(),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_email_senders_from ON email_senders (from_email)"],
    });

    createCollection(app, {
      name: "notification_templates",
      fields: [
        rel("event_type", "event_types", { required: true, cascade: true }),
        select("channel_type", CHANNEL_TYPES, { required: true }),
        select("language", s.LANGUAGES, { required: true }),
        text("subject", { max: 255 }),
        editor("body", { required: true }),
        bool("is_custom", { help: "true = personalizada por la empresa (no se sobrescribe al actualizar)." }),
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_notification_templates_unique ON notification_templates (event_type, channel_type, language)",
      ],
    });

    createCollection(app, {
      name: "notification_rules",
      fields: [
        rel("event_type", "event_types", { required: true, cascade: true }),
        rel("work_item_type", "work_item_types", { cascade: true, help: "Vacío = aplica a todos los tipos." }),
        select(
          "recipients",
          ["requester", "client_contacts", "assignee", "stage_owner", "team", "managers", "participants", "account_manager"],
          { multiple: true, required: true },
        ),
        rel("channels", "notification_channels", { multiple: true, required: true }),
        rel("sender", "email_senders", { help: "Vacío = remitente por defecto." }),
        active(),
      ],
      indexes: ["CREATE INDEX idx_notification_rules_event ON notification_rules (event_type, work_item_type)"],
    });

    createCollection(app, {
      name: "notifications",
      fields: [
        rel("event_type", "event_types", { required: true }),
        rel("work_item", "work_items", { cascade: true }),
        rel("recipient", "users", { cascade: true }),
        email("recipient_email", { help: "Para destinatarios sin cuenta." }),
        rel("channel", "notification_channels", { required: true }),
        select("status", ["pending", "sent", "failed", "skipped"], { required: true }),
        int("attempts", { min: 0 }),
        longText("last_error"),
        date("sent_at"),
        json("payload"),
      ],
      indexes: [
        "CREATE INDEX idx_notifications_status ON notifications (status, created)",
        "CREATE INDEX idx_notifications_recipient ON notifications (recipient, created)",
      ],
    });

    createCollection(app, {
      name: "user_notification_prefs",
      fields: [
        rel("user", "users", { required: true, cascade: true }),
        rel("event_type", "event_types", { required: true, cascade: true }),
        rel("channels", "notification_channels", { multiple: true }),
        bool("muted"),
        bool("daily_digest"),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_user_notification_prefs_unique ON user_notification_prefs (user, event_type)"],
    });

    createCollection(app, {
      name: "inbound_mailboxes",
      fields: [
        text("name", { required: true, presentable: true }),
        email("address", { required: true }),
        select("protocol", ["imap", "webhook"], { required: true }),
        secret("config_encrypted"),
        rel("default_type", "work_item_types"),
        rel("default_team", "teams"),
        rel("default_priority", "priorities"),
        active(),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_inbound_mailboxes_address ON inbound_mailboxes (address)"],
    });

    createCollection(app, {
      name: "email_threads",
      fields: [
        rel("mailbox", "inbound_mailboxes", { cascade: true }),
        rel("work_item", "work_items", { required: true, cascade: true }),
        text("message_id", { required: true, max: 500 }),
        text("subject"),
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_email_threads_message_id ON email_threads (message_id)",
        "CREATE INDEX idx_email_threads_item ON email_threads (work_item)",
      ],
    });

    createCollection(app, {
      name: "sync_runs",
      fields: [
        rel("connector", "connectors", { required: true, cascade: true }),
        date("started_at", { required: true }),
        date("finished_at"),
        select("status", ["running", "success", "partial", "failed"], { required: true }),
        json("stats"),
        longText("error"),
      ],
      indexes: ["CREATE INDEX idx_sync_runs_connector ON sync_runs (connector, started_at)"],
    });

    createCollection(app, {
      name: "external_refs",
      fields: [
        rel("work_item", "work_items", { required: true, cascade: true }),
        rel("connector", "connectors", { required: true }),
        text("object_type", { required: true, max: 60 }),
        text("external_id", { required: true, max: 120 }),
        url("url"),
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_external_refs_unique ON external_refs (connector, object_type, external_id, work_item)",
        "CREATE INDEX idx_external_refs_item ON external_refs (work_item)",
      ],
    });

    createCollection(app, {
      name: "event_outbox",
      fields: [
        rel("event_type", "event_types", { required: true }),
        text("aggregate_id", { max: 40, help: "Id del registro que originó el evento (ej. el caso)." }),
        json("payload", { required: true }),
        text("destination", { max: 120 }),
        select("status", ["pending", "processing", "delivered", "failed", "dead"], { required: true }),
        int("attempts", { min: 0 }),
        date("next_attempt_at"),
        longText("last_error"),
      ],
      indexes: ["CREATE INDEX idx_event_outbox_status ON event_outbox (status, next_attempt_at)"],
    });

    createCollection(app, {
      name: "api_keys",
      fields: [
        text("name", { required: true, presentable: true }),
        text("prefix", { required: true, max: 16 }),
        { name: "key_hash", type: "text", required: true, max: 255, hidden: true },
        json("scopes"),
        rel("client", "clients", { cascade: true, help: "Vacío = llave de la empresa; con cliente = limitada a ese cliente." }),
        rel("created_by", "users"),
        int("rate_limit_per_minute", { min: 0 }),
        date("expires_at"),
        date("last_used_at"),
        date("revoked_at"),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_api_keys_prefix ON api_keys (prefix)"],
    });

    createCollection(app, {
      name: "webhooks",
      fields: [
        text("name", { required: true, presentable: true }),
        url("url", { required: true }),
        secret("secret_encrypted"),
        rel("event_types", "event_types", { multiple: true, required: true }),
        rel("created_by", "users"),
        active(),
      ],
    });

    createCollection(app, {
      name: "webhook_deliveries",
      fields: [
        rel("webhook", "webhooks", { required: true, cascade: true }),
        rel("outbox_event", "event_outbox", { cascade: true }),
        select("status", ["success", "failed"], { required: true }),
        int("attempt", { min: 0 }),
        int("status_code", { min: 0 }),
        int("duration_ms", { min: 0 }),
        longText("response_body"),
      ],
      indexes: ["CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries (webhook, created)"],
    });
  },
  (app) => {
    require("/pb_hooks/lib/schema.js").dropCollections(app, COLLECTIONS);
  },
);
