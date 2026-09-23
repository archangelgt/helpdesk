# Límites (no mezclar)

Reglas de separación para no volver a cruzar productos ni fases.

## Producto vs otros labs

| Esto (helpdesk) | No es |
|-----------------|--------|
| Repo `archangelgt/helpdesk` | Cherub CRM / CRMSYS |
| Tickets + (luego) email + chat | Portal CRM, PocketBase de tenants crmsys |
| Pilotos Cap World / Power Tech como **clientes del helpdesk** | Tenants de CRM (siforest, seraph, …) |
| Deploy futuro en erpsys (Fase 6) | Deploy ritual de `crm` |

Carpeta hermana `../crm` en el disco **no** es dependencia ni plantilla de este proyecto.

## Pilares del helpdesk (orden)

1. **Tickets** (MVP) — primero y solo esto hasta cerrar Fase 2  
2. **Email → ticket** — Fase 3  
3. **Chat** — Fase 4  

No implementar 2 o 3 “de paso” mientras el MVP de tickets esté abierto.

## Clientes piloto

- **Cap World** y **Power Tech** son cuentas distintas en el mismo producto.
- Un ticket de uno no debe verse/confundirse como del otro.
- No reutilizar IDs ni configs de otros sistemas Cherub sin decisión explícita.

## Referencia Infile

- **Sí:** cola, estados, prioridad, asignación, historial.
- **No:** paridad de features ni migración de datos Infile en esta etapa.

## Docs canónicos

| Doc | Rol |
|-----|-----|
| [README.md](./README.md) | Visión |
| [ROADMAP.md](./ROADMAP.md) | Fases 0→6 |
| [MVP.md](./MVP.md) | Alcance tickets |
| Este archivo | Qué no mezclar |
