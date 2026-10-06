# Helpdesk erpsys

Tickets de soporte, tareas internas e implementaciones por etapas, con portal para clientes.
Una instancia por empresa: web + API + worker de avisos + PocketBase, todo en Docker.

Instancia de Seraph Systems: https://support.erpsys.pro/ (base de datos: https://pb-support.erpsys.pro/_/).

Visión, arquitectura y avance por fases: [`ROADMAP_MVP.md`](ROADMAP_MVP.md).

## Estructura

| Carpeta | Qué hay |
|---|---|
| `apps/api` | API REST (Node.js 22 + TypeScript + Fastify) y worker de avisos (`src/worker.ts`) |
| `apps/web` | App web (React + Vite), servida por nginx, que hace de proxy a la API en `/api/` |
| `pocketbase` | Imagen de PocketBase, migraciones (`pb_migrations`) y hooks de integridad (`pb_hooks`) |
| `docker` | `docker-compose.yml` de una instancia y `.env.example` |
| `scripts` | Pruebas de integración contra contenedores desechables |

## Desplegar una instancia

```bash
cd docker
cp .env.example .env      # completar secretos; chmod 600 .env
docker compose up -d --build
```

Apache (u otro proxy con TLS) reenvía el dominio a `127.0.0.1:${WEB_PORT}` y, opcionalmente, el de la
consola de PocketBase a `127.0.0.1:${PB_PORT}`. Antes de aplicar migraciones nuevas, respaldar el volumen
`helpdesk_v2_pb_data`.

## Correo saliente

Los avisos salen por SMTP con las variables `SMTP_*` y `MAIL_FROM` de `docker/.env`. Sin `SMTP_PASSWORD`
se registran como "sin enviar" y no se mandan. El estado y un correo de prueba están en Configuración.

## Pruebas

```bash
./scripts/test-api.sh     # PocketBase + API + worker + SMTP falso desechables; no toca la instancia publicada
```
