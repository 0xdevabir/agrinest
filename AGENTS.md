# AgriSathi — Agent Router

Use **one specialized agent per feature**. Do not mix scopes. Platform first; Crop Guardian is the hero gate.

Full plan: [`docs/ULTIMATE_PLAN.md`](docs/ULTIMATE_PLAN.md)  
Source PDF: [`docs/AgriSathi Unified AI Farming Platform — Hackathon Plan.pdf`](docs/AgriSathi%20Unified%20AI%20Farming%20Platform%20%E2%80%94%20Hackathon%20Plan.pdf)

## Invoke

In Cursor chat, attach or mention the skill under `.cursor/skills/<name>/SKILL.md`, e.g.:

> Follow `.cursor/skills/agrisathi-crop-guardian/SKILL.md` and implement Crop Guardian E2E.

| Order | Agent skill | Owns | Gate |
|------:|-------------|------|------|
| 0 | `agrisathi-platform` | Monorepo, Supabase schema, PWA shell, Bangla fonts, shared types/API contracts | Profile + home shell |
| 1 | `agrisathi-crop-guardian` | Disease model, diagnose API, camera UI, Rx KB, diagnosis Events | **GATE A — hour 24** |
| 2 | `agrisathi-precision-farm` | Stage calendar, Open-Meteo, irrigation/fertilizer rules, advice card | GATE B |
| 3 | `agrisathi-climate-smart` | Risk thresholds, variety hints, weather_alert Events | GATE B |
| 4 | `agrisathi-yieldmax` | Baseline × stress deltas, yield API, home range UI | GATE C |
| 5 | `agrisathi-farmmarket` | DAM prices, sell/wait hint, listings capped by yield | GATE C |
| 6 | `agrisathi-demo-pitch` | Rahim seed, Bangla copy, 4-min script, backup video checklist | Demo-ready |

## Hard rules (all agents)

1. One product: read/write shared `Farmer → Field → Event` model only.
2. Bangla-first UI; fonts Hind Siliguri or Noto Sans Bengali from hour one.
3. If Crop Guardian E2E is not green, pause other feature depth.
4. Cut order: FarmMarket buyer matching → YieldMax history → Climate risk map → voice. Never cut Crop Guardian or shared profile.
5. Live API down → cached/seeded data; say so in pitch.
6. Chemical advice: cite BRRI/DAE; tell farmer to confirm with local officer.
7. Stack: Next.js PWA (`web/`) · Laravel API (`backend/`) · Postgres · Docker Compose. `apps/`, `libs/` and `supabase/` are the unused earlier prototype; don't build on them.
8. Prefer working thin vertical slices over unfinished breadth.

## Parallelism

| Safe in parallel after GATE A | Must stay serial |
|------------------------------|------------------|
| Precision Farm UI + Climate Smart rules | Platform schema before all |
| YieldMax calc + FarmMarket CSV ingest | Diagnose Event before YieldMax demo |
| Demo seed/copy anytime after schema | Hero model path until backup LLM wired |
