# Roadmap

Fases de 0 a 6. Cada fase entrega algo usable antes de pasar a la siguiente.

```
0 docs → 1 fundación → 2 MVP tickets → 3 email→ticket → 4 chat → 5 hardening → 6 Docker en erpsys
```

---

## Fase 0 — Documentación

**Objetivo:** alinear visión, alcance y criterios antes de código.

- [x] Repo `archangelgt/helpdesk`
- [x] README (visión: tickets Infile + chat + email→ticket)
- [x] ROADMAP (fases 0→6)
- [x] MVP (alcance, etapas, aceptación, Cap World / Power Tech)

**Salida:** docs base en `main`.

---

## Fase 1 — Fundación técnica

**Objetivo:** esqueleto del proyecto listo para iterar.

- Estructura monorepo o app + API
- Auth mínima (usuarios internos / agentes)
- Modelo de datos de ticket (id, asunto, estado, prioridad, cliente, asignado, timestamps)
- Entorno local (compose o equivalente)
- CI básico (lint / build)

**Salida:** “hello world” desplegable en local con login y CRUD vacío de tickets.

---

## Fase 2 — MVP tickets (estilo Infile)

**Objetivo:** cola de tickets usable por agentes (Cap World / Power Tech como piloto).

- Crear / listar / filtrar / abrir ticket
- Estados: abierto → en progreso → resuelto / cerrado (ajustable)
- Prioridad y asignación a agente
- Comentarios internos / nota de resolución
- Vista cliente vs agente (permisos básicos)
- Datos semilla o onboarding para **Cap World** y **Power Tech**

Detalle de aceptación: [MVP.md](./MVP.md).

**Salida:** agentes gestionan tickets de punta a punta sin correo ni chat aún.

---

## Fase 3 — Email → ticket

**Objetivo:** el correo entrante alimenta la cola.

- Buzón / integración de correo configurada por tenant o cuenta
- Reglas: asunto/cuerpo → ticket nuevo (o reply → hilo del ticket)
- Adjuntar metadatos (from, message-id, referencias)
- Notificación al agente (in-app o email saliente mínimo)
- Manejo de fallos (cola / reintentos / log)

**Salida:** un correo de soporte se ve como ticket sin carga manual.

---

## Fase 4 — Chat día a día

**Objetivo:** conversación operativa ligada al contexto de soporte.

- Canales o hilos por ticket / por cliente
- Mensajes en tiempo real (o near real-time)
- Historial persistente
- Distinción mensaje de cliente vs nota interna
- Indicadores simples (no leído, último mensaje)

**Salida:** el equipo responde el día a día sin abandonar el helpdesk.

---

## Fase 5 — Hardening operativo

**Objetivo:** listo para uso serio en producción.

- Roles y permisos (admin, agente, solo lectura)
- Auditoría básica (quién cambió estado / asignación)
- Backups / retención de adjuntos
- Métricas mínimas (abiertos, SLA simple, por cliente)
- Observabilidad (logs, healthchecks)

**Salida:** checklist de producción cumplido.

---

## Fase 6 — Docker en erpsys

**Objetivo:** stack containerizado en la infraestructura erpsys.

- `Dockerfile`(s) + `docker-compose` de producción
- Variables de entorno / secretos
- Reverse proxy / TLS según estándar erpsys
- Deploy documentado (up / down / migrate)
- Smoke test post-deploy

**Salida:** helpdesk corriendo en erpsys vía Docker, documentado y reproducible.

---

## Fuera de alcance (por ahora)

- WhatsApp / otros canales (salvo decisión explícita)
- IA / auto-respuesta avanzada
- Billing / portal de facturación
- Sustitución completa de Infile (el MVP **imita el estilo**, no clona producto)

---

## Orden de prioridad

1. Docs (0)  
2. Tickets MVP (1–2)  
3. Email → ticket (3)  
4. Chat (4)  
5. Producción en erpsys (5–6)  
