# MVP

Minimum Viable Product del helpdesk: **cola de tickets estilo Infile** usable por agentes, con clientes piloto **Cap World** y **Power Tech**.

Chat y email→ticket vienen en fases posteriores ([ROADMAP.md](./ROADMAP.md)); el MVP se centra en tickets.

---

## Alcance

### Incluye

- Login de agentes (y usuarios internos mínimos)
- CRUD / ciclo de vida de tickets
- Listado con filtros (estado, prioridad, cliente, asignado)
- Detalle con historial de comentarios
- Asignación a agente
- Estados y prioridades claros
- Separación por cliente (Cap World, Power Tech como mínimo)
- UI usable en desktop (móvil usable, no optimizada al máximo)

### No incluye (MVP)

- Ingesta de email
- Chat en tiempo real
- SLA automáticos / escalamiento complejo
- App móvil nativa
- Integraciones FEL / ERP profundas (más allá de identificar cliente)
- Multi-idioma

---

## Clientes piloto

| Cliente | Uso esperado en MVP |
|---------|---------------------|
| **Cap World** | Tickets de soporte creados y gestionados por agentes; filtros y asignación reales |
| **Power Tech** | Mismo flujo; validar multi-cliente (datos aislados por cuenta) |

Cada piloto debe poder:

1. Tener tickets propios visibles solo en su contexto (o filtrados por cliente).
2. Ser asignado a uno o más agentes.
3. Completar el ciclo abierto → resuelto sin pasos manuales fuera del sistema.

---

## Etapas del MVP

### E1 — Modelo y API

- Entidades: `Ticket`, `Comment`, `User`/`Agent`, `Client` (Cap World, Power Tech)
- Endpoints: listar, crear, actualizar estado/asignación, comentar
- Validaciones básicas

### E2 — UI agentes

- Inbox / cola
- Formulario de alta
- Detalle + comentarios
- Filtros y búsqueda simple

### E3 — Piloto Cap World / Power Tech

- Semilla o alta de ambos clientes
- Agentes de prueba
- Flujo guiado: crear ticket → asignar → comentar → resolver
- Ajustes de UX tras feedback corto

### E4 — Cierre MVP

- Criterios de aceptación verdes (abajo)
- Notas de limitaciones conocidas
- Decisión go/no-go hacia Fase 3 (email)

---

## Ciclo de vida del ticket (MVP)

```
nuevo / abierto → en_progreso → resuelto → cerrado
                    ↑_________|  (reabrir si hace falta)
```

Campos mínimos:

| Campo | Notas |
|-------|--------|
| `id` / número visible | Identificador humano |
| `asunto` | Obligatorio |
| `descripción` | Texto inicial |
| `cliente` | Cap World \| Power Tech \| … |
| `prioridad` | baja / media / alta (o equivalente Infile) |
| `estado` | ver ciclo |
| `asignado_a` | agente opcional al crear |
| `creado_en` / `actualizado_en` | timestamps |
| `comentarios[]` | autor, cuerpo, fecha |

---

## Criterios de aceptación

### Funcionales

- [ ] Un agente inicia sesión y ve la cola de tickets.
- [ ] Puede crear un ticket asociado a **Cap World**.
- [ ] Puede crear un ticket asociado a **Power Tech**.
- [ ] Puede filtrar la cola por cliente, estado y prioridad.
- [ ] Puede asignarse (o asignar a otro) un ticket.
- [ ] Puede cambiar estado hasta resuelto/cerrado.
- [ ] Puede agregar comentarios visibles en el historial.
- [ ] Un ticket de Cap World no se confunde con uno de Power Tech en listados/filtros.
- [ ] Tras refrescar / re-login, el estado y comentarios persisten.

### No funcionales (mínimos)

- [ ] Tiempo de carga de cola aceptable en uso interno (< ~3 s en condiciones normales).
- [ ] Errores de API visibles en UI (no silencio).
- [ ] Credenciales y secretos fuera del repo.
- [ ] Instrucciones de arranque local en README (cuando exista código).

### Definición de “MVP listo”

Todos los checks funcionales anteriores en verde con Cap World y Power Tech ejercitados en la misma instancia (o tenants equivalentes), más decisión documentada de pasar a **Fase 3 — Email → ticket**.

---

## Referencia de producto

**“Estilo Infile”** significa, para este MVP:

- Cola clara de incidencias
- Estados y prioridades visibles
- Asignación a responsable
- Historial / comentarios en el ticket

No implica paridad de features con Infile ni migración de datos desde Infile en esta etapa.

---

## Siguiente paso tras MVP

Ver [ROADMAP.md](./ROADMAP.md) — **Fase 3: Email → ticket**, luego chat (Fase 4) y Docker en erpsys (Fase 6).
