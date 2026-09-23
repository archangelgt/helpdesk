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

Detalle: [FEATURES.md](./FEATURES.md).

## Arranque local (preliminar)

Solo con Docker — **no** instalar PocketBase ni Go en el host.

```bash
cp .env.example .env   # opcional; ajusta contraseñas
docker compose up --build
```

| URL | Qué |
|-----|-----|
| http://localhost:3000 | **App Helpdesk** (categorías + tickets) |
| http://localhost:3000/categories | Crear categoría (ej. *desarrollo a medida*) |
| http://localhost:3000/tickets | Crear ticket eligiendo esa categoría |
| http://localhost:8090/_/ | PocketBase admin (email/password del `.env`) |

La app usa el puerto host **3000** (no 8080) para evitar conflictos en Linux/Fedora. Cámbialo con `API_PORT` en `.env` si hace falta.

Flujo preliminar: **Categorías → crear “desarrollo a medida” → Tickets → elegir esa categoría → crear ticket**.

API JSON: `GET/POST /api/categories`, `GET/POST /api/tickets` (`category_id` al crear).

Parar: `docker compose down` (el volumen `helpdesk_pb_data` **se conserva**).  
Borrar la base: `docker compose down -v` (destruye el volumen Docker).

**Base de datos:** solo dentro de Docker — volumen `helpdesk_pb_data` → `/pb_data`. Sin bind al host del proyecto.


## Documentos

| Doc | Contenido |
|-----|-----------|
| [ROADMAP.md](./ROADMAP.md) | Fases 0 → 6 |
| [MVP.md](./MVP.md) | Alcance MVP |
| [FEATURES.md](./FEATURES.md) | Capacidades |
| [BOUNDARIES.md](./BOUNDARIES.md) | Qué no mezclar |

## Stack (obligatorio)

| Pieza | Cómo |
|-------|------|
| **PocketBase** | Contenedor |
| **API Go + UI** | Contenedor |
| **Orquestación** | `docker compose` → erpsys en Fase 6 |

Skill: `.cursor/skills/docker-pocketbase-go/SKILL.md`.

## Estado

**Fase 1 (preliminar).** Compose con PocketBase + Go; categorías y tickets enlazados. Aún sin multitenancy completo, etapas de implementación ni API de canales.
