# Deployment Guide for Near Insanity

## Prerequisites

- Domain: nearinsanity.com pointed to your VPS IP
- Docker and Docker Compose installed on server
- Nginx installed and configured (this site is one of several on a shared
  `apps.conf`, alongside ishasystems.com, mail, citygpt, ...)
- Certbot installed for SSL certificates
- PostgreSQL 15 installed and running on the server (physical instance —
  the DB is **not** containerized in production)

## Stack

Three containers locally, two on the server:

| Service | Container | Host port | Server |
| --- | --- | --- | --- |
| Frontend (React, nginx) | `nearinsanity-web` | 8087 | same |
| Backend (Django + gunicorn) | `nearinsanity-backend` | 8001 | same |
| Database (postgres:15) | `nearinsanity-db` | 5441 | **physical Postgres 15** (no container) |

The backend reaches the DB through `host.docker.internal` (set in
`docker-compose.prod.yml`), so inside the container `localhost` is never
mistaken for the host.

## First-time server setup

### 1. Database

Create the role and database on the physical Postgres:

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE nearinsanity WITH LOGIN PASSWORD '<strong-password>';
CREATE DATABASE nearinsanity OWNER nearinsanity;
SQL
```

### 2. Backend environment

```bash
cd /root/src/nearinsanity
cp backend/.env.production.example backend/.env
# edit backend/.env — set:
#   DJANGO_SECRET_KEY (long random), DJANGO_DEBUG=0
#   DJANGO_ALLOWED_HOSTS=nearinsanity.com,www.nearinsanity.com
#   FRONTEND_ORIGIN=https://nearinsanity.com
#   FRONTEND_URL=https://nearinsanity.com
#   DB_* values above (DB_PORT=5432)
#   Stripe: STRIPE_PRICE_10/20/30/50/MEMBERSHIP, STRIPE_SECRET_KEY,
#           STRIPE_WEBHOOK_SECRET (see the Stripe section below)
```

### 2b. Stripe (live mode)

The price IDs used in local dev are **test-mode** objects. For production you
must create the same products in **live mode** (Dashboard with test mode off)
and copy the live `price_...` IDs:

| Plan | Price |
| --- | --- |
| 10-Cartoon Starter Pack | $110 one-time |
| 20-Cartoon Growth Pack | $420 one-time |
| 30-Cartoon Pro Pack | $930 one-time |
| 50-Cartoon Agency Pack | $2,550 one-time |
| All-Access Membership | $25/month recurring |

Then:

1. Add the **live secret key** (`sk_live_...`, or preferably a restricted key
   `rk_live_...` scoped to Checkout + Webhooks) as `STRIPE_SECRET_KEY`.
2. In the Stripe Dashboard → Developers → Webhooks → **Add endpoint**:
   - URL: `https://nearinsanity.com/api/v1/stripe/webhook/`
   - Events: `checkout.session.completed`,
     `checkout.session.async_payment_succeeded`
3. Copy the endpoint's signing secret (`whsec_...`) into
   `STRIPE_WEBHOOK_SECRET`.
4. Recreate the backend so it picks up the new `backend/.env` (a plain
   `restart` does **not** re-read `env_file`), then confirm:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d backend
   curl -s https://nearinsanity.com/api/v1/config/   # {"stripe_enabled":true}
   ```

> Tip: to smoke-test the flow before going live, temporarily keep the test
> keys and price IDs on the server, complete a purchase with card
> `4242 4242 4242 4242`, then swap in the live values.

### 3. Build, migrate, create admin

```bash
docker-compose -f docker-compose.prod.yml up -d --build

docker-compose -f docker-compose.prod.yml exec backend python manage.py migrate
docker-compose -f docker-compose.prod.yml exec backend \
  sh -c "DJANGO_SUPERUSER_USERNAME=admin DJANGO_SUPERUSER_EMAIL=admin@nearinsanity.com \
         DJANGO_SUPERUSER_PASSWORD='<admin-password>' \
         python manage.py createsuperuser --noinput"

# sanity checks
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8087/   # frontend
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8001/api/v1/gallery/
```

## Deployment Methods

### Method 1: Automated Deployment (Recommended)

Uses GitHub Actions to automatically deploy when you push to the `main` branch.

**Setup:**
1. Configure GitHub Secrets (see mavicc's `.github/SETUP_SECRETS.md` pattern):
   - `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`
2. Push to `main` — the workflow builds, then SSHes to the server and runs:
   ```bash
   cd /root/src/nearinsanity
   git pull origin main
   docker-compose -f docker-compose.prod.yml down
   docker-compose -f docker-compose.prod.yml up -d --build
   docker-compose -f docker-compose.prod.yml exec backend python manage.py migrate
   ```

### Method 2: Manual Deployment

Run `./deploy.sh` on the server (pulls `main` and rebuilds the containers),
or run the compose commands directly.

> `backend/.env` lives on the server and is gitignored — `git pull` will not
> overwrite it. Uploaded media and collected static persist in `backend/media`
> and `backend/staticfiles` (bind-mounted), so uploads survive rebuilds.

## Initial Setup Steps

### 1. Update Nginx Configuration

Add the following to `/etc/nginx/conf.d/apps.conf` on your server. Start with
the HTTP-only block below; Certbot then adds HTTPS and the redirect
(see step 2). Routing — **everything is proxied to the containers**; nginx
never reads host filesystem paths (uploads/static are served by Django
itself through gunicorn):

- `/admin/`, `/api/`, `/static/`, `/media/` → Django (gunicorn on 8001)
- everything else → React frontend (8087)

```nginx
# Near Insanity - HTTP (initial - Certbot will add HTTPS)
server {
    server_name nearinsanity.com www.nearinsanity.com;

    # ACME challenge for Let's Encrypt
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    client_max_body_size 100M;

    # Django admin
    location /admin/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Django REST API
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Admin static assets + uploaded cartoons — served by Django itself
    # (WhiteNoise / media view), proxied here.
    location /static/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        expires 30d;
    }

    location /media/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        expires 30d;
    }

    # React SPA (everything else)
    location / {
        proxy_pass http://127.0.0.1:8087;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Get SSL

```bash
sudo certbot --nginx -d nearinsanity.com -d www.nearinsanity.com
```

Certbot rewrites the block above with the HTTPS server + HTTP→HTTPS redirect
(same as it did for citygpt), then reloads nginx.

### 3. Verify

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -I https://nearinsanity.com
curl -I https://nearinsanity.com/admin/login/
curl -I https://nearinsanity.com/api/v1/gallery/
```