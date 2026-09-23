---
name: docker-pocketbase-go
description: >-
  Always run Helpdesk with Docker Compose: PocketBase and Go API as containers
  only — never host binaries. Use when starting the stack, adding services,
  writing Dockerfiles/compose, debugging PocketBase or the Go API, local or
  erpsys deploy, or any backend/infra change in this repo.
---

# Docker + PocketBase + Go (no binary)

## Non-negotiable

1. **Every** runtime dependency of the backend runs in **Docker** (via `docker compose`).
2. **Never** download, install, or execute PocketBase as a host binary (`pocketbase`, `./pocketbase`, `go run` as the long-lived API in production/dev default).
3. **Never** tell the user to “install PocketBase” or “run the Go binary” on the machine. The entrypoint is always Compose.
4. PocketBase in this repo is **helpdesk’s own** instance — do not point at CRMSYS / Cherub CRM PocketBase tenants.

## Canonical shape

```text
docker-compose.yml (or compose.yaml)
  ├── pocketbase   # official/image or Dockerfile — data volume mounted
  ├── api          # Go service built FROM golang / multi-stage → distroless/alpine
  └── web          # UI container when it exists
```

Local and erpsys (Fase 6) use the **same model**: containers, env files, volumes. Differences are only env, secrets, and reverse proxy.

## Do

- Add/change services in Compose; rebuild with `docker compose build` / `up --build`.
- Persist PocketBase data in a named volume or bind mount under the project (never commit `pb_data` with secrets).
- Configure the Go API to talk to PocketBase by **Compose service DNS** (e.g. `http://pocketbase:8090`), not `localhost` from inside another container unless intentional.
- Keep secrets in `.env` (gitignored) or the host secret store — never in images or docs.
- Healthchecks on `pocketbase` and `api` before declaring the stack up.
- Prefer multi-stage Dockerfiles for Go (`CGO_ENABLED=0`) producing a minimal runtime image.

## Don’t

| Bad | Good |
|-----|------|
| `curl …/pocketbase.zip && ./pocketbase serve` | `docker compose up pocketbase` |
| `go run ./cmd/api` as the default app process | `docker compose up api` |
| Sharing CRM `pb_data` or crmsys URLs | Own compose service + own data volume |
| Documenting “install Go + PB on the laptop” as setup | Document `docker compose up` only |

Exceptions (narrow): one-shot `docker compose exec api go test` / `migrate` **inside** the container is fine. Host `go test` only if the user explicitly asks and CI already mirrors it — still must not replace Compose as the app runtime.

## When adding features

- New backend capability → code in the Go service **and** ensure Compose still boots clean.
- New collection/schema → apply via PocketBase migrations/API in-container, documented for compose workflows.
- Never introduce a second datastore “just because” without an explicit product decision.

## Quick checklist before finishing a task

- [ ] `docker compose` (or documented compose file) defines PocketBase + Go
- [ ] README / docs do not instruct host binary runs
- [ ] No CRM PocketBase URL or tenant mixed in
- [ ] `.env.example` lists required vars without secrets
