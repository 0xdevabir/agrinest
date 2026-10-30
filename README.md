# AgriNest

A map-first farming platform for Bangladesh. Farmers see their own land on satellite imagery, agents add land and photos for farmers who don't use phones, and officers review a whole area from one map instead of visiting 15–20 plots a day. Bangla by default (Hind Siliguri), with an English toggle.

## Who does what

| Role | Home screen | Can do |
|------|-------------|--------|
| **Farmer** | Their land on the map | Mark land, record crops, send photos, follow guidance, sell |
| **Agent** | Today's visits | Add farmers and land, take photos on their behalf |
| **Officer** | Area map with filters | Open any land, review scans, send personal guidance |
| **National admin** | Nationwide totals | Monitor crops, sales, districts and officer performance (read-only, no individual farmer data) |
| **Government / broker** | Market | Post what they want to buy, bid, negotiate |

## Features

- **Crop Guard**: photos get an instant first look, and every scan stays in the officer's review queue. The first look is only a hint.
- **Climate Smart**: weather from Atlas for each land, with risk flags on the map.
- **Precision Farm**: what to do today, based on crop stage, weather and the land's history.
- **YieldMax**: expected yield and crop potential for each growth phase. It uses the land's past seasons as they build up.
- **Farm Market**: farmer listings, buy posts, bids, counter-offers and accepted deals.
- **Game layer**: XP and levels for scans and completed guidance. Crop markers show season progress as a ring and health as a colour.

Crop stages, yields and prices are approximate reference values, not measured data. Chemical advice cites BRRI/DAE and tells the farmer to confirm with their local officer.

## Run it

Requires Docker with Compose v2.

```bash
cp .env.example .env     # then fill it in; the file explains APP_KEY
docker compose up --build
```

Open http://localhost:5173. If 5173 or 8000 is already taken, set `WEB_PORT` or `API_PORT` in `.env`.

The first boot migrates the database and seeds demo data. `docker compose down` keeps the data; `docker compose down -v` deletes it. To reset the demo:

```bash
docker compose exec -T api php artisan migrate:fresh --seed --force
```

## Demo accounts

The password for all of them is `password`. The login page also has one-tap demo buttons. Set `SEED_DEMO=false` and remove those buttons before any real deployment.

| Role | Phone |
|------|-------|
| Farmer (Abir, 20 acres) | 01700000001 |
| Agent | 01700000002 |
| Officer | 01700000003 |
| Government buyer | 01700000004 |
| Farmer (Rahim) | 01700000005 |
| Broker | 01700000006 |
| National admin | 01700000007 |

Real government accounts are created on the server, never through sign-up:

```bash
php artisan agrinest:provision admin 01XXXXXXXXX "Full Name" --organization="Ministry of Agriculture"
php artisan agrinest:provision officer 01XXXXXXXXX "Full Name" --district=Rajshahi
```

## Environment

| Variable | Purpose |
|----------|---------|
| `APP_KEY` | Laravel encryption key (required) |
| `DB_PASSWORD` | Postgres password (required) |
| `ATLAS_API_KEY` | Map tiles, search and weather. Used only on the server |
| `NOVA_API_KEY` | AI scan feedback. Without a working key, scans use a colour check and are labelled as such |
| `SEED_DEMO` | Create demo accounts on first boot |
| `WEB_PORT`, `API_PORT` | Host ports (defaults 5173, 8000) |

## Layout

```
backend/                 Laravel 13 API (PHP 8.4, Sanctum, FrankenPHP)
  app/Services/          AtlasClient, NovaClient, CropGuard, Agronomy, WeatherSync, Game
  routes/api.php         All HTTP routes
  tests/Feature/         End-to-end API tests
web/                     Next.js 15 PWA with MapLibre
  src/app/(app)/         Map home, market, profile, farmers, reviews
  src/components/        FarmMap, MapStage, FieldSheet, role homes
docker-compose.yml       db (Postgres 17), api, scheduler, web
```

The browser never sees the Atlas key: map tiles load through `/api/map/tiles/...`, which requires sign-in.

`apps/`, `libs/`, `hono-try/`, `supabase/` and the root npm workspaces are the earlier prototype. Nothing in the Docker stack uses them. `docs/` also describes that prototype's plan.

## Tests

```bash
cd backend && php artisan test
```
