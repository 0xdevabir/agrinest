README.md [200L]
# AgriSathi
Bangla-first farming PWA. One season loop on a shared **Farmer → Field → Event** record: diagnose the leaf, water and fertilize for the stage, watch weather risk, estimate yield, then decide whether to sell.
... [lean-ctx: omitted 1 lines]
Crop Guardian is the hero. The other four features read and write the same field events, so a diagnosis changes today’s advice, the yield range, and the sell-or-wait hint.
## Features
| Feature | What the farmer gets | Events |
... [lean-ctx: omitted 1 lines]
| **Crop Guardian** | Leaf photo → disease name and Bangla treatment steps | `diagnosis`, `treatment_logged` |
| **Precision Farm** | Irrigate / fertilizer card from crop stage and weather | `advice` |
... [lean-ctx: omitted 3 lines]
UI copy is Bangla by default (Hind Siliguri), with an English toggle. Chemical amounts are estimates from BRRI / DAE material. Confirm them with the local agriculture officer before spraying.
## Demo
Rahim farms 0.8 ha of BRRI dhan28 rice in Rangpur, sown 40 days ago.
... [lean-ctx: omitted 2 lines]
3. Or seed from the shell: `npm run seed`.
That calls `POST /api/seed/rahim` and is safe to repeat (`already_seeded` if Rahim already has a field). `POST /api/seed/reset` deletes listings, events, fields, and farmers.
Demo diagnosis can pin a class with the `force_disease` form field, or with a filename that names the disease. Pitch script: [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).
## Quick start
Requires Node.js 20+ and npm workspaces.
```bash
cp apps/api/.env.example apps/api/.env
npm install          # also runs prisma generate
npm run db:push
```
... [lean-ctx: omitted 7 lines]
## Services

| Process | Stack | Port | Role |
|---|---|---|---|
| `npm run dev:web` | Next.js | 5173 | Bangla PWA |
| `npm run dev:api` | NestJS | 8000 | Farmer, Field, Event, market, and the only API the app calls |
| `npm run dev:guardian` | FastAPI | 8011 | Leaf classify and Bangla step polish |
| `npm run dev:agronomy` | FastAPI | 8012 | Advice, climate, and yield |

First time for the Python services: `python3 -m venv apps/crop-guardian/.venv && apps/crop-guardian/.venv/bin/pip install -r apps/crop-guardian/requirements.txt` and the same for `apps/agronomy`. Nest calls those URLs (`GUARDIAN_URL`, `AGRONOMY_URL`). If a service is down, Nest uses its local copy and marks the response `nest-fallback`. FarmMarket stays in Nest.

