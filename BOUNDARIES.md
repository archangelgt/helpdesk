# Límites (no mezclar)

Reglas para no cruzar productos, tenants ajenos ni stacks.

## Producto vs otros labs

| Esto (helpdesk) | No es |
|-----------------|--------|
| Repo `archangelgt/helpdesk` | Cherub CRM / CRMSYS |
| Tenants del helpdesk (empresas aisladas) | Tenants PocketBase de crmsys (siforest, seraph, …) |
| Ticket implementación (erpsys / ERPNext / a medida) | Proyecto o issue tracker del CRM |
| API / adaptador **ERPSYS Chat** → ticket | Meter código de erpsys/crm dentro de este repo |
| Deploy del helpdesk en erpsys (Fase 6) | Ritual de deploy `crm` |
| PocketBase **de este** helpdesk (volumen Docker) | Reutilizar `pb_data` o schemas del CRM |

`../crm` y otros labs **no** son dependencia ni plantilla.

## Qué sí es este producto

1. **Multitenancy** helpdesk (varias empresas, datos aislados).  
2. Tickets de **implementación** con etapas, periodos y avance (equipo primero; compartible al cliente).  
3. Tickets de **soporte**.  
4. **API de ingesta** hacia Email, WhatsApp, ERPSYS Chat (fases 3–4).  

## Orden de construcción

1. Fundación Docker + tenants + tickets (impl + soporte)  
2. API de ingesta  
3. Canales Email / WhatsApp / ERPSYS Chat  
4. Hardening + deploy erpsys  

No implementar canales “de paso” mientras el MVP de UI interna no cierre.

## Stack (duro)

- Siempre Docker Compose: PocketBase + Go (+ UI).  
- Nunca binario PB/Go en el host.  
- Skill: `.cursor/skills/docker-pocketbase-go/SKILL.md`.

## Pilotos

- Cap World ≠ Power Tech (tenants distintos).  
- No reutilizar IDs/creds de CRM u otros sistemas sin decisión explícita.

## Docs canónicos

| Doc | Rol |
|-----|-----|
| [README.md](./README.md) | Visión + stack |
| [ROADMAP.md](./ROADMAP.md) | Fases 0→6 |
| [MVP.md](./MVP.md) | Alcance MVP |
| [FEATURES.md](./FEATURES.md) | Capacidades |
| Este archivo | Qué no mezclar |
