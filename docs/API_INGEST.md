# API de ingesta

Contrato para que otros sistemas (chat, email, WhatsApp, etc.) creen y continúen tickets.

Autenticación: `X-API-Key: <clave>` o `Authorization: Bearer <clave>`.

Claves demo (cambiar en producción):

| Tenant | Clave |
|--------|-------|
| Cap World | `hd_cap_demo_key_change_me` |
| Power Tech | `hd_power_demo_key_change_me` |

## Crear ticket

`POST /api/v1/ingest/tickets`

```json
{
  "subject": "No abre factura",
  "description": "Detalle…",
  "type": "soporte",
  "priority": "alta",
  "requester_email": "cliente.cap@helpdesk.local",
  "requester_name": "Ana",
  "channel": "chat",
  "external_id": "chat-msg-1001",
  "category": "ERPSYS"
}
```

- `external_id` es idempotente por tenant: repetir la misma clave no duplica el ticket.
- `channel`: `chat` | `email` | `whatsapp` | (vacío → `api`)
- Si no hay `category_id` / `category`, usa la primera categoría existente.

## Obtener ticket

`GET /api/v1/ingest/tickets/{id}`

## Comentar

`POST /api/v1/ingest/tickets/{id}/comments`

```json
{ "body": "Mensaje del canal", "author": "chat-bot" }
```

Los comentarios de ingesta quedan con visibilidad `cliente`.

## Roles UI

| Rol | Acceso |
|-----|--------|
| **maestro** | Tablero, crear/editar, plantillas, empresas |
| **cliente** | Solo `/portal`: ver sus tickets, avance/etapas, comentar |

Demo: `maestro@helpdesk.local` / `maestro123` · `cliente.cap@helpdesk.local` / `cliente123`
