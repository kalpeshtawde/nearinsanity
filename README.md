# Near Insanity — Digital Cartoons by Bob Johnson

Standalone storefront for Bob Johnson's digital cartoon business. A playful
editorial design on warm paper tones with bold serif typography, burnt-orange
accents, and a winged-toaster logo.

## Pages

- `/` — Homepage (featured cartoon, engraved-sample showcase, offers)
- `/gallery` — Shared cartoon gallery (keyboard-accessible lightbox)
- `/packs/10`, `/packs/20`, `/packs/30`, `/packs/50` — Pack offers
- `/membership` — Membership offer

All five offers cross-reference each other via a vertical tier rail and an
"Other offers" strip.

## Tech stack

**Frontend**
- React 18, TypeScript, Vite
- Scoped, route-isolated CSS (no global framework styles)
- Nginx (via Docker) for static hosting with SPA fallback

**Backend** (`backend/`)
- Django 4.2 + Django REST Framework
- PostgreSQL 15 (Docker `postgres:15` container in dev; physical instance on the server) — credentials live in `backend/.env`, different per environment
- Gallery images managed in the Django admin and served over the REST API — all IDs are UUIDs

## Running locally

### Prerequisites

- [Node.js](https://nodejs.org/) **18+** (Vite 5 requirement) and npm (bundled with Node)

### 1. Clone and install

```bash
git clone <your-repo-url> nearinsanity
cd nearinsanity
npm install
```

### 2. Set up environment (optional)

Copy the example env file — it's only used for future features (absolute
links/sitemaps and a reserved backend port), so the app runs fine without it:

```bash
cp .env.example .env
```

| Variable   | Default                   | Purpose                                  |
| ---------- | ------------------------- | ---------------------------------------- |
| `SITE_URL` | `https://nearinsanity.com`| Site URL for any absolute links/sitemaps |
| `PORT`     | `5000`                    | Unused by the frontend (backend has its own config, see below) |

### 3. Start the dev server

```bash
npm run dev
```

Vite serves the app with hot reload at **http://localhost:5178** (the port is
fixed in `vite.config.ts`).

## Build and preview

```bash
npm run build      # type-checks then builds to dist/
npm run preview    # serve the production build locally
```

`npm run preview` serves `dist/` with the same SPA fallback behavior as
production (also on port 5178 by default).

## Backend (Django admin + REST API)

The backend is fully containerized, both locally and in production: **web**
(React, port 8087) + **backend** (Django, port 8001) run from
`docker-compose.prod.yml`, and the **database** (postgres:15, port 5441) runs
from `backend/docker-compose.db.yml`. Credentials come from `backend/.env`
(gitignored, per-environment).

### 1. Start the stack

```bash
docker-compose -f backend/docker-compose.db.yml up -d          # postgres:15
cp backend/.env.example backend/.env                           # local values

# local dev (backend hot-reloads on source changes)
docker-compose -f docker-compose.prod.yml -f docker-compose.dev.yml up -d --build

# production-style (gunicorn instead of runserver)
docker-compose -f docker-compose.prod.yml up -d --build
```

Everything runs inside containers — no Python/venv needed on the host. Inside
a container, `localhost` is the container itself, so `DB_HOST` is set to
`host.docker.internal` by the compose files to reach the database on the host.

### 2. Migrate and create an admin user (inside the container)

```bash
docker-compose -f docker-compose.prod.yml exec backend python manage.py migrate
docker-compose -f docker-compose.prod.yml exec backend \
  sh -c "DJANGO_SUPERUSER_USERNAME=admin DJANGO_SUPERUSER_EMAIL=admin@example.com \
         DJANGO_SUPERUSER_PASSWORD='<pick-a-strong-password>' \
         python manage.py createsuperuser --noinput"
```

### 3. What's where

| Service | URL | Notes |
| --- | --- | --- |
| Frontend | http://127.0.0.1:8087 | static build; use Vite (`npm run dev`, port 5178) for frontend work |
| Backend API | http://127.0.0.1:8001/api/v1/ | admin + API |
| Django admin | http://127.0.0.1:8001/admin/ | log in with the superuser above |

Useful commands:

```bash
docker-compose -f docker-compose.prod.yml logs -f backend   # backend logs
docker-compose -f docker-compose.prod.yml exec backend python manage.py shell
docker-compose -f docker-compose.prod.yml exec backend python manage.py test
```

### Production database

Credentials are per-environment via `.env` files — local and prod differ.
On the server, copy `backend/.env.production.example` to `backend/.env` and
fill in the physical Postgres 15 connection (plus a real `DJANGO_SECRET_KEY`,
`DJANGO_DEBUG=0`, `DJANGO_ALLOWED_HOSTS`). The same variable names are read
either way; only the values change. See `DEPLOYMENT.md` for the server setup.

### Admin panel — upload gallery images

Log in at **http://127.0.0.1:8000/admin/** with the superuser you just
created. Under **Gallery images** you can upload cartoon artwork (jpg/png/
webp), set title/tag/description/alt text, and toggle `is_published` —
unpublished images are hidden from the public API. Each image gets a UUID.

### REST API (all IDs are UUIDs)

| Endpoint | Method | Access | Description |
| --- | --- | --- | --- |
| `/api/v1/gallery/` | GET | public | List published gallery images (paginated) |
| `/api/v1/gallery/<uuid>/` | GET | public | One published image |
| `/api/v1/admin/gallery/` | GET/POST | staff | List / upload images |
| `/api/v1/admin/gallery/<uuid>/` | GET/PUT/PATCH/DELETE | staff | Update / delete one image |
| `/api/v1/schema/` | GET | public | OpenAPI schema (JSON) |

Upload example:

```bash
curl -u admin:'<password>' -F "title=New Cartoon" -F "tag=Rock-and-roll chaos" \
  -F "image=@cartoon.png" http://127.0.0.1:8000/api/v1/admin/gallery/
```

> Note: `curl -u` uses HTTP Basic auth. DRF's default config uses session
> auth, which is what the admin panel and frontend use; Basic auth is
> enabled automatically by the browsable API when unauthenticated. For
> production, lock down write access behind your web server / VPN.

### Backend tests

```bash
cd backend
.venv/bin/python manage.py test
```

## Deployment

See `DEPLOYMENT.md`. The production Docker Compose serves the built app on
port `8087` (host) → `80` (container):

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```