## Scripts
| Script | What it does |
... [lean-ctx: omitted 1 lines]
| `npm run generate` | `prisma generate` for `@agrisathi/database` |
... [lean-ctx: omitted 2 lines]
| `npm run dev:web` | Next.js on port 5173 |
... [lean-ctx: omitted 1 lines]
| `npm run build:api` | Compile Nest to `apps/api/dist` |
| `npm run build:web` | Production Next build |
## Environment
Copy [apps/api/.env.example](apps/api/.env.example). The root [.env.example](.env.example) lists the same API keys plus the Next proxy.
... [lean-ctx: omitted 2 lines]
| `DATABASE_URL` | `file:./agrisathi.db` | SQLite URL. `file:` paths are relative to `libs/database/prisma/` |
... [lean-ctx: omitted 2 lines]
| `CORS_ORIGIN` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated browser origins |
... [lean-ctx: omitted 2 lines]
| `AGRISATHI_DISEASE_CONF_THRESHOLD` | `0.45` | Below this, diagnosis is re-labeled through the backup path |
| `API_PROXY_TARGET` | `http://127.0.0.1:8000` | Where Next rewrites `/api` |
| `NEXT_PUBLIC_API_URL` | empty | Optional absolute API base for the client |
... [lean-ctx: omitted 1 lines]
## Layout
```
web/                     Next.js App Router PWA
  src/app/(app)/         Home and the five feature routes
  src/features/          Screen components
  src/i18n/              Bangla messages and English overlay
apps/api/src/            NestJS — the process `dev:api` starts
  */*.controller.ts      HTTP modules
  engines/               Advice, climate, disease, market, weather, yield, workbench
  data is apps/api/data/ Calendars, treatments, varieties, BBS baselines, DAM CSV, weather seed
libs/database/           Prisma schema and generated client
libs/shared-types/       Farmer, Field, Event, and feature response types
supabase/schema.sql      Same Farmer / Field / Event shape, for a hosted Postgres later
docs/                    Hackathon plan and demo script
```
... [lean-ctx: omitted 7 lines]
## Data model
Prisma models in [libs/database/prisma/schema.prisma](libs/database/prisma/schema.prisma). JSON columns and HTTP bodies use snake_case (`farmer_id`, `area_ha`).
... [lean-ctx: omitted 4 lines]
Event types in `@agrisathi/shared-types`: `diagnosis`, `advice`, `weather_alert`, `treatment_logged`, `sale`.
`GET /api/fields/:fieldId/dashboard` joins the farmer, field, today’s advice, climate, yield range, market hint, latest diagnosis, and the last 20 events. `GET /api/fields/:fieldId/workbench` is the richer desk payload (stage, splits, outlook, prices) for the same field.
## HTTP API
Base URL `http://127.0.0.1:8000/api`. Types live in [libs/shared-types/src/index.ts](libs/shared-types/src/index.ts).
... [lean-ctx: omitted 2 lines]
| `GET` | `/health` | Liveness |
... [lean-ctx: omitted 1 lines]
| `POST` | `/seed/reset` | Wipe farmers, fields, events, listings |
... [lean-ctx: omitted 8 lines]
| `POST` | `/fields/:fieldId/diagnose` | Multipart leaf photo → diagnosis event |
| `POST` | `/fields/:fieldId/treatment-logged` | Record that treatment was done |
| `GET` | `/fields/:fieldId/advice/today` | Stage, irrigate, fertilizer |
... [lean-ctx: omitted 5 lines]
| `GET` | `/listings` | Listings |
| `GET` | `/fields/:fieldId/dashboard` | Home aggregate |
| `GET` | `/fields/:fieldId/workbench` | Desk aggregate |
Diagnosis accepts an image up to 8 MB. Optional form field `force_disease` must match a key in `apps/api/data/treatments_bn.json`.
## Web routes
| Path | Screen |
... [lean-ctx: omitted 3 lines]
| `/guardian`, `/guardian/history`, `/guardian/treatment` | Scan, past diagnoses, treatment |
| `/precision`, `/precision/irrigation`, `/precision/fertilizer`, `/precision/stage` | Advice card and stage detail |
... [lean-ctx: omitted 1 lines]
| `/yield`, `/yield/drivers`, `/yield/baseline` | Range, what moved it, baseline |
| `/market`, `/market/prices`, `/market/hint`, `/market/listings`, `/market/p/[id]` | Shop, prices, hint, listings, one listing |
... [lean-ctx: omitted 1 lines]
## How diagnosis works today
`classifyLeaf` resizes the photo and scores brown, yellow, green, and dark pixels, then maps that to a class in the Bangla treatment file (`healthy`, `brown_spot`, `bacterial_leaf_blight`, `rice_blast`, `sheath_blight`, or `unknown`).
... [lean-ctx: omitted 4 lines]
4. If confidence is under `AGRISATHI_DISEASE_CONF_THRESHOLD`, or the class is `unknown`, the same photo is scored again and tagged `backup_vision` (unknown becomes `rice_blast`)
A MobileNetV3 or EfficientNet-B0 model is the planned replacement for the color heuristic. It is not loaded in this build. Resized JPEGs are written to `uploads/leaf-photos` under the Nest working directory (`apps/api/uploads/leaf-photos` with `npm run dev:api`).
## Stack
| Layer | Choice |
... [lean-ctx: omitted 1 lines]
| Web | Next.js 15 App Router, React 19, installable PWA (`web/public/manifest.webmanifest`) |
... [lean-ctx: omitted 1 lines]
| DB | Prisma 6 + SQLite locally. Schema matches `supabase/schema.sql` |
| Shared types | `libs/shared-types`, imported by web and API |
| Weather | Open-Meteo, with `weather_seed.json` |
... [lean-ctx: omitted 2 lines]
## Docs
- [Ultimate plan](docs/ULTIMATE_PLAN.md) — gates, cut order, hour-by-hour build
... [lean-ctx: omitted 2 lines]
- Source PDF: [docs/AgriSathi Unified AI Farming Platform — Hackathon Plan.pdf](docs/AgriSathi%20Unified%20AI%20Farming%20Platform%20%E2%80%94%20Hackathon%20Plan.pdf)
Cut order if time runs out: FarmMarket buyer matching, then YieldMax history, then the climate risk map, then voice. Do not cut Crop Guardian or the shared farmer profile.

