/**
 * Lógica de base de datos de los casos: numeración, cachés e historial de estados.
 */

const RESOLVED = ["resolved", "closed"];

/** Asigna el siguiente número del tipo (ej. SOP-0007). La secuencia vive en work_item_types.last_number. */
function assignNumber(app, record) {
  if (record.get("number")) return;
  const type = app.findRecordById("work_item_types", record.get("type"));
  const row = new DynamicModel({ last_number: 0 });
  app
    .db()
    .newQuery("UPDATE work_item_types SET last_number = last_number + 1 WHERE id = {:id} RETURNING last_number")
    .bind({ id: type.id })
    .one(row);
  const padding = type.get("number_padding") || 4;
  record.set("number", `${type.get("number_prefix")}-${String(row.last_number).padStart(padding, "0")}`);
}

/** Mantiene status_category y las fechas/usuario de resolución según la categoría del estado. */
function syncStatusCache(app, record, previousCategory) {
  const status = app.findRecordById("statuses", record.get("status"));
  const category = status.get("category");
  record.set("status_category", category);
  if (category === previousCategory) return;

  const now = new DateTime();
  if (RESOLVED.includes(category)) {
    if (!record.getString("resolved_at")) {
      record.set("resolved_at", now);
      record.set("resolved_by", record.get("updated_by"));
    }
    if (category === "closed" && !record.getString("closed_at")) record.set("closed_at", now);
  } else if (RESOLVED.includes(previousCategory) || !previousCategory) {
    record.set("resolved_at", "");
    record.set("resolved_by", "");
    record.set("closed_at", "");
  }
}

/** Inserta una fila en work_item_status_history con el tiempo pasado en el estado anterior. */
function logStatusChange(app, record, fromStatus) {
  const history = app.findCollectionByNameOrId("work_item_status_history");
  const last = app.findRecordsByFilter("work_item_status_history", "work_item = {:id}", "-created", 1, 0, {
    id: record.id,
  });
  const since = last.length ? last[0].getDateTime("created") : record.getDateTime("created");
  const seconds = fromStatus ? Math.max(0, Math.floor(Date.now() / 1000) - since.unix()) : 0;

  const row = new Record(history);
  row.set("work_item", record.id);
  row.set("from_status", fromStatus || "");
  row.set("to_status", record.get("status"));
  row.set("to_category", record.get("status_category"));
  row.set("changed_by", record.get("updated_by") || record.get("created_by") || "");
  row.set("seconds_in_previous", seconds);
  app.save(row);
}

/** Recalcula progress_percent: peso de etapas cerradas / peso total (sin contar las canceladas/omitidas). */
function recomputeProgress(app, workItemId) {
  if (!workItemId) return;
  const stages = app.findRecordsByFilter("stages", "work_item = {:id}", "", 0, 0, { id: workItemId });
  let total = 0;
  let done = 0;
  stages.forEach((stage) => {
    const category = app.findRecordById("statuses", stage.get("status")).get("category");
    if (category === "cancelled") return;
    const weight = stage.get("weight") > 0 ? stage.get("weight") : 1;
    total += weight;
    if (RESOLVED.includes(category)) done += weight;
  });
  const percent = total ? Math.round((done / total) * 100) : 0;
  app.db().newQuery("UPDATE work_items SET progress_percent = {:p} WHERE id = {:id}").bind({ p: percent, id: workItemId }).execute();
}

module.exports = { assignNumber, syncStatusCache, logStatusChange, recomputeProgress };
