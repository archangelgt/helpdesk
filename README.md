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
| http://localhost:3000/login | Entrar (maestro / cliente) — pide **seraph_id (NIT)**, correo y contraseña |
| http://localhost:3000/register | Registrar usuario cliente (seraph_id + correo + contraseña) |
| http://localhost:3000/board | Tablero (solo maestro) |
| http://localhost:3000/portal | Portal cliente (sus tickets) |
| http://localhost:3000/prefs | Idioma ES/EN/PT + tema claro/oscuro/auto |
| http://localhost:3000/tenants | Empresas: crear/editar y NIT (= seraph_id) |
| http://localhost:3000/tickets/new | Crear ticket |
| http://localhost:8090/_/ | PocketBase admin |

**Usuarios demo** (seraph_id = NIT de la empresa):

| Rol | Seraph ID (NIT) | Correo | Contraseña |
|-----|-----------------|--------|------------|
| Maestro | `900123456` (Cap World) o `900654321` (Power Tech) | `maestro@helpdesk.local` | `maestro123` |
| Cliente Cap World | `900123456` | `cliente.cap@helpdesk.local` | `cliente123` |
| Cliente Power Tech | `900654321` | `cliente.power@helpdesk.local` | `cliente123` |

El **seraph_id** es el **NIT** de la empresa. Los clientes solo entran con el NIT de su empresa; el maestro puede usar el NIT de cualquier empresa registrada.

**API de ingesta** (chat u otro sistema): ver [docs/API_INGEST.md](./docs/API_INGEST.md).

La app usa el puerto host **3000**. Preferencias: idioma y tema (claro / oscuro / automático por hora).

Flujo: login maestro → Empresas / plantillas / tablero. Login cliente → portal (estado, avance, comentarios).

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
| [docs/API_INGEST.md](./docs/API_INGEST.md) | Contrato API canales |

## Stack (obligatorio)

| Pieza | Cómo |
|-------|------|
| **PocketBase** | Contenedor |
| **API Go + UI** | Contenedor |
| **Orquestación** | `docker compose` → erpsys en Fase 6 |

Skill: `.cursor/skills/docker-pocketbase-go/SKILL.md`.

## Estado

**Fases 1–3 (en curso).** UI + login por roles (maestro/cliente), tenants Cap World / Power Tech, plantillas, portal cliente, i18n ES/EN/PT, tema claro/oscuro/auto, API de ingesta con API key.
