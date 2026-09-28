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
| http://localhost:3000/login | Entrar — pide **seraph_id (NIT)**, correo y contraseña |
| http://localhost:3000/register | Registrar usuario cliente (seraph_id + correo + contraseña) |
| http://localhost:3000/board | Tablero (maestro / agente) |
| http://localhost:3000/portal | Portal cliente (sus tickets y avance) |
| http://localhost:3000/users | Usuarios, roles y permisos (admin) |
| http://localhost:3000/templates | Plantillas + roles permitidos (admin) |
| http://localhost:3000/prefs | Idioma ES/EN/PT + tema claro/oscuro/auto |
| http://localhost:3000/tenants | Empresas: crear/editar y NIT (= seraph_id) |
| http://localhost:3000/tickets/new | Crear ticket (si tiene permiso `crear`) |
| http://localhost:8090/_/ | PocketBase admin |

**Roles y permisos**

| Rol | Workspace | Notas |
|-----|-----------|-------|
| `maestro` | Tablero | Todos los permisos; único que crea **implementación** |
| `agente` | Tablero | Permisos configurables (crear / editar / resolver) |
| `cliente` | Portal | Solo blank/soporte; ve avance de sus tickets |

Permisos: `crear`, `editar`, `resolver`, `admin`. En cada plantilla se define qué roles pueden usarla.

**Usuarios demo** (seraph_id = NIT de la empresa):

| Rol | Permisos | Seraph ID (NIT) | Correo | Contraseña |
|-----|----------|-----------------|--------|------------|
| Maestro | todos | `900123456` o `900654321` | `maestro@helpdesk.local` | `maestro123` |
| Agente | crear+editar+resolver | `900123456` | `agente@helpdesk.local` | `agente123` |
| Agente limitado | crear+editar (no resolver) | `900123456` | `agente.limite@helpdesk.local` | `agente123` |
| Cliente | crear | `900123456` | `cliente.cap@helpdesk.local` | `cliente123` |
| Cliente lectura | ninguno | `900123456` | `cliente.lectura@helpdesk.local` | `cliente123` |
| Cliente Power | crear | `900654321` | `cliente.power@helpdesk.local` | `cliente123` |

El **seraph_id** es el **NIT** de la empresa. Clientes/agentes con empresa solo entran con el NIT de su tenant; el maestro puede usar cualquier NIT registrado.

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
