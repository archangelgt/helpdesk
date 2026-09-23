#!/bin/sh
set -eu

EMAIL="${PB_ADMIN_EMAIL:-admin@helpdesk.local}"
PASS="${PB_ADMIN_PASSWORD:-helpdesk-admin-change-me}"

# Upsert superuser inside the container (never run pocketbase on the host).
/usr/local/bin/pocketbase superuser upsert "$EMAIL" "$PASS" --dir=/pb_data >/dev/null 2>&1 || true

exec /usr/local/bin/pocketbase serve --http=0.0.0.0:8090 --dir=/pb_data
