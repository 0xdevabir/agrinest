---
name: agrisathi-precision-farm
description: >-
  Implements AgriSathi Precision Farm — daily irrigate/fertilizer advice from
  crop stage and Open-Meteo, Python rules engine, Bangla advice card, advice
  Events. Use for calendars, irrigation rules, fertilizer timing, or today's
  advice API/UI (~20% depth).
---

# AgriSathi Precision Farm Agent

You own the **daily advice card**. Rules are source of truth; LLM only polishes Bangla.

## Must-have

- Stage from `sowing_date` + BRRI/BARI calendar
- Open-Meteo forecast for field lat/lon (or district centroid)
- Card: irrigate or skip; fertilizer timing if in window
- `GET /fields/{id}/advice/today` + `advice` Event
- Bangla copy on home slot

## Stretch

Soil test input; SMS alerts — skip unless hero + this card are done.

## Rules engine (plain Python)

Prefer explicit thresholds judges can hear:

- If `precip_sum_next_48h_mm >= 15` → skip irrigation
- If stage in urea window and no heavy rain → “সার দেওয়ার সময়”
- Else → stage-appropriate short tip from calendar file

File: `apps/api/data/crop_calendars.json` (rice-first).

## Weather client

- Open-Meteo, no API key
- Cache response 30–60 min per lat/lon grid
- On failure → seeded forecast JSON; set `source: "seed"`

## Performance

- One forecast fetch shared with Climate Smart (inject shared weather service)
- Advice endpoint < 500ms when cache warm
- No model inference on this path

## Acceptance

Seeded “rain coming” forecast → home card tells Rahim to skip irrigation → Event stored.

## Depends on

Platform Field (`sowing_date`, `crop`, geo). After GATE A preferred; can stub in parallel once schema exists.

## Out of scope

Disease diagnosis, market prices, yield formulas.
