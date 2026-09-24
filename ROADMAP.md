# Roadmap

Fases de 0 a 6. Cada fase entrega algo usable antes de pasar a la siguiente.

```
0 docs → 1 fundación (Docker+PB+Go+tenants) → 2 MVP impl+soporte → 3 API canales → 4 email/WA/erpsys-chat → 5 hardening → 6 erpsys deploy
```

Catálogo: [FEATURES.md](./FEATURES.md).

---

## Fase 0 — Documentación

**Objetivo:** alinear visión (implementaciones + soporte + multitenancy + API canales).

- [x] Repo, README, ROADMAP, MVP, FEATURES, BOUNDARIES
- [x] Enfoque: etapas de implementación, compartir con cliente, tenants, ingesta Email / WhatsApp / ERPSYS Chat

**Salida:** docs en `main`. Siguiente: desarrollo (Fase 1).

---

## Fase 1 — Fundación técnica

**Objetivo:** esqueleto **solo Docker**, con modelo multitenancy.

- `docker compose`: PocketBase + API Go (+ UI stub)
- **Prohibido:** binarios PB/Go en el host
- Auth interna (equipo)
- Modelo: `Tenant`, `Ticket` (tipo implementación|soporte), `Stage`/`Etapa`, `Comment`, `User`
- Aislamiento por tenant en API
- CI básico (build de imágenes)

**Salida:** `docker compose up` con login y CRUD vacío multi-tenant.

---

## Fase 2 — MVP (implementación + soporte)

**Objetivo:** el equipo crea y sigue implementaciones con etapas; también tickets de soporte; Cap World / Power Tech como tenants piloto.

- [x] Ticket **implementación**: etapas, periodos, avance; notas internas; compartir vista/comentarios al cliente
- [x] Ticket **soporte**: estados, prioridad, asignación, comentarios
- [x] Filtros por tenant, tipo, estado
- [x] Semilla Cap World / Power Tech
- [x] Roles básicos: maestro (todas las empresas) / cliente (solo sus tickets en portal)
- [x] i18n ES/EN/PT; tema claro / oscuro / automático

Detalle: [MVP.md](./MVP.md).

**Salida:** implementaciones y soporte operables sin canales externos aún.

---

## Fase 3 — API de ingesta (contrato)

**Objetivo:** API estable para que un canal externo cree/actualice tickets.

- [x] Endpoints autenticados (API key por tenant)
- [x] Payload mínimo: tenant (vía key), canal, asunto/cuerpo, metadatos, idempotencia
- [x] Mapeo a ticket soporte
- [ ] Logs / errores visibles (mejorar)

**Salida:** un cliente HTTP de prueba puede abrir un ticket vía API. Ver [docs/API_INGEST.md](./docs/API_INGEST.md).

---

## Fase 4 — Canales: Email, WhatsApp, ERPSYS Chat

**Objetivo:** conectar los tres canales a la API de ingesta.

- **Email** → ticket / reply → hilo  
- **WhatsApp** → ticket / comentario  
- **ERPSYS Chat** → ticket (adaptador; sin mezclar código del monorepo CRM)  

Cada canal: config por tenant, reintentos, trazas.

**Salida:** un mensaje en cualquiera de los tres termina como ticket en el tenant correcto.

---

## Fase 5 — Hardening

- Roles (admin, supervisor, técnico, cliente)
- Auditoría, adjuntos, métricas, SLA soporte, alertas de etapa vencida
- Automatizaciones básicas
- Observabilidad, backups

---

## Fase 6 — Docker en erpsys

- Compose producción, secretos, proxy/TLS erpsys
- Deploy documentado + smoke test
- Verificación de adaptador ERPSYS Chat en el entorno real

---

## Fuera de alcance (por ahora)

- Sustituir Infile al 100% o migrar su data  
- Mezclar código/schemas con Cherub CRM / CRMSYS  
- Billing / IA avanzada / app nativa  
- Chat libre de equipo fuera del ticket  

---

## Orden de prioridad

1. Docs (0)  
2. Fundación Docker + tenants (1)  
3. MVP implementación + soporte (2)  
4. API de ingesta (3)  
5. Email + WhatsApp + ERPSYS Chat (4)  
6. Hardening + deploy erpsys (5–6)  
