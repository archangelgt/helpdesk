/// <reference path="../pb_data/types.d.ts" />
// E. SLA y calendario laboral.

const COLLECTIONS = ["business_calendars", "holidays", "sla_policies", "sla_targets"];

migrate(
  (app) => {
    const { createCollection, text, longText, bool, int, date, json, rel, active } = require("/pb_hooks/lib/schema.js");

    createCollection(app, {
      name: "business_calendars",
      fields: [
        text("name", { required: true, presentable: true }),
        text("timezone", { required: true, max: 64 }),
        json("working_hours", { help: '{"mon":[["08:00","17:00"]], ... } por día de la semana' }),
        bool("is_default"),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_business_calendars_name ON business_calendars (name)"],
    });

    createCollection(app, {
      name: "holidays",
      fields: [
        rel("calendar", "business_calendars", { required: true, cascade: true }),
        date("day", { required: true }),
        text("name", { required: true, presentable: true }),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_holidays_calendar_day ON holidays (calendar, day)"],
    });

    createCollection(app, {
      name: "sla_policies",
      fields: [
        text("name", { required: true, presentable: true }),
        longText("description"),
        rel("calendar", "business_calendars"),
        bool("is_default"),
        active(),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_sla_policies_name ON sla_policies (name)"],
    });

    createCollection(app, {
      name: "sla_targets",
      fields: [
        rel("policy", "sla_policies", { required: true, cascade: true }),
        rel("type", "work_item_types", { required: true, cascade: true }),
        rel("priority", "priorities", { required: true, cascade: true }),
        int("first_response_minutes", { min: 0 }),
        int("resolution_minutes", { min: 0 }),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_sla_targets_unique ON sla_targets (policy, type, priority)"],
    });
  },
  (app) => {
    require("/pb_hooks/lib/schema.js").dropCollections(app, COLLECTIONS);
  },
);
