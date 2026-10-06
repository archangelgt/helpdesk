/// <reference path="../pb_data/types.d.ts" />
// Los avisos salen por la API de correo de Zoho (clave MAIL_API_KEY en el .env del despliegue)
// desde soporte@seraphsystems.com, dominio ya verificado en esa cuenta.
// Etapas: se avisa al comenzar y al completar; "desbloqueada" siempre llega junto con "comenzó", así que no se manda aparte.

const FROM = "soporte@seraphsystems.com";
const OLD_FROM = "soporte@erpsys.pro";

const find = (app, collection, field, value) => {
  try {
    return app.findFirstRecordByData(collection, field, value);
  } catch (_) {
    return null;
  }
};

migrate(
  (app) => {
    const old = find(app, "email_senders", "from_email", OLD_FROM);
    if (old) {
      old.set("is_default", false);
      app.save(old);
    }

    const sender = find(app, "email_senders", "from_email", FROM) ?? new Record(app.findCollectionByNameOrId("email_senders"));
    sender.set("name", "Helpdesk");
    sender.set("from_email", FROM);
    sender.set("reply_to", "");
    sender.set("provider", "zeptomail");
    sender.set("smtp_host", "");
    sender.set("smtp_port", 0);
    sender.set("spf_ok", true);
    sender.set("dkim_ok", true);
    sender.set("is_default", true);
    sender.set("active", true);
    app.save(sender);

    const defaultSender = find(app, "settings", "key", "email.default_sender");
    if (defaultSender) {
      defaultSender.set("value", sender.id);
      app.save(defaultSender);
    }

    const eventType = (code) => find(app, "event_types", "code", code);
    const rulesFor = (code) => {
      const type = eventType(code);
      return type ? app.findRecordsByFilter("notification_rules", "event_type = {:t}", "", 0, 0, { t: type.id }) : [];
    };
    const email = find(app, "notification_channels", "code", "email");

    const started = eventType("stage.started");
    if (started && email && !rulesFor("stage.started").length) {
      const rule = new Record(app.findCollectionByNameOrId("notification_rules"));
      rule.set("event_type", started.id);
      rule.set("recipients", ["client_contacts", "stage_owner", "assignee"]);
      rule.set("channels", [email.id]);
      rule.set("active", true);
      app.save(rule);
    }
    rulesFor("stage.unlocked").forEach((rule) => {
      rule.set("active", false);
      app.save(rule);
    });
    rulesFor("stage.completed").forEach((rule) => {
      const recipients = rule.get("recipients") || [];
      if (!recipients.includes("assignee")) {
        rule.set("recipients", [...recipients, "assignee"]);
        app.save(rule);
      }
    });
  },
  (app) => {
    const sender = find(app, "email_senders", "from_email", FROM);
    if (sender) app.delete(sender);
    const old = find(app, "email_senders", "from_email", OLD_FROM);
    if (old) {
      old.set("is_default", true);
      app.save(old);
      const defaultSender = find(app, "settings", "key", "email.default_sender");
      if (defaultSender) {
        defaultSender.set("value", old.id);
        app.save(defaultSender);
      }
    }
  },
);
