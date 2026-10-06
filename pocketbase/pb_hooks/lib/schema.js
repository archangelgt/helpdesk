/**
 * Helpers declarativos para las migraciones (pb_migrations).
 *
 * - Toda colección recibe `created` y `updated` (PocketBase no los agrega solo).
 * - Las relaciones se declaran con `to: "<colección>"` y se resuelven a su id.
 * - Sin reglas de API: solo superusuarios (la API de v2 aplica RBAC; PocketBase es la segunda capa).
 */

const AUDIT_FIELDS = [
  { name: "created", type: "autodate", onCreate: true, onUpdate: false },
  { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
];

const CODE_PATTERN = "^[a-z0-9]+([._-][a-z0-9]+)*$";
const LANGUAGES = ["es", "en", "pt"];
const STATUS_CATEGORIES = [
  "new",
  "open",
  "in_progress",
  "waiting_client",
  "waiting_internal",
  "resolved",
  "closed",
  "cancelled",
];
const RESPONSIBLE_SIDES = ["internal", "client", "shared"];
const CLIENT_REQUEST_TYPES = ["information", "document", "data_upload", "access", "approval", "meeting"];

function resolveField(app, field, selfId) {
  if (field.type !== "relation" || !field.to) return field;
  const { to, multiple, cascade, ...rest } = field;
  return {
    ...rest,
    collectionId: to === "@self" ? selfId : app.findCollectionByNameOrId(to).id,
    maxSelect: multiple ? 999 : 1,
    minSelect: 0,
    cascadeDelete: !!cascade,
  };
}

/** Crea una colección base. `selfRelations` se agregan después (relaciones a sí misma). */
function createCollection(app, def) {
  const { name, fields = [], indexes = [], selfRelations = [], type = "base" } = def;
  const collection = new Collection({
    type,
    name,
    fields: [...fields.map((f) => resolveField(app, f)), ...AUDIT_FIELDS],
    indexes: selfRelations.length ? [] : indexes,
  });
  app.save(collection);

  if (selfRelations.length) {
    selfRelations.forEach((f) => collection.fields.add(new Field(resolveField(app, f, collection.id))));
    collection.indexes = indexes;
    app.save(collection);
  }
  return collection;
}

/** Agrega campos (y opcionalmente índices) a una colección existente. */
function addFields(app, name, fields, indexes = []) {
  const collection = app.findCollectionByNameOrId(name);
  fields.forEach((f) => collection.fields.add(new Field(resolveField(app, f, collection.id))));
  if (indexes.length) collection.indexes = [...collection.indexes, ...indexes];
  app.save(collection);
  return collection;
}

function dropCollections(app, names) {
  [...names].reverse().forEach((name) => {
    try {
      app.delete(app.findCollectionByNameOrId(name));
    } catch (_) {
      // ya no existe
    }
  });
}

// Atajos de campos
const text = (name, opts = {}) => ({ name, type: "text", max: 255, ...opts });
const longText = (name, opts = {}) => ({ name, type: "text", max: 5000, ...opts });
const code = (name = "code", opts = {}) => ({ name, type: "text", max: 80, pattern: CODE_PATTERN, required: true, presentable: true, ...opts });
const labelKey = () => ({ name: "label_key", type: "text", max: 120 });
const bool = (name, opts = {}) => ({ name, type: "bool", ...opts });
const int = (name, opts = {}) => ({ name, type: "number", onlyInt: true, ...opts });
const date = (name, opts = {}) => ({ name, type: "date", ...opts });
const json = (name, opts = {}) => ({ name, type: "json", maxSize: 1048576, ...opts });
const select = (name, values, opts = {}) => ({ name, type: "select", values, maxSelect: opts.multiple ? values.length : 1, ...opts });
const rel = (name, to, opts = {}) => ({ name, type: "relation", to, ...opts });
const editor = (name, opts = {}) => ({ name, type: "editor", maxSize: 1048576, convertURLs: false, ...opts });
const email = (name, opts = {}) => ({ name, type: "email", ...opts });
const url = (name, opts = {}) => ({ name, type: "url", ...opts });
const color = () => ({ name: "color", type: "text", max: 9, pattern: "^(#[0-9a-fA-F]{6})?$" });
const sortOrder = () => int("sort_order", { min: 0 });
const active = () => bool("active");
const secret = (name) => ({ name, type: "text", max: 10000, hidden: true });

module.exports = {
  AUDIT_FIELDS,
  CODE_PATTERN,
  LANGUAGES,
  STATUS_CATEGORIES,
  RESPONSIBLE_SIDES,
  CLIENT_REQUEST_TYPES,
  createCollection,
  addFields,
  dropCollections,
  text,
  longText,
  code,
  labelKey,
  bool,
  int,
  date,
  json,
  select,
  rel,
  editor,
  email,
  url,
  color,
  sortOrder,
  active,
  secret,
};
