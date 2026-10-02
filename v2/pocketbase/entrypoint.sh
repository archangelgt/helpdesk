#!/bin/sh
set -eu

PB="/usr/local/bin/pocketbase"
DIRS="--dir=/pb_data --migrationsDir=/pb_migrations --hooksDir=/pb_hooks"

$PB superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" $DIRS >/dev/null

exec $PB serve --http=0.0.0.0:8090 $DIRS
