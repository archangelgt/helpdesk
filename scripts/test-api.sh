#!/usr/bin/env bash
# Levanta un PocketBase y una API desechables (red, volumen y contenedores temporales),
# corre scripts/test-api.py y borra todo al terminar. No toca la instancia publicada.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
V2="$(dirname "$HERE")"
ID="hd2test$$"
NET="$ID-net"
PB_PORT="${PB_TEST_PORT:-18199}"
API_PORT="${API_TEST_PORT:-13999}"
MAIL_PORT="${MAIL_TEST_PORT:-18925}"
PB_EMAIL="admin@test.local"
PB_PASSWORD="test-$(openssl rand -hex 8)"

cleanup() {
  docker rm -f "$ID-worker" "$ID-api" "$ID-pb" "$ID-mail" >/dev/null 2>&1 || true
  docker volume rm "$ID-data" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker build -q -t helpdesk-v2-pocketbase:test "$V2/pocketbase" >/dev/null
docker build -q -t helpdesk-v2-api:test "$V2/apps/api" >/dev/null
docker network create "$NET" >/dev/null

docker run -d --name "$ID-pb" --network "$NET" --network-alias pocketbase \
  -p "127.0.0.1:$PB_PORT:8090" -v "$ID-data:/pb_data" \
  -v "$V2/pocketbase/pb_migrations:/pb_migrations:ro" -v "$V2/pocketbase/pb_hooks:/pb_hooks:ro" \
  -e PB_ADMIN_EMAIL="$PB_EMAIL" -e PB_ADMIN_PASSWORD="$PB_PASSWORD" helpdesk-v2-pocketbase:test >/dev/null

for _ in $(seq 1 60); do curl -sf "http://127.0.0.1:$PB_PORT/api/health" >/dev/null && break; sleep 1; done

# Servidor SMTP falso (Mailpit): acepta cualquier usuario y expone los correos por HTTP.
docker run -d --name "$ID-mail" --network "$NET" --network-alias mailpit -p "127.0.0.1:$MAIL_PORT:8025" \
  -e MP_SMTP_AUTH_ACCEPT_ANY=1 -e MP_SMTP_AUTH_ALLOW_INSECURE=1 axllent/mailpit:v1.21 >/dev/null

JWT_KEY="$(docker run --rm --entrypoint node helpdesk-v2-api:test -e "const {generateKeyPairSync}=require('crypto');process.stdout.write(Buffer.from(generateKeyPairSync('ed25519').privateKey.export({type:'pkcs8',format:'pem'})).toString('base64'))")"
COMMON_ENV=(
  -e POCKETBASE_URL=http://pocketbase:8090 -e PB_ADMIN_EMAIL="$PB_EMAIL" -e PB_ADMIN_PASSWORD="$PB_PASSWORD"
  -e JWT_PRIVATE_KEY="$JWT_KEY" -e PUBLIC_URL=http://localhost -e LOG_LEVEL=warn
  -e SMTP_HOST=mailpit -e SMTP_PORT=1025 -e SMTP_SECURE=false -e SMTP_USER=test -e SMTP_PASSWORD=test
)

docker run -d --name "$ID-api" --network "$NET" -p "127.0.0.1:$API_PORT:3000" "${COMMON_ENV[@]}" \
  -e COOKIE_SECURE=false -e TRUST_PROXY_HOPS=0 -e LOGIN_RATE_LIMIT_PER_MINUTE=100 helpdesk-v2-api:test >/dev/null
docker run -d --name "$ID-worker" --network "$NET" "${COMMON_ENV[@]}" -e WORKER_POLL_MS=1000 \
  helpdesk-v2-api:test node dist/worker.js >/dev/null

for _ in $(seq 1 60); do curl -sf "http://127.0.0.1:$API_PORT/api/health" >/dev/null && break; sleep 1; done

status=0
API_URL="http://127.0.0.1:$API_PORT" MAIL_URL="http://127.0.0.1:$MAIL_PORT" PB_URL="http://127.0.0.1:$PB_PORT" PB_EMAIL="$PB_EMAIL" PB_PASSWORD="$PB_PASSWORD" \
  python3 "$HERE/test-api.py" || status=$?
if [ "$status" -ne 0 ]; then
  echo "--- logs de la API ---"
  docker logs "$ID-api" 2>&1 | tail -40
  echo "--- logs del worker ---"
  docker logs "$ID-worker" 2>&1 | tail -20
fi
exit "$status"
