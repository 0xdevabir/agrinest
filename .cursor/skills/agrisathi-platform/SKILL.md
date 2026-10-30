---
name: agrisathi-platform
description: >-
  Builds AgriSathi shared foundation — monorepo, Supabase Farmer/Field/Event
  schema, FastAPI skeleton, React+Vite PWA shell, Bangla fonts, home dashboard
  slots, shared OpenAPI types. Use when bootstrapping the repo, shared profile,
  auth, or cross-cutting infrastructure before feature work.
---

# AgriSathi Platform Agent

You own the **shared core** only. Do not implement disease ML, market UI, or yield math — leave those to feature agents.

## Stack (fixed)

- `web/` — Next.js App Router PWA (Falcon-style `src/features`, `src/components`, `src/services`)
- `apps/api` — NestJS feature modules (controller / service / dto), same shape as Falcon `apps/core-service`
- `libs/database` — Prisma schema for Farmer → Field → Event
- `libs/shared-types` — API contracts shared with the web app
- Supabase — Postgres + Auth + Storage when hosted; SQLite locally
- Bangla fonts: Hind Siliguri or Noto Sans Bengali (load hour 0)

## Must ship

1. Schema: `farmers`, `fields`, `events` (+ storage bucket `leaf-photos`)
2. CRUD: create farmer profile (Bangla labels) + one field
3. Event append API: `{ type, payload, field_id }`
4. Home dashboard shell with **five named slots** (Guardian, Precision, Climate, YieldMax, FarmMarket)
5. Shared TS/Python types matching OpenAPI
6. Env samples: Supabase, LLM key, model path — no secrets committed
7. Design tokens: CSS variables; avoid generic purple/AI-slop look; agrarian, readable outdoor UI

## Data model

```
Farmer { id, name, district, lang: "bn" }
Field { farmer_id, crop, variety, sowing_date, lat, lon, area_ha }
Event { field_id, type: diagnosis|advice|weather_alert|treatment_logged|sale, payload jsonb, created_at }
```

## Performance rules

- Image uploads: client resize ≤512px before Storage
- API: pagination defaults; indexes on `events(field_id, created_at)`
- PWA: cache shell; lazy-load feature routes
- Single DB round-trip for home aggregate endpoint preferred: `GET /fields/{id}/dashboard`

## Done when

- [ ] Rahim profile creatable in Bangla
- [ ] Field saved; empty Events list returns `[]`
- [ ] Home shows five linked slots (stubs OK)
- [ ] Feature agents can depend on stable paths under `apps/`

## Out of scope

Feature business logic, model training, DAM scraping, Open-Meteo rules.

## Reference

Read `docs/ULTIMATE_PLAN.md` §1–2 and `AGENTS.md` hard rules before coding.
