# AgriSathi — Ultimate Hackathon Execution Plan

**Source:** `docs/AgriSathi Unified AI Farming Platform — Hackathon Plan.pdf`  
**Pitch:** Your AI agronomist, doctor and market agent, in Bangla, in your pocket.  
**Rule:** One connected core loop that works. Hero depth on Crop Guardian; other four real but narrow, linked via shared profile.

---

## 0. Product north star

| Principle | Meaning |
|-----------|---------|
| One product | Five stages of one season, not five demos |
| Shared profile | Farmer → Field → Events feeds every feature |
| Bangla-first | UI copy, advice, disease names, TTS stretch |
| Hero gate | Crop Guardian E2E by hour 24 or pause everything else |
| Honest fallbacks | Seeded data OK if pipeline is real and you say so |

**Persona:** Rahim — rice farmer, Rangpur, 0.8 ha, basic Android, patchy data, limited English.

**Cut order (never cut first two):** Crop Guardian flow → shared profile → FarmMarket buyer listing → YieldMax history → Climate Smart risk map → voice.

---

## 1. Architecture (single stack)

```
PWA (React + Vite)  →  FastAPI  →  Supabase (Postgres + Auth + Storage)
                         ├─ Disease model (MobileNetV3 / EfficientNet-B0)
                         ├─ Rules engine (irrigation / fertilizer / weather)
                         ├─ LLM advice (Bangla instructions)
                         └─ Yield regression / rules
```

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | React + Vite PWA | Android install, weak data, one codebase |
| Backend | FastAPI | Same language as ML; fast REST |
| DB | Supabase | Profiles, fields, photos, listings |
| Disease | Fine-tuned MobileNetV3 or EfficientNet-B0 | Small; TFLite path later |
| Advice | LLM API + farmer/weather/diagnosis ctx | Short Bangla steps |
| Rules | Plain Python | Judge-explainable |
| Yield | Regression / rule range | Honest limited data |
| Host | Railway/Render API + Vercel PWA | Free tiers |

### Shared data model

```
Farmer { id, name, district, phone?, lang: "bn" }
  └─ Field { crop, variety, sowing_date, location, area_ha }
       └─ Event { type, payload, created_at }
            types: diagnosis | advice | weather_alert | treatment_logged | sale
```

**Writers:** Crop Guardian, Precision Farm, Climate Smart  
**Readers:** YieldMax, FarmMarket (+ home dashboard reads all)

### Cross-cutting must-haves

1. Bangla UI (Hind Siliguri / Noto Sans Bengali from hour 0)
2. One farmer profile: crop, district, field size, sowing date
3. Home dashboard showing all five as one season loop
4. Safety footer on chemical advice: confirm with local agriculture officer; sources BRRI/DAE

---

## 2. 48-hour timeline (6 phases, 3 gates)

| Phase | Hours | Focus | Gate |
|-------|-------|-------|------|
| P0 | 0–2 | Repo, stack, fonts, env, day-zero API checks, seed CSVs | Env boots |
| P1 | 2–8 | Schema + auth stub + Farmer/Field CRUD + home shell | Shared profile works |
| P2 | 8–24 | **Crop Guardian E2E** (upload → model → Bangla Rx → Event) | **GATE A: hero flow** |
| P3 | 24–32 | Precision Farm + Climate Smart cards on home | GATE B: advice + alert |
| P4 | 32–40 | YieldMax + FarmMarket wired to Events | GATE C: impact + sale |
| P5 | 40–48 | Bangla polish, demo script, backup video, printed leaves | Demo-ready |

**If GATE A fails at h24:** stop all other feature work until Crop Guardian passes.

---

## 3. Feature ultimate plans

### F1 — Crop Guardian (Hero · ~40%)

**Job:** Photo of leaf → disease name + confidence + Bangla treatment steps → save Event on Field.

| | Must-have | Stretch |
|---|-----------|---------|
| Demo | Photo → name, confidence, Bangla steps | Outbreak map; Bangla TTS |
| Data | PlantVillage + Kaggle rice leaf sets; DAE/BRRI Rx KB | Live multi-farmer map |

