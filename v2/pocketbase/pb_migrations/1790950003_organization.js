/// <reference path="../pb_data/types.d.ts" />
// A. Personas y organización: clientes, usuarios (auth), contactos, contrataciones, equipos, identidades externas.

const COLLECTIONS = ["clients", "client_contacts", "client_products", "teams", "team_members", "external_identities"];
const USER_FIELDS = ["phone", "role", "client", "status", "language", "timezone", "color_mode", "theme", "last_seen_at"];

migrate(
  (app) => {
    const s = require("/pb_hooks/lib/schema.js");
    const { createCollection, addFields, text, longText, bool, date, json, select, rel, active } = s;

    createCollection(app, {
      name: "clients",
      fields: [
        text("name", { required: true, presentable: true }),
        text("legal_name"),
        text("tax_id", { max: 40 }),
        select("status", ["active", "inactive", "prospect"], { required: true }),
        rel("sla_policy", "sla_policies"),
        select("default_language", s.LANGUAGES),
        text("timezone", { max: 64 }),
        longText("notes"),
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_clients_tax_id ON clients (tax_id) WHERE tax_id != ''",
        "CREATE INDEX idx_clients_name ON clients (name)",
      ],
    });

    // `users` es la colección auth que trae PocketBase: se completa y se cierra (la API autentica y autoriza).
    const users = app.findCollectionByNameOrId("users");
    users.listRule = null;
    users.viewRule = null;
    users.createRule = null;
    users.updateRule = null;
    users.deleteRule = null;
    app.save(users);

    addFields(
      app,
      "users",
      [
        text("phone", { max: 40 }),
        rel("role", "roles"),
        rel("client", "clients", { help: "Vacío = personal interno de la empresa." }),
        select("status", ["active", "invited", "suspended"]),
        select("language", s.LANGUAGES),
        text("timezone", { max: 64 }),
        select("color_mode", ["light", "dark", "system"]),
        select("theme", ["blue", "orange", "green", "purple", "pink", "slate"]),
        date("last_seen_at"),
      ],
      ["CREATE INDEX idx_users_client ON users (client)", "CREATE INDEX idx_users_role ON users (role)"],
    );

    addFields(app, "clients", [rel("account_manager", "users")]);

    createCollection(app, {
      name: "client_contacts",
      fields: [
        rel("client", "clients", { required: true, cascade: true }),
        rel("user", "users", { required: true, cascade: true }),
        select("contact_type", ["primary", "technical", "approver", "billing"], { required: true }),
        bool("receives_notifications"),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_client_contacts_unique ON client_contacts (client, user, contact_type)"],
    });

    createCollection(app, {
      name: "client_products",
      fields: [
        rel("client", "clients", { required: true, cascade: true }),
        rel("product", "products", { required: true }),
        text("plan", { max: 80 }),
        select("license_status", ["active", "trial", "suspended", "expired"]),
        date("starts_on"),
        date("ends_on"),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_client_products_unique ON client_products (client, product)"],
    });

    createCollection(app, {
      name: "teams",
      fields: [
        text("name", { required: true, presentable: true }),
        longText("description"),
        rel("main_product", "products"),
        active(),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_teams_name ON teams (name)"],
    });

    createCollection(app, {
      name: "team_members",
      fields: [
        rel("team", "teams", { required: true, cascade: true }),
        rel("user", "users", { required: true, cascade: true }),
        select("team_role", ["leader", "member"], { required: true }),
      ],
      indexes: ["CREATE UNIQUE INDEX idx_team_members_unique ON team_members (team, user)"],
    });

    createCollection(app, {
      name: "external_identities",
      fields: [
        rel("connector", "connectors", { required: true }),
        select("entity", ["user", "client"], { required: true }),
        rel("user", "users", { cascade: true }),
        rel("client", "clients", { cascade: true }),
        text("external_id", { required: true, max: 120 }),
        json("snapshot"),
        date("last_synced_at"),
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_external_identities_unique ON external_identities (connector, entity, external_id)",
        "CREATE INDEX idx_external_identities_user ON external_identities (user)",
        "CREATE INDEX idx_external_identities_client ON external_identities (client)",
      ],
    });
  },
  (app) => {
    const s = require("/pb_hooks/lib/schema.js");
    const users = app.findCollectionByNameOrId("users");
    USER_FIELDS.forEach((name) => users.fields.removeByName(name));
    users.indexes = users.indexes.filter((i) => !i.includes("idx_users_client") && !i.includes("idx_users_role"));
    app.save(users);
    const clients = app.findCollectionByNameOrId("clients");
    clients.fields.removeByName("account_manager");
    app.save(clients);
    s.dropCollections(app, COLLECTIONS);
  },
);
