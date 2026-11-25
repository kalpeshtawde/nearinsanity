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

## Development

```bash
npm install
npm run dev        # http://localhost:5178
```

## Build

```bash
npm run build      # type-checks then builds to dist/
```

## Deployment

See `DEPLOYMENT.md`. The production Docker Compose serves the built app on
port `8084` (host) → `80` (container):

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```