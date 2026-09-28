# Deploy Helpdesk → https://support.erpsys.pro

Regla del producto: **solo Docker** (PocketBase + API Go en contenedores).  
En el host de erpsys: **Apache** hace TLS y hace proxy del subdominio al contenedor.  
No correr binarios de PocketBase ni de la API Go en el host.

```text
Internet → Apache (:443, support.erpsys.pro)
              ↓ ProxyPass
         127.0.0.1:3000  →  contenedor helpdesk-api (:8080)
                              ↕ network_mode shared
                         contenedor helpdesk-pocketbase (:8090, solo localhost)
```

---

## 1. DNS

En la zona `erpsys.pro`, crear:

| Tipo | Nombre | Valor |
|------|--------|--------|
| A (o CNAME) | `support` | IP del servidor Apache de erpsys |

Comprobar: `dig +short support.erpsys.pro`

---

## 2. Código en el servidor

En el host (ejemplo de ruta; ajústala a tu convención erpsys):

```bash
sudo mkdir -p /opt/helpdesk
sudo chown "$USER":"$USER" /opt/helpdesk
cd /opt/helpdesk
git clone https://github.com/archangelgt/helpdesk.git .
# o: git pull si ya existe
```

Requisitos en el host: **Docker** + **Docker Compose plugin**, Apache con `proxy`, `proxy_http`, `ssl`, `headers`, `rewrite`.

```bash
sudo a2enmod proxy proxy_http ssl headers rewrite
```

---

## 3. Variables de entorno (producción)

```bash
cp .env.example .env
chmod 600 .env
```

Edita `.env` con secretos fuertes (no uses los defaults de demo):

```env
API_PORT=3000
PB_PORT=8090
# Bind solo a localhost: Apache hace el proxy público
API_BIND=127.0.0.1
PB_BIND=127.0.0.1

SESSION_SECRET=<cadena-larga-aleatoria>
PB_ADMIN_EMAIL=admin@erpsys.pro
PB_ADMIN_PASSWORD=<password-fuerte>
```

Generar secretos:

```bash
openssl rand -hex 32   # SESSION_SECRET
openssl rand -base64 24
```

---

## 4. Compose de producción (puertos solo en localhost)

Usa el override de prod para que los puertos **no** queden abiertos a Internet:

```bash
cd /opt/helpdesk
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
curl -sS http://127.0.0.1:3000/healthz   # debe responder: ok
```

Datos de PocketBase: volumen Docker `helpdesk_pb_data` (nunca bind-mount de carpeta del proyecto).

Actualizar más tarde:

```bash
cd /opt/helpdesk
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

---

## 5. Apache: vhost → contenedor

Copia el vhost de ejemplo:

```bash
sudo cp /opt/helpdesk/docker/apache/support.erpsys.pro.conf \
  /etc/apache2/sites-available/support.erpsys.pro.conf
```

Ajusta las rutas de certificado SSL si en erpsys usáis Let’s Encrypt u otro path:

```apache
SSLCertificateFile      /etc/letsencrypt/live/support.erpsys.pro/fullchain.pem
SSLCertificateKeyFile   /etc/letsencrypt/live/support.erpsys.pro/privkey.pem
```

Si el certificado aún no existe (certbot):

```bash
# Primero deja el vhost HTTP o usa certbot standalone/webroot según vuestra práctica erpsys
sudo certbot certonly --webroot -w /var/www/html -d support.erpsys.pro
# o el flujo que ya uséis para otros *.erpsys.pro
```

Activa el sitio:

```bash
sudo a2ensite support.erpsys.pro.conf
sudo apache2ctl configtest
sudo systemctl reload apache2
```

Comprobar:

```bash
curl -sSI https://support.erpsys.pro/healthz
curl -sSI https://support.erpsys.pro/login
```

---

## 6. PocketBase admin (opcional, solo localhost)

El admin PB queda en `127.0.0.1:8090` (no debe publicarse en Apache por defecto).

Desde el servidor:

```bash
curl -sS http://127.0.0.1:8090/api/health
# Túnel SSH si necesitas la UI admin desde tu máquina:
# ssh -L 8090:127.0.0.1:8090 usuario@servidor-erpsys
# luego http://127.0.0.1:8090/_/
```

---

## 7. Checklist post-deploy

- [ ] `https://support.erpsys.pro/healthz` → `ok`
- [ ] Login maestro / cliente con NIT de empresa
- [ ] Cambiar contraseñas demo (`maestro123`, etc.) o desactivar usuarios demo
- [ ] Crear empresas reales en `/tenants` y usuarios en `/users`
- [ ] Confirmar que `3000`/`8090` **no** estánen en `0.0.0.0` (`ss -lntp | rg '3000|8090'`)
- [ ] Backup del volumen: `docker volume inspect helpdesk_pb_data`

---

## 8. Qué no hacer

| Evitar | Correcto |
|--------|----------|
| `./pocketbase serve` o `go run` en el host | `docker compose … up` |
| Exponer `:3000` / `:8090` a Internet | Solo `127.0.0.1` + Apache |
| Bind-mount de DB en carpeta del repo | Volumen `helpdesk_pb_data` |
| Mezclar PocketBase / tenants del CRM | Instancia helpdesk propia |

---

## Archivos en este repo

| Archivo | Uso |
|---------|-----|
| `docker-compose.yml` | Stack base |
| `docker-compose.prod.yml` | Bind a localhost |
| `docker/apache/support.erpsys.pro.conf` | Vhost Apache |
| `.env.example` | Variables |
