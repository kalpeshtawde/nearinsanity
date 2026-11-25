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

- React 18, TypeScript, Vite
- Scoped, route-isolated CSS (no global framework styles)
- Nginx (via Docker) for static hosting with SPA fallback

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
| `PORT`     | `5000`                    | Reserved backend port (future use)       |

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

## Deployment

See `DEPLOYMENT.md`. The production Docker Compose serves the built app on
port `8084` (host) → `80` (container):

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```