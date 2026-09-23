# MVP

Minimum Viable Product: **cola de tickets** usable por agentes, con clientes piloto **Cap World** y **Power Tech**.

Email→ticket y chat-on-ticket vienen después ([ROADMAP.md](./ROADMAP.md)). El MVP es solo la **entrada y gestión de tickets**.

Visión de producto completa: [FEATURES.md](./FEATURES.md).

---

## Alcance

### Incluye

- Stack local: **Docker Compose** (PocketBase + API Go); sin binarios sueltos
- Login de agentes (usuarios internos mínimos)
- CRUD / ciclo de vida de tickets
- Número único, asunto, descripción
- Prioridad: baja / media / alta / crítica
- Estados: abierto → pendiente → en proceso → resuelto → cerrado
- Asignación a agente
- Comentarios con distinción básica **interno** vs **visible al cliente**
- Listado con filtros (estado, prioridad, cliente, asignado)
- Búsqueda simple (número, cliente, palabras en asunto)
- Separación por cliente (Cap World, Power Tech)
- UI usable en desktop

### No incluye (MVP)

- Ingesta de email
- Chat (ni siquiera chat-on-ticket)
- SLA / alertas de vencimiento
- Automatizaciones / escalamiento
- Adjuntos de archivos
- Base de conocimientos
- Panel de métricas avanzado
- Producto contratado / jerarquía empresa completa
- WhatsApp / multicanal extra
- App móvil nativa
- Integraciones FEL / ERP profundas (más allá de identificar cliente)

---

## Clientes piloto

| Cliente | Uso esperado en MVP |
|---------|---------------------|
| **Cap World** | Tickets creados y gestionados por agentes; filtros y asignación reales |
| **Power Tech** | Mismo flujo; validar multi-cliente |

Cada piloto debe poder:

1. Tener tickets propios visibles en su contexto (o filtrados por cliente).
2. Ser atendido por uno o más agentes.
3. Completar el ciclo abierto → resuelto sin pasos fuera del sistema.

---

## Etapas del MVP

### E1 — Modelo y API (Docker)

- Compose: PocketBase + servicio Go
- Entidades: `Ticket`, `Comment`, `User`/`Agent`, `Client`
- Endpoints: listar, crear, actualizar estado/asignación, comentar
- Validaciones básicas

### E2 — UI agentes

- Inbox / cola
- Formulario de alta
- Detalle + comentarios (interno / cliente)
- Filtros y búsqueda simple

### E3 — Piloto Cap World / Power Tech

- Semilla de ambos clientes + agentes de prueba
- Flujo: crear → asignar → comentar → resolver
- Ajustes cortos de UX

### E4 — Cierre MVP

- Criterios de aceptación en verde
- Limitaciones conocidas
- Go/no-go hacia Fase 3 (email)

---

## Ciclo de vida del ticket (MVP)

```
abierto → pendiente → en_proceso → resuelto → cerrado
              ↑_________________|  (reabrir si hace falta)
```

Campos mínimos:

| Campo | Notas |
|-------|--------|
| `id` / número visible | Identificador humano único |
| `asunto` | Obligatorio |
| `descripción` | Texto inicial |
| `cliente` | Cap World \| Power Tech \| … |
| `prioridad` | baja / media / alta / crítica |
| `estado` | ver ciclo |
| `asignado_a` | agente opcional al crear |
| `creado_en` / `actualizado_en` | timestamps |
| `comentarios[]` | autor, cuerpo, fecha, `interno` \| `cliente` |

---

## Criterios de aceptación

### Funcionales

- [ ] Stack arranca con `docker compose` (PocketBase + Go); sin binario PB/Go en host.
- [ ] Un agente inicia sesión y ve la cola de tickets.
- [ ] Puede crear un ticket asociado a **Cap World**.
- [ ] Puede crear un ticket asociado a **Power Tech**.
- [ ] Puede filtrar por cliente, estado y prioridad.
- [ ] Puede asignarse (o asignar a otro) un ticket.
- [ ] Puede cambiar estado hasta resuelto/cerrado.
- [ ] Puede agregar comentario interno y comentario visible al cliente.
- [ ] Un ticket de Cap World no se confunde con uno de Power Tech.
- [ ] Tras refrescar / re-login, estado y comentarios persisten.

### No funcionales (mínimos)

- [ ] Carga de cola aceptable en uso interno (< ~3 s).
- [ ] Errores de API visibles en UI.
- [ ] Secretos fuera del repo.
- [ ] Instrucciones de arranque local en README.

### Definición de “MVP listo”

Checks funcionales en verde con Cap World y Power Tech, más decisión documentada de pasar a **Fase 3 — Email → ticket**.

---

## Referencia de producto

**“Estilo Infile”** en el MVP:

- Cola clara de incidencias  
- Estados y prioridades visibles  
- Asignación a responsable  
- Historial / comentarios en el ticket  

No implica paridad con Infile ni migración de datos.

---

## Siguiente paso tras MVP

[ROADMAP.md](./ROADMAP.md) — Fase 3 email→ticket, luego Fase 4 chat-on-ticket, hardening y erpsys.
