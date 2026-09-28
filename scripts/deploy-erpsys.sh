#!/usr/bin/env bash
# Deploy Helpdesk → https://support.erpsys.pro
# Buenas prácticas: SOLO Docker + Apache (TLS/proxy) → 127.0.0.1:3000
#
# En el servidor (como root):
#   bash scripts/deploy-erpsys.sh
#
# Desde fuera (necesita clave SSH):
#   DEPLOY_SSH=root@104.131.13.89 DEPLOY_SSH_KEY=~/.ssh/id_ed25519 \
#     bash scripts/deploy-erpsys.sh --remote
#
set -euo pipefail

DOMAIN="${DOMAIN:-support.erpsys.pro}"
APP_DIR="${APP_DIR:-/opt/helpdesk}"
REPO_URL="${REPO_URL:-https://github.com/archangelgt/helpdesk.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"

log() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

remote_deploy() {
  local host="${DEPLOY_SSH:-}"
  [[ -n "$host" ]] || die "Falta DEPLOY_SSH=usuario@host (y opcional DEPLOY_SSH_KEY=ruta)"
  local ssh=(ssh -o StrictHostKeyChecking=accept-new)
  [[ -n "${DEPLOY_SSH_KEY:-}" ]] && ssh+=(-i "$DEPLOY_SSH_KEY")

  log "Conectando a $host"
  "${ssh[@]}" "$host" "sudo bash -s" <<EOF
set -euo pipefail
DOMAIN='${DOMAIN}'
APP_DIR='${APP_DIR}'
REPO_URL='${REPO_URL}'
REPO_BRANCH='${REPO_BRANCH}'
export DOMAIN APP_DIR REPO_URL REPO_BRANCH

if ! command -v git >/dev/null 2>&1; then
  if command -v yum >/dev/null 2>&1; then yum install -y git
  elif command -v dnf >/dev/null 2>&1; then dnf install -y git
  elif command -v apt-get >/dev/null 2>&1; then apt-get update && apt-get install -y git
  fi
fi

if [[ ! -d "\$APP_DIR/.git" ]]; then
  mkdir -p "\$(dirname "\$APP_DIR")"
  git clone --branch "\$REPO_BRANCH" "\$REPO_URL" "\$APP_DIR"
fi
cd "\$APP_DIR"
git fetch origin
git checkout "\$REPO_BRANCH"
git pull --ff-only origin "\$REPO_BRANCH" || git reset --hard "origin/\$REPO_BRANCH"
bash scripts/deploy-erpsys.sh
EOF
}

