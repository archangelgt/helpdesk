/// <reference path="../pb_data/types.d.ts" />
// Datos de fábrica de cada instancia. Cada empresa puede renombrarlos o ampliarlos desde la configuración.

const SEEDED = [
  "roles",
  "permissions",
  "role_permissions",
  "event_types",
  "connectors",
  "priorities",
  "channels",
  "products",
  "workflows",
  "statuses",
  "workflow_transitions",
  "work_item_types",
  "categories",
  "business_calendars",
  "holidays",
  "sla_policies",
  "sla_targets",
  "teams",
  "templates",
  "template_stages",
  "template_stage_dependencies",
  "template_checklist_items",
  "template_client_requests",
  "notification_channels",
  "notification_rules",
  "settings",
];

migrate(
  (app) => {
    const insert = (collection, data) => {
      const record = new Record(app.findCollectionByNameOrId(collection));
      Object.keys(data).forEach((k) => record.set(k, data[k]));
      app.save(record);
      return record;
    };
    const byCode = {};
    const remember = (group, codeValue, record) => {
      byCode[group] = byCode[group] || {};
      byCode[group][codeValue] = record.id;
      return record;
    };

    // --- Roles y permisos ---------------------------------------------------
    const ROLES = [
      ["owner", "Dueño", "staff"],
      ["manager", "Jefe", "staff"],
      ["technician", "Técnico", "staff"],
      ["agent", "Agente", "staff"],
      ["viewer", "Solo lectura", "staff"],
      ["client_admin", "Administrador del cliente", "client"],
      ["client_user", "Usuario del cliente", "client"],
    ];
    ROLES.forEach(([code, name, scope]) =>
      remember("roles", code, insert("roles", { code, name, scope, label_key: `role.${code}`, is_system: true, active: true })),
    );

    const PERMISSIONS = [
      ["work_item.view", "work_items"],
      ["work_item.view_all", "work_items"],
      ["work_item.create", "work_items"],
      ["work_item.update", "work_items"],
      ["work_item.assign", "work_items"],
      ["work_item.transition", "work_items"],
      ["work_item.delete", "work_items"],
      ["comment.create_public", "comments"],
      ["comment.create_internal", "comments"],
      ["comment.view_internal", "comments"],
      ["stage.manage", "implementations"],
      ["stage.complete", "implementations"],
      ["stage.approve", "implementations"],
      ["client_request.create", "implementations"],
      ["client_request.submit", "implementations"],
      ["client_request.review", "implementations"],
      ["template.manage", "configuration"],
      ["catalog.manage", "configuration"],
      ["settings.manage", "configuration"],
      ["integration.manage", "configuration"],
      ["api_key.manage", "configuration"],
      ["client.manage", "administration"],
      ["user.manage", "administration"],
      ["team.manage", "administration"],
      ["audit.view", "administration"],
      ["report.view", "reports"],
    ];
    PERMISSIONS.forEach(([code, module]) =>
      remember("permissions", code, insert("permissions", { code, module, label_key: `permission.${code}` })),
    );

    const ALL = PERMISSIONS.map(([code]) => code);
    const ROLE_PERMISSIONS = {
      owner: ALL,
      manager: ALL.filter((p) => !["settings.manage", "integration.manage", "api_key.manage", "audit.view"].includes(p)),
      technician: [
        "work_item.view", "work_item.view_all", "work_item.create", "work_item.update", "work_item.transition",
        "comment.create_public", "comment.create_internal", "comment.view_internal",
        "stage.manage", "stage.complete", "client_request.create", "client_request.review", "report.view",
      ],
      agent: [
        "work_item.view", "work_item.view_all", "work_item.create", "work_item.update", "work_item.assign", "work_item.transition",
        "comment.create_public", "comment.create_internal", "comment.view_internal",
        "client_request.create", "client_request.review",
      ],
      viewer: ["work_item.view", "work_item.view_all", "comment.view_internal", "report.view"],
      client_admin: ["work_item.view", "work_item.create", "comment.create_public", "stage.approve", "client_request.submit"],
      client_user: ["work_item.view", "work_item.create", "comment.create_public", "client_request.submit"],
    };
    Object.keys(ROLE_PERMISSIONS).forEach((role) =>
      ROLE_PERMISSIONS[role].forEach((perm) =>
        insert("role_permissions", { role: byCode.roles[role], permission: byCode.permissions[perm] }),
      ),
    );

    // --- Eventos --------------------------------------------------------------
    const EVENTS = [
      ["work_item.created", "work_items", true],
      ["work_item.assigned", "work_items", false],
      ["work_item.status_changed", "work_items", true],
      ["comment.public_added", "work_items", true],
      ["stage.started", "implementations", true],
      ["stage.completed", "implementations", true],
      ["stage.unlocked", "implementations", true],
      ["stage.overdue", "implementations", false],
      ["implementation.completed", "implementations", true],
      ["client_request.created", "client_requests", true],
      ["client_request.reminder", "client_requests", true],
      ["client_request.overdue", "client_requests", true],
      ["client_request.submitted", "client_requests", false],
      ["client_request.accepted", "client_requests", true],
      ["client_request.rejected", "client_requests", true],
      ["approval.requested", "implementations", true],
      ["sla.warning", "sla", false],
      ["sla.breached", "sla", false],
      ["digest.daily_manager", "digests", false],
      ["digest.weekly_client", "digests", true],
    ];
    EVENTS.forEach(([code, module, clientVisible]) =>
      remember("events", code, insert("event_types", { code, module, label_key: `event.${code}`, client_visible: clientVisible, active: true })),
    );

    // --- Conectores, prioridades, canales, productos -------------------------
    insert("connectors", { code: "erpsys", name: "ERPSYS", kind: "erpsys", base_url: "https://v1.erpsys.pro/API/v1/files", health: "unknown", active: false });
    insert("connectors", { code: "erpsyschat", name: "Seraph Chat (erpsyschat)", kind: "erpsyschat", health: "unknown", active: false });

    [
      ["critical", "Crítica", 4, "#c0392b"],
      ["high", "Alta", 3, "#f26522"],
      ["medium", "Media", 2, "#c27c0e"],
      ["low", "Baja", 1, "#3d6eaa"],
    ].forEach(([code, name, level, color]) =>
      remember("priorities", code, insert("priorities", { code, name, level, color, label_key: `priority.${code}`, is_default: code === "medium", active: true })),
    );

    [
      ["web", "Aplicación web"],
      ["portal", "Portal del cliente"],
      ["email", "Correo"],
      ["api", "API"],
      ["widget", "Widget"],
      ["chat", "Chat (erpsyschat)"],
    ].forEach(([code, name]) => remember("channels", code, insert("channels", { code, name, label_key: `channel.${code}`, active: true })));

    [
      ["erpsys", "ERPSYS"],
      ["erpsyschat", "Seraph Chat"],
      ["helpdesk", "Helpdesk"],
    ].forEach(([code, name]) => remember("products", code, insert("products", { code, name, active: true })));

    // --- Flujos, estados y transiciones -------------------------------------
    const STAFF = ["owner", "manager", "technician", "agent"];
    const WITH_CLIENT = [...STAFF, "client_admin", "client_user"];
    const WORKFLOWS = {
      support: {
        name: "Soporte",
        applies_to: "work_item",
        statuses: [
          ["nuevo", "Nuevo", "new", "#6b7c8f", { is_initial: true }],
          ["asignado", "Asignado", "open", "#3d6eaa"],
          ["en_progreso", "En progreso", "in_progress", "#c27c0e"],
          ["en_espera_cliente", "En espera del cliente", "waiting_client", "#7b4fd6", { pauses_sla: true, client_label: "Esperando tu respuesta" }],
          ["resuelto", "Resuelto", "resolved", "#1f8a4c"],
          ["reabierto", "Reabierto", "open", "#c0392b"],
          ["cerrado", "Cerrado", "closed", "#2f3b48", { is_final: true }],
          ["cancelado", "Cancelado", "cancelled", "#9aa6b2", { is_final: true }],
        ],
        transitions: [
          ["nuevo", "asignado"],
          ["nuevo", "en_progreso"],
          ["asignado", "en_progreso"],
          ["en_progreso", "en_espera_cliente"],
          ["en_espera_cliente", "en_progreso", { roles: WITH_CLIENT }],
          ["en_progreso", "resuelto"],
          ["resuelto", "cerrado", { roles: WITH_CLIENT }],
          ["resuelto", "reabierto", { roles: WITH_CLIENT, comment: true }],
          ["reabierto", "en_progreso"],
          ["nuevo", "cancelado", { comment: true }],
          ["asignado", "cancelado", { comment: true }],
        ],
      },
      implementation: {
        name: "Implementación",
        applies_to: "work_item",
        statuses: [
          ["planificada", "Planificada", "new", "#6b7c8f", { is_initial: true }],
          ["en_curso", "En curso", "in_progress", "#c27c0e"],
          ["esperando_cliente", "Esperando cliente", "waiting_client", "#7b4fd6", { pauses_sla: true, client_label: "Esperando tu información" }],
          ["en_pausa", "En pausa", "waiting_internal", "#9aa6b2"],
          ["completada", "Completada", "closed", "#1f8a4c", { is_final: true }],
          ["cancelada", "Cancelada", "cancelled", "#2f3b48", { is_final: true }],
        ],
        transitions: [
          ["planificada", "en_curso"],
          ["en_curso", "esperando_cliente"],
          ["esperando_cliente", "en_curso"],
          ["en_curso", "en_pausa", { comment: true }],
          ["en_pausa", "en_curso"],
          ["en_curso", "completada"],
          ["planificada", "cancelada", { comment: true }],
          ["en_curso", "cancelada", { comment: true }],
          ["en_pausa", "cancelada", { comment: true }],
        ],
      },
      stage: {
        name: "Etapas de implementación",
        applies_to: "stage",
        statuses: [
          ["pendiente", "Pendiente", "new", "#9aa6b2", { is_initial: true }],
          ["en_curso", "En curso", "in_progress", "#c27c0e"],
          ["esperando_cliente", "Esperando cliente", "waiting_client", "#7b4fd6", { pauses_sla: true, client_label: "Pendiente de tu parte" }],
          ["en_revision", "En revisión del cliente", "waiting_client", "#3d6eaa", { pauses_sla: true, client_label: "Pendiente de tu aprobación" }],
          ["bloqueada", "Bloqueada", "waiting_internal", "#c0392b"],
          ["completada", "Completada", "closed", "#1f8a4c", { is_final: true }],
          ["omitida", "Omitida", "cancelled", "#6b7c8f", { is_final: true }],
        ],
        transitions: [
          ["pendiente", "en_curso"],
          ["en_curso", "esperando_cliente"],
          ["esperando_cliente", "en_curso"],
          ["en_curso", "en_revision"],
          ["en_revision", "completada", { roles: [...STAFF, "client_admin"] }],
          ["en_revision", "en_curso", { roles: [...STAFF, "client_admin"], comment: true }],
          ["en_curso", "completada"],
          ["en_curso", "bloqueada", { comment: true }],
          ["bloqueada", "en_curso"],
          ["pendiente", "omitida", { comment: true }],
        ],
      },
      task: {
        name: "Tareas",
        applies_to: "work_item",
        statuses: [
          ["pendiente", "Pendiente", "new", "#9aa6b2", { is_initial: true }],
          ["en_progreso", "En progreso", "in_progress", "#c27c0e"],
          ["hecha", "Hecha", "closed", "#1f8a4c", { is_final: true }],
          ["cancelada", "Cancelada", "cancelled", "#6b7c8f", { is_final: true }],
        ],
        transitions: [
          ["pendiente", "en_progreso"],
          ["pendiente", "hecha"],
          ["en_progreso", "hecha"],
          ["hecha", "en_progreso"],
          ["pendiente", "cancelada"],
          ["en_progreso", "cancelada"],
        ],
      },
    };

    Object.keys(WORKFLOWS).forEach((wfCode) => {
      const wf = WORKFLOWS[wfCode];
      const workflow = remember(
        "workflows",
        wfCode,
        insert("workflows", { code: wfCode, name: wf.name, applies_to: wf.applies_to, label_key: `workflow.${wfCode}`, is_system: true, active: true }),
      );
      const statusIds = {};
      wf.statuses.forEach(([code, name, category, color, extra], i) => {
        const status = insert("statuses", {
          workflow: workflow.id,
          code,
          name,
          category,
          color,
          sort_order: i,
          label_key: `status.${wfCode}.${code}`,
          is_initial: false,
          is_final: false,
          pauses_sla: false,
          active: true,
          ...(extra || {}),
        });
        statusIds[code] = status.id;
      });
      wf.transitions.forEach(([from, to, opts]) => {
        const o = opts || {};
        insert("workflow_transitions", {
          from_status: statusIds[from],
          to_status: statusIds[to],
          allowed_roles: (o.roles || []).map((r) => byCode.roles[r]),
          requires_comment: !!o.comment,
          requires_evidence: false,
        });
      });
      byCode[`statuses_${wfCode}`] = statusIds;
    });

    // --- Tipos de caso y categorías -----------------------------------------
    const TYPES = [
      { code: "support", name: "Soporte", prefix: "SOP", icon: "life-buoy", color: "#3d6eaa", workflow: "support", has_stages: false, client_visible: true },
      { code: "implementation", name: "Implementación", prefix: "IMP", icon: "layers", color: "#f26522", workflow: "implementation", stage_workflow: "stage", has_stages: true, client_visible: true },
      { code: "task", name: "Tarea interna", prefix: "TAR", icon: "list-todo", color: "#1f8a4c", workflow: "task", has_stages: false, client_visible: false },
    ];
    TYPES.forEach((t, i) =>
      remember(
        "types",
        t.code,
        insert("work_item_types", {
          code: t.code,
          name: t.name,
          label_key: `type.${t.code}`,
          icon: t.icon,
          color: t.color,
          number_prefix: t.prefix,
          number_padding: 4,
          last_number: 0,
          workflow: byCode.workflows[t.workflow],
          stage_workflow: t.stage_workflow ? byCode.workflows[t.stage_workflow] : "",
          default_priority: byCode.priorities.medium,
          has_stages: t.has_stages,
          client_visible: t.client_visible,
          requires_product: false,
          sort_order: i,
          active: true,
        }),
      ),
    );

    ["Error del sistema", "Consulta de uso", "Solicitud de cambio", "Accesos y usuarios"].forEach((name, i) =>
      insert("categories", { type: byCode.types.support, name, sort_order: i, active: true }),
    );

    // --- Calendario y SLA ----------------------------------------------------
    const weekday = [["08:00", "17:00"]];
    const calendar = insert("business_calendars", {
      name: "Guatemala (lunes a viernes 08:00–17:00)",
      timezone: "America/Guatemala",
      working_hours: { mon: weekday, tue: weekday, wed: weekday, thu: weekday, fri: weekday, sat: [], sun: [] },
      is_default: true,
    });
    [
      ["2026-01-01", "Año Nuevo"],
      ["2026-04-02", "Jueves Santo"],
      ["2026-04-03", "Viernes Santo"],
      ["2026-05-01", "Día del Trabajo"],
      ["2026-06-30", "Día del Ejército"],
      ["2026-09-15", "Día de la Independencia"],
      ["2026-10-20", "Día de la Revolución"],
      ["2026-11-01", "Día de Todos los Santos"],
      ["2026-12-25", "Navidad"],
    ].forEach(([day, name]) => insert("holidays", { calendar: calendar.id, day: `${day} 00:00:00.000Z`, name }));

    const policy = insert("sla_policies", {
      name: "Estándar",
      description: "Metas de respuesta y resolución en horario laboral.",
      calendar: calendar.id,
      is_default: true,
      active: true,
    });
    [
      ["critical", 60, 480],
      ["high", 120, 960],
      ["medium", 240, 1440],
      ["low", 480, 2880],
    ].forEach(([priority, firstResponse, resolution]) =>
      insert("sla_targets", {
        policy: policy.id,
        type: byCode.types.support,
        priority: byCode.priorities[priority],
        first_response_minutes: firstResponse,
        resolution_minutes: resolution,
      }),
    );

    // --- Equipos -------------------------------------------------------------
    insert("teams", { name: "Soporte", description: "Atención de tickets de soporte.", main_product: byCode.products.erpsys, active: true });
    insert("teams", { name: "Implementaciones", description: "Implementaciones de clientes nuevos.", main_product: byCode.products.erpsys, active: true });

    // --- Plantilla de implementación ----------------------------------------
    const template = insert("templates", {
      type: byCode.types.implementation,
      product: byCode.products.erpsys,
      name: "Implementación ERPSYS",
      description: "Plantilla base para implementar ERPSYS en un cliente nuevo.",
      active: true,
    });

    const STAGES = [
      {
        name: "Kickoff", side: "shared", days: 2, role: "manager",
        checklist: ["Reunión de arranque con el cliente", "Definir contactos del cliente", "Aprobar plan de trabajo"],
      },
      {
        name: "Carga de información", side: "client", days: 5, role: "technician",
        description: "El cliente entrega catálogos y datos maestros usando las plantillas enviadas.",
        checklist: ["Enviar plantillas al cliente", "Recibir y validar catálogos", "Importar datos al ERP"],
        requests: [
          ["Catálogo de productos", "data_upload", true, 3, "Excel con código, descripción, precio y existencias."],
          ["Listado de clientes", "data_upload", true, 3, "Excel con nombre, NIT, dirección y condiciones de crédito."],
          ["Usuarios y permisos", "information", true, 3, "Quién usará el sistema y qué puede hacer cada persona."],
          ["Logo de la empresa", "document", false, 5, "PNG o SVG para documentos y facturas."],
          ["Acceso al servidor o VPN", "access", false, 5, "Datos de acceso si la instalación es en su servidor."],
        ],
      },
      {
        name: "Configuración", side: "internal", days: 7, role: "technician",
        checklist: ["Parametrizar empresa e impuestos", "Configurar documentos y correlativos", "Configurar usuarios y permisos"],
      },
      {
        name: "Capacitación", side: "shared", days: 3, role: "technician",
        checklist: ["Capacitación de ventas", "Capacitación de inventario", "Capacitación de contabilidad"],
        requests: [["Agendar sesiones de capacitación", "meeting", true, 2, "Fechas y participantes por área."]],
      },
      {
        name: "Pruebas", side: "shared", days: 5, role: "technician", approval: true,
        checklist: ["Pruebas de punta a punta con el cliente", "Corregir observaciones"],
        requests: [["Acta de aceptación de pruebas", "approval", true, 3, "Conformidad firmada para salir a producción."]],
      },
      {
        name: "Salida a producción", side: "internal", days: 1, role: "technician", evidence: true,
        checklist: ["Arranque en producción", "Acompañamiento del primer día"],
      },
    ];

    let previous = null;
    STAGES.forEach((st, i) => {
      const stage = insert("template_stages", {
        template: template.id,
        name: st.name,
        description: st.description || "",
        sort_order: i,
        duration_days: st.days,
        responsible_side: st.side,
        suggested_role: byCode.roles[st.role],
        weight: 1,
        client_visible: true,
        requires_evidence: !!st.evidence,
        requires_client_approval: !!st.approval,
      });
      (st.checklist || []).forEach((title, j) => insert("template_checklist_items", { stage: stage.id, title, sort_order: j }));
      (st.requests || []).forEach(([title, type, blocking, days, description], j) =>
        insert("template_client_requests", {
          stage: stage.id,
          title,
          description,
          request_type: type,
          blocking,
          due_in_days: days,
          sort_order: j,
        }),
      );
      if (previous) {
        insert("template_stage_dependencies", { stage: stage.id, depends_on: previous.id, dependency_type: "finish_to_start" });
      }
      previous = stage;
    });

    // --- Notificaciones --------------------------------------------------------
    const emailChannel = insert("notification_channels", { code: "email", name: "Correo", channel_type: "email", active: true });
    insert("notification_channels", { code: "erpsyschat", name: "Seraph Chat", channel_type: "erpsyschat", active: false });
    insert("notification_channels", { code: "webhook", name: "Webhooks", channel_type: "webhook", active: false });

    [
      ["work_item.created", ["assignee", "team", "managers"]],
      ["work_item.assigned", ["assignee"]],
      ["work_item.status_changed", ["requester", "client_contacts"]],
      ["comment.public_added", ["requester", "assignee", "participants"]],
      ["stage.completed", ["client_contacts", "managers"]],
      ["stage.unlocked", ["stage_owner", "client_contacts"]],
      ["stage.overdue", ["stage_owner", "managers"]],
      ["implementation.completed", ["client_contacts", "managers", "account_manager"]],
      ["client_request.created", ["client_contacts"]],
      ["client_request.reminder", ["client_contacts"]],
      ["client_request.overdue", ["client_contacts", "account_manager"]],
      ["client_request.submitted", ["stage_owner", "assignee"]],
      ["client_request.accepted", ["client_contacts"]],
      ["client_request.rejected", ["client_contacts"]],
      ["approval.requested", ["client_contacts"]],
      ["sla.breached", ["assignee", "managers"]],
    ].forEach(([event, recipients]) =>
      insert("notification_rules", { event_type: byCode.events[event], recipients, channels: [emailChannel.id], active: true }),
    );

    // --- Configuración inicial de la empresa ----------------------------------
    [
      ["general.company_name", "general", "Seraph Systems"],
      ["general.timezone", "general", "America/Guatemala"],
      ["language.default", "language", "es"],
      ["language.available", "language", ["es", "en", "pt"]],
      ["appearance.theme", "appearance", "blue"],
      ["appearance.color_mode", "appearance", "system"],
      ["appearance.brand_color", "appearance", "#00387a"],
      ["email.default_sender", "email", null],
      ["work_items.auto_close_days", "work_items", 7],
      ["work_items.client_can_reopen", "work_items", true],
      ["notifications.client_request_reminders", "notifications", { before_due_days: 1, on_due: true, every_days_after: 2 }],
      ["notifications.escalate_after_days", "notifications", 3],
      ["files.max_upload_mb", "files", 100],
      ["security.session_days", "security", 30],
    ].forEach(([key, group, value]) => insert("settings", { key, group, value, is_secret: false }));
  },
  (app) => {
    [...SEEDED].reverse().forEach((name) => app.db().newQuery(`DELETE FROM ${name}`).execute());
  },
);
