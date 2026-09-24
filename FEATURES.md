# Características del Help Desk

Producto **multitenancy**: el equipo interno gestiona tickets de **implementación** y de **soporte** por empresa (tenant). Toda entrada es un ticket; Email, WhatsApp y ERPSYS Chat llegan por **API de ingesta**.

## Enfoque de producto

### 1. Seguimiento de implementaciones (uso principal interno)

Cuando un cliente contrata, por ejemplo:

- Alta / implementación **erpsys**
- Implementación **ERPNext**
- **Desarrollo a medida**

Creamos un ticket de implementación y le agregamos:

- **Etapas** (p. ej. discovery → diseño → desarrollo → UAT → go-live)
- **Periodos de tiempo** (fechas planificadas / reales por etapa)
- **Avance** (cómo va cada etapa y el conjunto)

El equipo ve todo (notas internas, retrasos, riesgos). Al cliente se le puede **compartir** una vista filtrada (avance, etapas, mensajes visibles).

### 2. Tickets de soporte

Misma plataforma, otro tipo (o categoría) de ticket: incidencias, prioridad, asignación, resolución — estilo cola de help desk.

### 3. Multitenancy

Varias empresas en el mismo software, datos aislados:

`Tenant (empresa) → Clientes/proyectos → Tickets (implementación | soporte) → Etapas / historial`

Pilotos iniciales de referencia: Cap World, Power Tech (como tenants o cuentas dentro del modelo; ver MVP).

### 4. API de ingesta (canales)

Endpoints autenticados para crear / actualizar tickets desde:

| Canal | Rol |
|-------|-----|
| **Email** | Correo → ticket (o reply → hilo) |
| **WhatsApp** | Mensaje → ticket / comentario |
| **ERPSYS Chat** | Mensaje desde chat erpsys → ticket |

La UI interna sigue siendo el lugar donde el equipo opera etapas y avance.

Comentarios:

- **Interno** — solo el equipo  
- **Visible al cliente** — lo compartido / enviado al cliente  

---

## Capacidades generales

### Gestión de tickets

- Tipos: `implementacion` | `soporte` (nombres ajustables)
- Número único, asunto, descripción
- Prioridad, estado, asignación, categorías
- Historial de cambios; adjuntos
- En implementación: **etapas**, fechas, avance

### Clientes / tenants

- Tenant = empresa que opera (o a la que se da servicio) en aislamiento
- Contactos, historial, productos/servicios (erpsys, ERPNext, a medida)
- Cadena: `Tenant → Cliente/proyecto → Producto → Tickets → Etapas / soporte`

### Panel y métricas

- Abiertos / pendientes / resueltos; por técnico, tenant, tipo
- Avance de implementaciones; vencidos / SLA (soporte)

### SLA

Matrices por prioridad (soporte); alertas cercanas a incumplimiento. Post-MVP.

### Comunicación

Portal, email, WhatsApp, ERPSYS Chat → tickets; notificaciones; plantillas; interno vs cliente.

### Automatización

Reglas, asignación, reopen, alertas de etapa vencida, etc. Post-MVP.

### Base de conocimientos / búsqueda / roles / adjuntos / auditoría

Como en un help desk estándar; ver fases en [ROADMAP.md](./ROADMAP.md).

Roles típicos: admin tenant, supervisor, técnico, **cliente (solo lo compartido)**.

---

## Mapa rápido fase ↔ feature

| Feature | MVP | Luego |
|---------|-----|--------|
| Multitenancy básico (2+ empresas aisladas) | Sí | Hardening |
| Ticket implementación + etapas + fechas + avance | Sí | — |
| Plantillas de ticket (etapas/tiempos, clonar por cliente) | Sí | Más variables |
| Compartir avance al cliente (vista / comentarios) | Sí (básico) | Portal cliente rico |
| Ticket soporte (cola, prioridad, asignación) | Sí | SLA completo |
| API ingesta (contrato + al menos un canal) | Sí (API key + chat/genérico) | Email, WhatsApp adapters |
| Portal cliente (ver avance + comentar) | Sí (básico) | Portal rico |
| i18n ES / EN / PT + tema claro/oscuro/auto | Sí | Más cadenas |
| Email / WhatsApp / ERPSYS Chat en producción | No | Fases de canales |
| SLA / automations / KB avanzados | No | Hardening+ |

Detalle: [ROADMAP.md](./ROADMAP.md), [MVP.md](./MVP.md).
