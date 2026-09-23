# MVP

MVP del helpdesk **multitenancy**: el equipo interno gestiona tickets de **implementación** (etapas, plazos, avance, compartibles al cliente) y de **soporte**, con tenants piloto **Cap World** y **Power Tech**.

La **API de ingesta** (Email / WhatsApp / ERPSYS Chat) empieza en Fase 3–4 ([ROADMAP.md](./ROADMAP.md)); el MVP opera desde la UI interna.

Visión: [FEATURES.md](./FEATURES.md).

---

## Alcance

### Incluye

- Stack: **Docker Compose** (PocketBase + API Go); sin binarios en host
- **Multitenancy** básico: al menos dos tenants aislados (Cap World, Power Tech)
- Login del equipo interno
- Tipos de ticket: `implementacion` | `soporte`

**Implementación**

- Crear ticket ligado a tenant / cliente / tipo de trabajo (erpsys | ERPNext | desarrollo a medida | otro)
- **Etapas** con nombre, orden, fecha planificada, fecha real (opcional), estado de etapa
- **Avance** global o por etapa (porcentaje o estados)
- Comentarios **internos** vs **visibles al cliente**
- Vista o listado que se pueda compartir / mostrar al cliente (solo lo no interno)

**Soporte**

- Cola: prioridad, estado, asignación, comentarios (interno / cliente)
- Filtros por tenant, tipo, estado, prioridad

**Común**

- Número único, asunto, descripción, historial básico
- UI desktop usable para el equipo

### No incluye (MVP)

- API de ingesta en producción (Email / WhatsApp / ERPSYS Chat)
- SLA automáticos
- Automatizaciones / escalamiento
- Adjuntos (salvo decisión mínima)
- Base de conocimientos
- Portal cliente rico (basta vista compartida básica)
- App móvil nativa
- Mezclar datos o schemas con CRM

---

## Tenants / clientes piloto

| Tenant | Uso en MVP |
|--------|------------|
| **Cap World** | Ticket de implementación (p. ej. erpsys o a medida) con etapas + un ticket de soporte |
| **Power Tech** | Igual en el otro tenant; validar aislamiento |

Cada tenant debe:

1. Ver solo sus tickets.  
2. Tener al menos una implementación con etapas y avance.  
3. Poder marcar comentarios visibles al cliente vs internos.  
4. Completar ciclo de un soporte abierto → resuelto.

---

## Etapas del MVP

### E1 — Modelo y API (Docker + tenants)

- Compose: PocketBase + Go  
- Entidades: `Tenant`, `Ticket`, `Stage`, `Comment`, `User`  
- Endpoints: CRUD tickets, etapas, comentarios; filtro por tenant  

### E2 — UI equipo

- Selector / contexto de tenant  
- Cola (implementación + soporte)  
- Alta de implementación con etapas  
- Detalle: avance, fechas, comentarios  
- Alta/gestión de soporte  

### E3 — Piloto Cap World / Power Tech

- Semilla de tenants y usuarios  
- Flujo implementación: crear → etapas → actualizar avance → comentario cliente  
- Flujo soporte: crear → asignar → resolver  

### E4 — Cierre MVP

- Criterios en verde  
- Limitaciones  
- Go/no-go hacia Fase 3 (API de ingesta)  

---

## Modelo mínimo

### Ticket

| Campo | Notas |
|-------|--------|
| `id` / número | Único |
| `tenant_id` | Obligatorio |
| `tipo` | `implementacion` \| `soporte` |
| `asunto` / `descripción` | Obligatorios |
| `trabajo` (impl.) | erpsys \| erpnext \| a_medida \| otro |
| `prioridad` / `estado` | Según tipo |
| `asignado_a` | Opcional |
| `avance` | % o derivado de etapas (impl.) |
| `comentarios[]` | `interno` \| `cliente` |
| timestamps | creado / actualizado |

### Etapa (solo implementación)

| Campo | Notas |
|-------|--------|
| `nombre` / `orden` | Obligatorios |
| `fecha_plan_inicio` / `fecha_plan_fin` | Periodo planificado |
| `fecha_real_inicio` / `fecha_real_fin` | Opcional |
| `estado_etapa` | pendiente \| en_curso \| hecha \| bloqueada |
| `avance_etapa` | Opcional |

Ciclo soporte (MVP):

```
abierto → pendiente → en_proceso → resuelto → cerrado
```

---

## Criterios de aceptación

- [ ] `docker compose` levanta PocketBase + Go (sin binario en host).
- [ ] Existen tenants Cap World y Power Tech aislados.
- [ ] El equipo crea un ticket de **implementación** con ≥ 3 etapas y fechas.
- [ ] Puede actualizar avance / estado de etapas y ver el progreso.
- [ ] Puede dejar comentario interno (no visible en vista cliente) y uno visible al cliente.
- [ ] Crea y resuelve un ticket de **soporte** en el mismo tenant.
- [ ] Un usuario de Cap World no ve tickets de Power Tech.
- [ ] Persistencia tras refresh / re-login.
- [ ] Secretos fuera del repo; README de arranque local.

**MVP listo:** checks en verde + decisión de pasar a **Fase 3 — API de ingesta**.

---

## Siguiente paso

Desarrollo Fase 1 → 2 según [ROADMAP.md](./ROADMAP.md). Luego API y canales Email / WhatsApp / ERPSYS Chat.
