# Helpdesk

Help desk **multitenancy** para el equipo interno: seguimiento de **implementaciones** (erpsys, ERPNext, desarrollos a medida) y **soporte**, con la misma cola de tickets. Los canales externos (Email, WhatsApp, ERPSYS Chat) crean o continúan tickets vía **API de ingesta**.

## Visión

Nosotros somos el usuario principal: abrimos y operamos los tickets. El cliente puede ver el progreso cuando lo compartimos (portal / comentarios visibles).

| Uso | Ejemplo | Qué lleva el ticket |
|-----|---------|---------------------|
| **Implementación** | Alta de cliente nuevo en erpsys; despliegue ERPNext; desarrollo a medida contratado | Etapas, periodos de tiempo, avance, notas internas + vista compartible al cliente |
| **Soporte** | Incidencia operativa del día a día | Prioridad, estado, asignación, historial (estilo cola Infile) |

**Multitenancy:** cada empresa (tenant) tiene sus datos aislados; el mismo producto atiende varias compañías sin mezclar tickets ni usuarios.

**Entrada unificada:** UI interna + API de ingesta (Email, WhatsApp, ERPSYS Chat → ticket).

| Pilar | Qué es |
|-------|--------|
| **Tickets** | Única entrada: implementación o soporte |
| **Etapas / avance** | En implementaciones: fases, fechas, % o estado por etapa |
| **Compartir con cliente** | Visibilidad controlada (no todo lo interno) |
| **Multitenancy** | Aislamiento por empresa |
| **API de canales** | Recibir tickets desde Email, WhatsApp, ERPSYS Chat |

Detalle: [FEATURES.md](./FEATURES.md).

## Documentos

| Doc | Contenido |
|-----|-----------|
| [ROADMAP.md](./ROADMAP.md) | Fases 0 → 6 |
| [MVP.md](./MVP.md) | Alcance MVP (implementación + soporte + tenants piloto) |
| [FEATURES.md](./FEATURES.md) | Capacidades y mapa a fases |
| [BOUNDARIES.md](./BOUNDARIES.md) | Qué no mezclar |

## Stack (obligatorio)

Siempre **Docker**. Nunca PocketBase ni la API Go como binario en el host.

| Pieza | Cómo |
|-------|------|
| **PocketBase** | Contenedor (datos; aislamiento por tenant según diseño) |
| **API Go** | Contenedor (lógica, API pública de ingesta, reglas) |
| **UI** | Contenedor (cuando exista) |
| **Orquestación** | `docker compose` local → **erpsys** en Fase 6 |

Skill: `.cursor/skills/docker-pocketbase-go/SKILL.md`.

## Estado

**Fase 0 — Documentación.** Visión de implementaciones + soporte multitenancy y API de canales. Sin código de producto aún; después de alinear docs, Fase 1 (desarrollo).
