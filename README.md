# Helpdesk

Sistema de soporte interno: **tickets estilo Infile**, **chat día a día** y **email → ticket**.

## Visión

Unificar la atención a clientes y el trabajo del equipo técnico en un solo lugar:

| Pilar | Qué es | Para qué |
|-------|--------|----------|
| **Tickets** | Cola de incidencias al estilo Infile (prioridad, estado, asignación, historial) | No perder solicitudes ni contexto |
| **Chat** | Conversación operativa del día a día (equipo ↔ cliente / operadores) | Respuestas rápidas sin salir del flujo |
| **Email → ticket** | Correos entrantes se convierten en tickets | Capturar soporte que llega por correo |

Meta: que Cap World, Power Tech y el resto de cuentas operen soporte con trazabilidad, sin hojas sueltas ni hilos perdidos.

## Documentos

| Doc | Contenido |
|-----|-----------|
| [ROADMAP.md](./ROADMAP.md) | Fases 0 → 6 (docs → MVP → email → chat → Docker en erpsys) |
| [MVP.md](./MVP.md) | Alcance, etapas, criterios de aceptación, Cap World / Power Tech |

## Stack previsto (orientativo)

- App web (UI + API)
- Contenedores Docker desplegados en **erpsys**
- Integración correo (ingesta IMAP/SMTP o webhook según fase)
- Autenticación alineada al ecosistema existente cuando aplique

El detalle de implementación se define en las fases del roadmap; este repo arranca con la documentación del producto.

## Estado

**Fase 0 — Documentación.** Repo creado; visión, roadmap y MVP definidos. Sin código de producto aún.
