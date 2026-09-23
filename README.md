# Helpdesk

Sistema de soporte: **tickets como única entrada**, con canales (email, portal, chat-on-ticket) que alimentan la misma cola. Estilo Infile en la gestión de incidencias.

## Visión

Centralizar, organizar y dar seguimiento a las solicitudes de soporte de clientes (piloto: Cap World, Power Tech) sin hojas sueltas ni hilos perdidos.

| Pilar | Qué es | Para qué |
|-------|--------|----------|
| **Tickets** | Entrada y cola de incidencias (prioridad, estado, asignación, historial, comentarios) | No perder solicitudes ni contexto |
| **Email → ticket** | Correos entrantes crean o continúan tickets | Capturar soporte que llega por correo |
| **Chat-on-ticket** | Conversación **ligada al ticket** (no chat libre aparte de la cola) | Responder sin salir del caso |

Catálogo completo de capacidades (SLA, métricas, KB, multicanal, etc.): [FEATURES.md](./FEATURES.md).

## Documentos

| Doc | Contenido |
|-----|-----------|
| [ROADMAP.md](./ROADMAP.md) | Fases 0 → 6 |
| [MVP.md](./MVP.md) | Alcance tickets, Cap World / Power Tech |
| [FEATURES.md](./FEATURES.md) | Características del producto y mapa a fases |
| [BOUNDARIES.md](./BOUNDARIES.md) | Qué no mezclar (CRM, fases, canales, stack) |

## Stack (obligatorio)

Siempre **Docker**. Nunca ejecutar PocketBase ni la API como binario suelto en el host.

| Pieza | Cómo |
|-------|------|
| **PocketBase** | Contenedor Docker (datos/persistencia) |
| **API Go** | Contenedor Docker (lógica / API) |
| **UI** | Contenedor Docker (cuando exista) |
| **Orquestación** | `docker compose` local y, en Fase 6, en **erpsys** |

Skill del agente: `.cursor/skills/docker-pocketbase-go/SKILL.md`.

## Estado

**Fase 0 — Documentación.** Visión, roadmap, MVP, features y boundaries en el repo. Sin código de producto aún.
