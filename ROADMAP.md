# Roadmap

Fases de 0 a 6. Cada fase entrega algo usable antes de pasar a la siguiente.

```
0 docs → 1 fundación (Docker+PB+Go) → 2 MVP tickets → 3 email→ticket → 4 chat-on-ticket → 5 hardening → 6 erpsys
```

Catálogo de features: [FEATURES.md](./FEATURES.md).

---

## Fase 0 — Documentación

**Objetivo:** alinear visión, alcance y criterios antes de código.

- [x] Repo `archangelgt/helpdesk`
- [x] README (tickets como entrada + email + chat-on-ticket)
- [x] ROADMAP (fases 0→6)
- [x] MVP (alcance, etapas, aceptación, Cap World / Power Tech)
- [x] FEATURES (catálogo de capacidades)
- [x] BOUNDARIES (no mezclar CRM / fases / stack)

**Salida:** docs base en `main`.

---

## Fase 1 — Fundación técnica

**Objetivo:** esqueleto listo para iterar **solo con Docker**.

- `docker compose`: PocketBase + API Go (+ UI stub si aplica)
- **Prohibido:** PocketBase o Go como binario en el host
- Auth mínima (agentes / usuarios internos)
- Modelo de ticket (id, asunto, estado, prioridad, cliente, asignado, timestamps)
- CI básico (lint / build de imágenes)

**Salida:** “hello world” en local vía `docker compose up` con login y CRUD vacío de tickets.

---

## Fase 2 — MVP tickets (estilo Infile)

**Objetivo:** cola usable por agentes (Cap World / Power Tech).

- Crear / listar / filtrar / abrir ticket
- Estados: abierto → pendiente → en proceso → resuelto → cerrado
- Prioridad (baja / media / alta / crítica) y asignación
- Comentarios **internos** vs **respuesta al cliente** (básico)
- Búsqueda simple (número, cliente, estado, prioridad)
- Semilla Cap World / Power Tech

Detalle: [MVP.md](./MVP.md).

**Salida:** agentes gestionan tickets de punta a punta sin email ni chat aún.

---

## Fase 3 — Email → ticket

**Objetivo:** el correo alimenta la cola de tickets.

- Buzón / integración por cuenta
- Asunto/cuerpo → ticket nuevo; reply → hilo del ticket
- Metadatos (from, message-id, referencias)
- Notificación al agente
- Reintentos / log de fallos

**Salida:** un correo de soporte se ve como ticket sin carga manual.

---

## Fase 4 — Chat-on-ticket

**Objetivo:** conversación operativa **sobre el ticket** (no chat libre fuera de la cola).

- Hilo de mensajes por ticket
- Near real-time o equivalente
- Distinción mensaje cliente vs nota interna
- Indicadores simples (no leído, último mensaje)

**Fuera de esta fase:** WhatsApp, teléfono, chat de equipo desligado de tickets.

**Salida:** el equipo responde el caso sin abandonar el ticket.

---

## Fase 5 — Hardening operativo

**Objetivo:** uso serio en producción.

- Roles (admin, supervisor, técnico, cliente)
- Auditoría (quién cambió qué y cuándo)
- Adjuntos con autor/fecha
- Métricas mínimas + SLA simple y alertas
- Automatizaciones básicas (asignación / reopen / alertas)
- Observabilidad (logs, healthchecks)
- Backups / retención

**Salida:** checklist de producción cumplido.

---

## Fase 6 — Docker en erpsys

**Objetivo:** mismo stack containerizado en erpsys.

- Compose / Dockerfiles de producción
- Secretos y env
- Reverse proxy / TLS según erpsys
- Deploy documentado + smoke test

**Salida:** helpdesk en erpsys vía Docker, reproducible.

---

## Fuera de alcance (por ahora)

- WhatsApp / teléfono / app nativa (salvo decisión explícita)
- Base de conocimientos completa
- IA / auto-respuesta avanzada
- Billing / portal de facturación
- Sustitución completa de Infile (el MVP **imita el estilo**, no clona producto)
- Mezclar con Cherub CRM / CRMSYS ([BOUNDARIES.md](./BOUNDARIES.md))

---

## Orden de prioridad

1. Docs (0)  
2. Fundación Docker + PocketBase + Go (1)  
3. Tickets MVP (2)  
4. Email → ticket (3)  
5. Chat-on-ticket (4)  
6. Hardening + erpsys (5–6)  
