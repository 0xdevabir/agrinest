# AgriSathi

Unified AI farming platform (Bangla-first).

**Pitch:** Your AI agronomist, doctor and market agent, in Bangla, in your pocket.

## Layout

Same shape as a Falcon-style monorepo: one Next.js app, one NestJS core service, shared Prisma and types.

```
web/                  Next.js App Router (features, components, services)
apps/api/             NestJS — farmers, fields, diagnose, advice, climate, yield, market
libs/database/        Prisma schema (Farmer → Field → Event → Listing)
libs/shared-types/    API contracts used by web and API
```

Each Nest feature is a module with a controller, service, and DTOs. The web app keeps screens in `web/src/features` and talks to `/api`, which Next proxies to Nest.

## Quick start

```bash
npm install
npm run generate
npm run db:push
npm run dev:api    # http://127.0.0.1:8000/api/health
npm run dev:web    # http://127.0.0.1:5173
```

Open the web app and choose **ডেমো: রহিম**.

Seed API: `npm run seed`

Swagger: http://127.0.0.1:8000/docs

## Stack

| Layer | Choice |
|-------|--------|
| Web | Next.js App Router, Bangla UI, Hind Siliguri |
| API | NestJS |
| DB | Prisma + SQLite locally (same Farmer / Field / Event model as `supabase/schema.sql`) |
| Disease | Heuristic + demo override (swap-in MobileNet/EfficientNet later) |
| Weather | Open-Meteo + seed fallback |
| Prices | DAM CSV seed |

## Features

1. **Crop Guardian** — leaf photo → disease + Bangla treatment → Events
2. **Precision Farm** — irrigate / fertilizer card from stage + weather
3. **Climate Smart** — rain/heat/flood alerts + variety hint
4. **YieldMax** — yield range moves with diagnosis / treatment
5. **FarmMarket** — nearby prices, wait/sell hint, listings

Chemical amounts are estimates. Confirm with a local agriculture officer. Sources: BRRI / DAE.

## Docs

- [Ultimate plan](docs/ULTIMATE_PLAN.md)
- [Demo script](docs/DEMO_SCRIPT.md)
- [Agent router](AGENTS.md)