**Execution plan**

1. **Classes:** 4–6 common rice diseases (blast, BLB, brown spot, sheath blight, BPH damage proxy if needed). Cap scope for accuracy.
2. **Model:** Fine-tune EfficientNet-B0 or MobileNetV3; export ONNX/TorchServe or FastAPI `/predict`.
3. **Backup classifier:** Vision LLM if confidence < threshold or model fails (demo resilience).
4. **Pipeline:** `POST /fields/{id}/diagnose` → store photo in Supabase Storage → predict → map to Bangla Rx from KB → insert `diagnosis` Event → optional LLM rewrite of steps (short, actionable).
5. **UI:** Camera/file upload, result card (Bangla name, %, steps), “treatment logged” button → `treatment_logged` Event (feeds YieldMax).
6. **Acceptance:** Judge photo → named disease + confidence + ≥3 Bangla steps + Event visible to YieldMax within same session.

**Perf targets:** Predict p95 < 3s on free tier; image resize ≤ 512px before upload; cache KB in memory.

**Agent:** `agrisathi-crop-guardian`

---

### F2 — Precision Farm (~20%)

**Job:** Daily advice card — irrigate or not, fertilizer timing — from crop stage + weather.

| | Must-have | Stretch |
|---|-----------|---------|
| Demo | Daily card from stage + Open-Meteo | Soil test input; SMS |

**Execution plan**

1. **Stage engine:** sowing_date + crop calendar (BRRI/BARI) → stage enum (nursery, tillering, panicle, flowering, maturity).
2. **Weather:** Open-Meteo forecast for field lat/lon (or district centroid).
3. **Rules (Python, not LLM-only):** e.g. skip irrigation if precip_sum_48h > X mm; urea window by stage.
4. **LLM polish only:** turn rule output into 1–2 Bangla sentences.
5. **API:** `GET /fields/{id}/advice/today` → write `advice` Event.
6. **UI:** Home card “আজকের পরামর্শ”.

**Acceptance:** With rain in forecast, card says skip irrigation; Event stored.

**Agent:** `agrisathi-precision-farm`

---

### F3 — Climate Smart Farming (~15%)

**Job:** Weather-risk alerts (heavy rain, heat, flood) + one practical action; stress-tolerant variety hint.

| | Must-have | Stretch |
|---|-----------|---------|
| Demo | Risk alerts + one action; variety suggest | District salinity/flood layer |

**Execution plan**

1. **Risk rules:** thresholds on Open-Meteo (precip, temp_max, flood proxy from extreme precip).
2. **Variety KB:** BRRI flood/salt-tolerant varieties keyed by district risk tags.
3. **API:** `GET /fields/{id}/climate-alerts` → `weather_alert` Events.
4. **UI:** Alert chip/banner on home with one Bangla action.
5. **Cut first if time:** risk map layer — keep alerts only.

**Acceptance:** Demo forecast forces ≥1 alert with one action + variety line.

**Agent:** `agrisathi-climate-smart`

---

### F4 — YieldMax (~10%)

**Job:** Expected yield range for field; moves with disease reports and advice followed.

| | Must-have | Stretch |
|---|-----------|---------|
| Demo | Range up/down with Events | Season-over-season |

**Execution plan**

1. **Baseline:** BBS yield/ha × area × variety factor.
2. **Stress deltas:** diagnosis severity −%; treatment_logged recovers part; advice_followed small +.
3. **API:** `GET /fields/{id}/yield` → `{ low, mid, high, unit, drivers[] }`.
4. **UI:** Simple range + sparkline of Event-driven changes in demo.
5. **Honesty:** Label as estimate; cut history view before core range.

**Acceptance:** After Crop Guardian diagnosis, range drops; after treatment logged, partial recovery.

**Agent:** `agrisathi-yieldmax`

---

### F5 — FarmMarket (~15%)

**Job:** Nearby market prices, sell-now-or-wait hint, list buyers can see.

| | Must-have | Stretch |
|---|-----------|---------|
| Demo | Prices + wait/sell hint + public list | Buyer matching / in-app offers |

