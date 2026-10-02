/// <reference path="../pb_data/types.d.ts" />
// Cada handler corre aislado: los módulos se cargan dentro del handler.

onRecordValidate((e) => {
  const { validators } = require(`${__hooks}/lib/integrity.js`);
  const validate = validators[e.record.collection().name];
  if (validate) validate(e.app, e.record);
  e.next();
});

onRecordCreate((e) => {
  const wi = require(`${__hooks}/lib/work_items.js`);
  wi.assignNumber(e.app, e.record);
  wi.syncStatusCache(e.app, e.record, "");
  if (!e.record.get("progress_percent")) e.record.set("progress_percent", 0);
  e.next();
  wi.logStatusChange(e.app, e.record, "");
}, "work_items");

onRecordUpdate((e) => {
  const wi = require(`${__hooks}/lib/work_items.js`);
  const original = e.record.original();
  const fromStatus = original.get("status");
  const changed = fromStatus !== e.record.get("status");
  if (changed) wi.syncStatusCache(e.app, e.record, original.get("status_category"));
  e.next();
  if (changed) wi.logStatusChange(e.app, e.record, fromStatus);
}, "work_items");

onRecordAfterCreateSuccess((e) => {
  require(`${__hooks}/lib/work_items.js`).recomputeProgress(e.app, e.record.get("work_item"));
  e.next();
}, "stages");

onRecordUpdate((e) => {
  const wi = require(`${__hooks}/lib/work_items.js`);
  const previous = e.record.original().get("work_item");
  e.next();
  wi.recomputeProgress(e.app, e.record.get("work_item"));
  if (previous !== e.record.get("work_item")) wi.recomputeProgress(e.app, previous);
}, "stages");

onRecordAfterDeleteSuccess((e) => {
  require(`${__hooks}/lib/work_items.js`).recomputeProgress(e.app, e.record.get("work_item"));
  e.next();
}, "stages");
