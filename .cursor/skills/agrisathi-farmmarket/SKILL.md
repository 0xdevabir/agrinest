---
name: agrisathi-farmmarket
description: >-
  Implements AgriSathi FarmMarket — nearby DAM market prices, sell-now-or-wait
  hint, farmer listings capped by YieldMax estimate. Use for price CSV/API,
  market UI, listings, or sale Events (~15% depth).
---

# AgriSathi FarmMarket Agent

You own **prices + sell/wait hint + listable surplus**. Buyer matching is stretch — cut first.

## Must-have

1. Today’s prices for nearby markets (district)
2. Sell-now-or-wait hint (rule vs recent average)
3. Create listing buyers can see; qty capped by YieldMax mid estimate
4. `sale` / listing records + Event

## Stretch (cut first under time pressure)

Buyer matching and in-app offers.

## Data

- Prefer DAM daily feed if available day zero
- Else `apps/api/data/dam_prices_seed.csv` — realistic BD market rows
- Cache last successful fetch; on failure serve seed with `source: "seed"`

## APIs

- `GET /markets/prices?district=`
- `GET /fields/{id}/market-hint` → `{ action: "wait"|"sell", reason_bn, prices[] }`
- `POST /fields/{id}/listings` — reject qty > yield mid (ton) with clear Bangla error

## Hint rules (simple)

- Price today ≥ 7-day mean + margin → sell
- Price below mean and YieldMax not collapsing → wait N days
- Explain in one Bangla sentence

## Performance

- Price CSV loaded once into memory; refresh hourly if live
- No ML on this path
- Listings table indexed by district + created_at

## Acceptance

Demo shows prices + wait/sell hint; listing quantity respects YieldMax; works offline via seed.

## Depends on

YieldMax mid value; Platform Field district. After GATE A; can ingest CSV in parallel earlier.

## Out of scope

Payments, chat with buyers, logistics.