local_deploy() {
  [[ "$(id -u)" -eq 0 ]] || die "Ejecutar como root (sudo bash scripts/deploy-erpsys.sh)"

  command -v docker >/dev/null 2>&1 || die "Instale Docker Engine primero"
  docker compose version >/dev/null 2>&1 || die "Instale el plugin docker compose"
  systemctl is-active --quiet docker || systemctl start docker

  if [[ ! -d "$APP_DIR/.git" ]]; then
    log "Clonando $REPO_URL → $APP_DIR"
    mkdir -p "$(dirname "$APP_DIR")"
    git clone --branch "$REPO_BRANCH" "$REPO_URL" "$APP_DIR"
  else
    log "Actualizando $APP_DIR ($REPO_BRANCH)"
    git -C "$APP_DIR" fetch origin
    git -C "$APP_DIR" checkout "$REPO_BRANCH"
    git -C "$APP_DIR" pull --ff-only origin "$REPO_BRANCH" || \
      git -C "$APP_DIR" reset --hard "origin/$REPO_BRANCH"
  fi
  cd "$APP_DIR"

  if [[ ! -f .env ]]; then
    log "Generando .env de producción (secretos aleatorios)"
    cp .env.example .env
    SESSION_SECRET="$(openssl rand -hex 32)"
    PB_PASS="$(openssl rand -base64 32 | tr -d '/+=' | head -c 28)"
    sed -i \
      -e "s|^API_BIND=.*|API_BIND=127.0.0.1|" \
      -e "s|^PB_BIND=.*|PB_BIND=127.0.0.1|" \
      -e "s|^SESSION_SECRET=.*|SESSION_SECRET=${SESSION_SECRET}|" \
      -e "s|^PB_ADMIN_EMAIL=.*|PB_ADMIN_EMAIL=admin@${DOMAIN}|" \
      -e "s|^PB_ADMIN_PASSWORD=.*|PB_ADMIN_PASSWORD=${PB_PASS}|" \
      .env
    umask 077
    printf '%s\n' "$PB_PASS" > /root/helpdesk-pb-admin.password
    log "Password PB admin → /root/helpdesk-pb-admin.password"
  fi
  grep -q '^API_BIND=127.0.0.1' .env || echo 'API_BIND=127.0.0.1' >> .env
  grep -q '^PB_BIND=127.0.0.1' .env || echo 'PB_BIND=127.0.0.1' >> .env
  if grep -Eq 'change-me-to-a-long-random-string|helpdesk-dev-session-secret' .env; then
    sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=$(openssl rand -hex 32)|" .env
  fi
  chmod 600 .env

  log "docker compose up (prod)"
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --remove-orphans

  log "Esperando healthz en 127.0.0.1:3000"
  ok=0
  for _ in $(seq 1 60); do
    if curl -sf http://127.0.0.1:3000/healthz | grep -q ok; then ok=1; break; fi
    sleep 2
  done
  [[ "$ok" -eq 1 ]] || {
    docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100
    die "API no saludable"
  }

  # Apache family
  if [[ -d /etc/httpd ]]; then
    APACHE_FAMILY=httpd
    CONF_DST=/etc/httpd/conf.d/support.erpsys.pro.conf
    RELOAD=(systemctl reload httpd)
    TEST=(apachectl configtest)
  elif [[ -d /etc/apache2 ]]; then
    APACHE_FAMILY=apache2
    CONF_DST=/etc/apache2/sites-available/support.erpsys.pro.conf
    RELOAD=(systemctl reload apache2)
    TEST=(apache2ctl configtest)
    a2enmod proxy proxy_http ssl headers rewrite >/dev/null || true
  else
    die "Apache no encontrado (httpd/apache2)"
  fi
  log "Apache ($APACHE_FAMILY) → proxy a contenedor"

  mkdir -p /var/www/html/.well-known/acme-challenge
  CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"

  if [[ ! -f "$CERT" ]]; then
    log "Sin certificado TLS — vhost HTTP temporal + certbot"
    cat > "$CONF_DST" <<HTTPONLY
<VirtualHost *:80>
    ServerName ${DOMAIN}
    Alias /.well-known/acme-challenge/ /var/www/html/.well-known/acme-challenge/
    <Directory "/var/www/html/.well-known/acme-challenge/">
        Options None
        AllowOverride None
        Require all granted
    </Directory>
    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto "http"
    ProxyPass / http://127.0.0.1:3000/ retry=0 timeout=120
    ProxyPassReverse / http://127.0.0.1:3000/
</VirtualHost>
HTTPONLY
    [[ "$APACHE_FAMILY" == apache2 ]] && a2ensite support.erpsys.pro.conf >/dev/null || true
    "${TEST[@]}"
    "${RELOAD[@]}"

    if command -v certbot >/dev/null 2>&1; then
      certbot certonly --webroot -w /var/www/html -d "$DOMAIN" \
        --non-interactive --agree-tos -m "admin@${DOMAIN}" --keep-until-expiring \
        || log "certbot no pudo emitir; deje el HTTP proxy y añada el cert luego"
    else
      log "Instale certbot y re-ejecute este script para HTTPS"
    fi
  fi

  if [[ -f "$CERT" ]]; then
    cp "$APP_DIR/docker/apache/support.erpsys.pro.conf" "$CONF_DST"
    # CentOS ErrorLog path OK; Debian may prefer \${APACHE_LOG_DIR}
    if [[ "$APACHE_FAMILY" == apache2 ]]; then
      sed -i \
        -e 's|ErrorLog  logs/|ErrorLog ${APACHE_LOG_DIR}/|' \
        -e 's|CustomLog logs/|CustomLog ${APACHE_LOG_DIR}/|' \
        "$CONF_DST"
      a2ensite support.erpsys.pro.conf >/dev/null || true
    fi
    "${TEST[@]}"
    "${RELOAD[@]}"
    log "TLS activo"
  fi

  log "Comprobaciones"
  if command -v ss >/dev/null 2>&1; then
    if ss -lntp | grep -E '0\.0\.0\.0:(3000|8090)\b'; then
      die "Puertos 3000/8090 escuchan en 0.0.0.0 — deben ser solo 127.0.0.1"
    fi
  fi
  curl -sf http://127.0.0.1:3000/healthz
  echo
  curl -sS -o /dev/null -w "HTTP  %{http_code} %{url_effective}\n" --max-time 15 "http://${DOMAIN}/healthz" || true
  curl -sSk -o /dev/null -w "HTTPS %{http_code} %{url_effective}\n" --max-time 15 "https://${DOMAIN}/healthz" || true

  cat <<MSG

Deploy completado.
  App:     https://${DOMAIN}/login
  Health:  https://${DOMAIN}/healthz
  Datos:   volumen Docker helpdesk_pb_data
  PB admin (solo localhost): http://127.0.0.1:8090/_/
  Password PB (si se generó): /root/helpdesk-pb-admin.password

Cambie contraseñas demo (maestro123, etc.) tras el primer login.
MSG
}

if [[ "${1:-}" == "--remote" ]]; then
  remote_deploy
else
  local_deploy
fi
