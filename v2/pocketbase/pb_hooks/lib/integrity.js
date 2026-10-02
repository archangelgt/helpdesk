/**
 * Reglas de integridad que PocketBase no expresa con relaciones e índices.
 * Se ejecutan en onRecordValidate (API, panel y app.save en migraciones).
 */

function fail(field, message) {
  throw new BadRequestError(message, { [field]: new ValidationError("validation_integrity", message) });
}

function find(app, collection, id) {
  return id ? app.findRecordById(collection, id) : null;
}

function exactlyOne(record, fields, label) {
  const set = fields.filter((f) => !!record.get(f));
  if (set.length !== 1) fail(fields[0], `${label} debe tener exactamente un dueño (${fields.join(", ")}).`);
}

function singleDefault(app, record, collection, field = "is_default") {
  if (!record.get(field)) return;
  const others = app.findRecordsByFilter(collection, `${field} = true && id != {:id}`, "", 1, 0, { id: record.id });
  if (others.length) fail(field, `Solo puede haber un registro por defecto en ${collection}.`);
}

/** Recorre dependencias desde `start` y falla si llega a `target` (ciclo). */
function assertNoCycle(app, collection, target, start) {
  const seen = {};
  const queue = [start];
  while (queue.length) {
    const current = queue.shift();
    if (current === target) fail("depends_on", "La dependencia crea un ciclo.");
    if (seen[current]) continue;
    seen[current] = true;
    app.findRecordsByFilter(collection, "stage = {:s}", "", 0, 0, { s: current }).forEach((d) => queue.push(d.get("depends_on")));
  }
}

