# Límites (no mezclar)

Reglas de separación para no volver a cruzar productos, fases ni stacks.

## Producto vs otros labs

| Esto (helpdesk) | No es |
|-----------------|--------|
| Repo `archangelgt/helpdesk` | Cherub CRM / CRMSYS |
| Tickets como **única entrada** + email/chat-on-ticket | Portal CRM, PocketBase de tenants crmsys |
| Pilotos Cap World / Power Tech como **clientes del helpdesk** | Tenants de CRM (siforest, seraph, …) |
| Deploy futuro en erpsys (Fase 6) | Deploy ritual de `crm` |
| PocketBase **de este** helpdesk en Docker | Reutilizar o compartir PB/schemas del CRM |

Carpeta hermana `../crm` **no** es dependencia ni plantilla.

## Pilares (orden)

1. **Tickets** (MVP) — la entrada; todo lo demás alimenta tickets  
2. **Email → ticket** — Fase 3  
3. **Chat-on-ticket** — Fase 4 (hilo del ticket; no chat libre de equipo)  

No implementar 2 o 3 “de paso” mientras el MVP de tickets esté abierto.  
WhatsApp / teléfono / API pública: fuera hasta decisión explícita.

## Stack (duro)

- **Siempre** Docker Compose: PocketBase + Go (+ UI).  
- **Nunca** PocketBase ni API Go como binario en el host.  
- Skill: `.cursor/skills/docker-pocketbase-go/SKILL.md`.

## Clientes piloto

- Cap World ≠ Power Tech.  
- No reutilizar IDs ni configs de otros sistemas Cherub sin decisión explícita.

## Referencia Infile

- **Sí:** cola, estados, prioridad, asignación, historial.  
- **No:** paridad de features ni migración Infile en esta etapa.

## Docs canónicos

| Doc | Rol |
|-----|-----|
| [README.md](./README.md) | Visión + stack |
| [ROADMAP.md](./ROADMAP.md) | Fases 0→6 |
| [MVP.md](./MVP.md) | Alcance tickets |
| [FEATURES.md](./FEATURES.md) | Catálogo de capacidades |
| Este archivo | Qué no mezclar |
