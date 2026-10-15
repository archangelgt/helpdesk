/// <reference path="../pb_data/types.d.ts" />
// Recordatorios de vencimientos: el worker revisa cada cierto tiempo los requerimientos al cliente,
// las etapas y los casos vencidos. Cada etapa o caso avisa una sola vez por fecha (overdue_notified_at).

const FIELD = "overdue_notified_at";

const find = (app, collection, field, value) => {
  try {
    return app.findFirstRecordByData(collection, field, value);
  } catch (_) {
    return null;
  }
};

migrate(
  (app) => {
    ["work_items", "stages"].forEach((name) => {
      const collection = app.findCollectionByNameOrId(name);
      if (!collection.fields.getByName(FIELD)) {
        collection.fields.add(new DateField({ name: FIELD }));
        app.save(collection);
      }
    });

    const setting = find(app, "settings", "key", "notifications.client_request_reminders");
    if (setting) {
      const value = setting.get("value") || {};
      if (value.max_reminders === undefined) {
        setting.set("value", { before_due_days: 1, on_due: true, every_days_after: 2, ...value, max_reminders: 6 });
        app.save(setting);
      }
    }

    const overdue = find(app, "event_types", "code", "stage.overdue");
    if (overdue) {
      app.findRecordsByFilter("notification_rules", "event_type = {:t}", "", 0, 0, { t: overdue.id }).forEach((rule) => {
        const recipients = rule.get("recipients") || [];
        if (!recipients.includes("assignee")) {
          rule.set("recipients", [...recipients, "assignee"]);
          app.save(rule);
        }
      });
    }
  },
  (app) => {
    ["work_items", "stages"].forEach((name) => {
      const collection = app.findCollectionByNameOrId(name);
      if (collection.fields.getByName(FIELD)) {
        collection.fields.removeByName(FIELD);
        app.save(collection);
      }
    });
  },
);