const validators = {
  workflow_transitions(app, r) {
    if (r.get("from_status") === r.get("to_status")) fail("to_status", "El estado destino debe ser distinto del origen.");
    const from = find(app, "statuses", r.get("from_status"));
    const to = find(app, "statuses", r.get("to_status"));
    if (from.get("workflow") !== to.get("workflow")) fail("to_status", "Ambos estados deben pertenecer al mismo flujo.");
  },

  statuses(app, r) {
    if (!r.get("is_initial")) return;
    const others = app.findRecordsByFilter(
      "statuses",
      "workflow = {:w} && is_initial = true && id != {:id}",
      "",
      1,
      0,
      { w: r.get("workflow"), id: r.id },
    );
    if (others.length) fail("is_initial", "El flujo ya tiene un estado inicial.");
  },

  work_item_types(app, r) {
    const workflow = find(app, "workflows", r.get("workflow"));
    if (workflow.get("applies_to") !== "work_item") fail("workflow", "El flujo del tipo debe aplicar a casos.");
    if (r.get("has_stages")) {
      const stageWorkflow = find(app, "workflows", r.get("stage_workflow"));
      if (!stageWorkflow) fail("stage_workflow", "Un tipo con etapas necesita flujo de etapas.");
      if (stageWorkflow.get("applies_to") !== "stage") fail("stage_workflow", "El flujo de etapas debe aplicar a etapas.");
    }
  },

  categories(app, r) {
    if (!r.get("parent")) return;
    if (r.get("parent") === r.id) fail("parent", "Una categoría no puede ser su propia madre.");
    const parent = find(app, "categories", r.get("parent"));
    if (parent.get("type") !== r.get("type")) fail("parent", "La categoría madre debe ser del mismo tipo de caso.");
  },

  priorities: (app, r) => singleDefault(app, r, "priorities"),
  business_calendars: (app, r) => singleDefault(app, r, "business_calendars"),
  sla_policies: (app, r) => singleDefault(app, r, "sla_policies"),
  email_senders: (app, r) => singleDefault(app, r, "email_senders"),

  client_contacts(app, r) {
    const user = find(app, "users", r.get("user"));
    if (user.get("client") !== r.get("client")) fail("user", "El contacto debe ser un usuario de ese cliente.");
  },

  external_identities(app, r) {
    const isUser = r.get("entity") === "user";
    if (isUser ? !r.get("user") || r.get("client") : !r.get("client") || r.get("user")) {
      fail("entity", "La identidad externa debe apuntar solo a un usuario o solo a un cliente, según `entity`.");
    }
  },

  template_stage_dependencies(app, r) {
    if (r.get("stage") === r.get("depends_on")) fail("depends_on", "Una etapa no puede depender de sí misma.");
    const stage = find(app, "template_stages", r.get("stage"));
    const dep = find(app, "template_stages", r.get("depends_on"));
    if (stage.get("template") !== dep.get("template")) fail("depends_on", "Ambas etapas deben ser de la misma plantilla.");
    assertNoCycle(app, "template_stage_dependencies", r.get("stage"), r.get("depends_on"));
  },

  work_items(app, r) {
    const type = find(app, "work_item_types", r.get("type"));
    const status = find(app, "statuses", r.get("status"));
    if (status.get("workflow") !== type.get("workflow")) fail("status", "El estado no pertenece al flujo de este tipo de caso.");
    if (type.get("requires_product") && !r.get("product")) fail("product", "Este tipo de caso requiere producto.");
    if (r.get("category")) {
      const category = find(app, "categories", r.get("category"));
      if (category.get("type") !== type.id) fail("category", "La categoría no corresponde a este tipo de caso.");
    }
    if (r.get("parent") && r.get("parent") === r.id) fail("parent", "Un caso no puede ser su propio padre.");
    if (r.get("requester") && r.get("client")) {
      const requester = find(app, "users", r.get("requester"));
      if (requester.get("client") && requester.get("client") !== r.get("client")) {
        fail("requester", "El solicitante pertenece a otro cliente.");
      }
    }
  },

  stages(app, r) {
    const item = find(app, "work_items", r.get("work_item"));
    const type = find(app, "work_item_types", item.get("type"));
    if (!type.get("has_stages")) fail("work_item", "Este tipo de caso no usa etapas.");
    const status = find(app, "statuses", r.get("status"));
    if (status.get("workflow") !== type.get("stage_workflow")) fail("status", "El estado no pertenece al flujo de etapas.");
  },

  stage_dependencies(app, r) {
    if (r.get("stage") === r.get("depends_on")) fail("depends_on", "Una etapa no puede depender de sí misma.");
    const stage = find(app, "stages", r.get("stage"));
    const dep = find(app, "stages", r.get("depends_on"));
    if (stage.get("work_item") !== dep.get("work_item")) fail("depends_on", "Ambas etapas deben ser del mismo caso.");
    assertNoCycle(app, "stage_dependencies", r.get("stage"), r.get("depends_on"));
  },

  work_item_assignments(app, r) {
    if (!r.get("stage")) return;
    const stage = find(app, "stages", r.get("stage"));
    if (stage.get("work_item") !== r.get("work_item")) fail("stage", "La etapa no pertenece a este caso.");
  },

  work_item_links(app, r) {
    if (r.get("source") === r.get("target")) fail("target", "Un caso no puede vincularse consigo mismo.");
  },

  custom_field_values(app, r) {
    const item = find(app, "work_items", r.get("work_item"));
    const field = find(app, "custom_fields", r.get("field"));
    if (field.get("type") !== item.get("type")) fail("field", "El campo extra no corresponde al tipo de este caso.");
  },

  checklist_items(app, r) {
    exactlyOne(r, ["work_item", "stage"], "El elemento de checklist");
  },

  client_requests(app, r) {
    if (!r.get("stage")) return;
    const stage = find(app, "stages", r.get("stage"));
    if (stage.get("work_item") !== r.get("work_item")) fail("stage", "La etapa no pertenece a este caso.");
  },

  comments(app, r) {
    if (r.get("stage")) {
      const stage = find(app, "stages", r.get("stage"));
      if (stage.get("work_item") !== r.get("work_item")) fail("stage", "La etapa no pertenece a este caso.");
    }
    if (r.get("client_request")) {
      const request = find(app, "client_requests", r.get("client_request"));
      if (request.get("work_item") !== r.get("work_item")) fail("client_request", "El requerimiento no pertenece a este caso.");
    }
  },

  attachments(app, r) {
    exactlyOne(r, ["work_item", "comment", "stage", "client_request"], "El adjunto");
  },

  saved_views(app, r) {
    if (r.get("owner_user") && r.get("owner_team")) fail("owner_team", "La vista pertenece a un usuario o a un equipo, no a ambos.");
  },
};

module.exports = { validators, fail };
