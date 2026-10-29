# AgriSathi

Unified AI farming platform (Bangla-first) — hackathon build.

**Pitch:** Your AI agronomist, doctor and market agent, in Bangla, in your pocket.

## Quick start

```bash
# API
cd apps/api
uv venv .venv
uv pip install --python .venv -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Web (new terminal)
cd apps/web
npm install
npm run dev
```

Open http://127.0.0.1:5173 → **ডেমো: রহিম**

Seed API: `curl -X POST http://127.0.0.1:8000/api/seed/rahim`

## Stack

| Layer | Choice |
|-------|--------|
| Web | React + Vite PWA (Bangla UI) |
| API | FastAPI |
| DB | SQLite locally (same schema as `supabase/schema.sql`) |
| Disease | Heuristic + demo override (swap-in MobileNet/EfficientNet later) |
| Weather | Open-Meteo + seed fallback |
| Prices | DAM CSV seed |

## Features

1. **Crop Guardian** — leaf photo → disease + Bangla treatment → Events  
2. **Precision Farm** — irrigate / fertilizer card from stage + weather  
3. **Climate Smart** — rain/heat/flood alerts + variety hint  
4. **YieldMax** — yield range moves with diagnosis / treatment  
5. **FarmMarket** — nearby prices, wait/sell hint, listings  

## Docs

- [Ultimate plan](docs/ULTIMATE_PLAN.md)
- [Demo script](docs/DEMO_SCRIPT.md)
- [Agent router](AGENTS.md)
- Skills: `.cursor/skills/agrisathi-*/SKILL.md`