**Execution plan**

1. **Prices:** DAM daily CSV seed (day-zero check for live API); cache last good response.
2. **Hint rule:** compare today vs 7-day mean / harvest pressure from YieldMax tonnage available.
3. **Listing:** quantity capped by YieldMax mid estimate × area; `sale` Event.
4. **API:** `GET /markets/prices?district=` · `POST /fields/{id}/listings`.
5. **Cut first:** buyer matching — keep prices + hint + simple list.

**Acceptance:** Prices shown; hint visible; listing quantity respects yield estimate.

**Agent:** `agrisathi-farmmarket`

---

## 4. Platform foundation (before features)

| Deliverable | Owner agent |
|-------------|-------------|
| Monorepo layout `apps/web` + `apps/api` | `agrisathi-platform` |
| Supabase schema + RLS stubs | `agrisathi-platform` |
| Bangla design tokens + fonts | `agrisathi-platform` |
| Home dashboard shell (5 slots) | `agrisathi-platform` |
| Seed: Rahim + field + weather/price CSV | `agrisathi-demo-pitch` |
| OpenAPI contracts shared | `agrisathi-platform` |

---

## 5. Data sources (verify day zero)

| Need | Source | Consumer |
|------|--------|----------|
| Leaf images | PlantVillage; Kaggle rice leaf | Crop Guardian |
| Weather | Open-Meteo (no key) | Precision, Climate |
| Calendars / varieties | BRRI, BARI guides | Precision, Climate |
| Market prices | DAM daily; seed CSV | FarmMarket |
| Yield baselines | BBS yield/ha | YieldMax |
| Treatment advice | DAE, BRRI pest mgmt KB | Crop Guardian |

**Fallback:** realistic seeded file + announce in pitch.

---

## 6. Team ↔ agent map (4 humans)

| Human role | Owns | Agents to invoke |
|------------|------|------------------|
| ML lead | Model + yield logic | crop-guardian, yieldmax |
| Backend lead | API, DB, weather, prices, rules, LLM | platform, precision, climate, farmmarket |
| Frontend lead | PWA, Bangla UI, camera, dashboard | platform + all feature UI slices |
| Product/pitch | Persona, seed, copy, test, slides, backup video | demo-pitch |

---

## 7. Demo script (≈4 min)

1. **Meet Rahim (30s)** — create Bangla profile  
2. **Morning advice (40s)** — Precision + Climate on home  
3. **Something wrong (60s)** — Crop Guardian live leaf photo  
4. **Impact (30s)** — YieldMax drops then recovers  
5. **Harvest & sale (40s)** — FarmMarket prices + wait hint  
6. **Close (30s)** — one app, one profile; offline/voice/pilot next  

**Bring:** printed diseased leaves, backup screen recording, two preloaded phones.

---

## 8. Agent orchestration

```
agrisathi-platform          → schema, auth, PWA shell, shared types
        ↓
agrisathi-crop-guardian     → GATE A (hero) — blocks parallel depth work if failed
        ↓
agrisathi-precision-farm ─┬→ home cards
agrisathi-climate-smart  ─┘
        ↓
agrisathi-yieldmax  ─┬→ read Events
agrisathi-farmmarket─┘
        ↓
agrisathi-demo-pitch        → seed, Bangla copy QA, script, backup video checklist
```

Invoke one feature agent at a time for depth; platform first; never skip Crop Guardian gate.

**How to run in Cursor:** `@` / mention the skill name, or say “run the Crop Guardian agent” — skills live in `.cursor/skills/`. Router: `AGENTS.md`.
---

## 9. Definition of done (hackathon)

- [ ] Shared Farmer/Field profile in Bangla  
- [ ] Crop Guardian E2E with real or backup classifier  
- [ ] Precision daily card + Climate alert on home  
- [ ] YieldMax reacts to diagnosis/treatment  
- [ ] FarmMarket prices + sell/wait + listing  
- [ ] Backup recording + printed leaves  
- [ ] Safety disclaimer on chemical advice  
---
