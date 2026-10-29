---
name: agrisathi-climate-smart
description: >-
  Implements AgriSathi Climate Smart Farming — heavy rain/heat/flood risk
  alerts with one Bangla action each, stress-tolerant variety suggestions,
  weather_alert Events. Use for climate risk rules, BRRI variety hints, or
  climate home alerts (~15% depth).
---

# AgriSathi Climate Smart Agent

You own **weather-risk alerts + one action + variety hint**. Reuse Precision Farm’s weather client.

## Must-have

- Detect heavy rain / heat / flood-proxy from Open-Meteo
- Each alert: one practical Bangla action
- Suggest stress-tolerant variety from BRRI list when district/risk matches
- `weather_alert` Events + home banner/chip

## Stretch (cut early if needed)

District salinity/flood **map layer** — drop before thinning alerts.

## Risk rules (examples)

| Signal | Threshold idea | Action tone |
|--------|----------------|-------------|
| Heavy rain | precip_24h high | Drain/bund check |
| Heat | temp_max ≥ 36°C | Irrigation timing / mulch tip |
| Flood proxy | extreme precip multi-day | Move nursery / choose flood-tolerant variety |

Tune numbers in one config file; document in pitch.

## Variety KB

`apps/api/data/varieties_bn.json` — flood/salt tolerant rice keyed by risk tags + districts (SW salinity narrative for demo).

## Performance

- Share cached forecast with Precision Farm
- Pure rules + JSON; no LLM required (optional one-line Bangla rewrite)
- Alerts endpoint merges into `GET /fields/{id}/dashboard`

## Acceptance

Forced demo weather → ≥1 alert with one action + variety line visible beside Precision card.

## Depends on

Platform Field + shared weather module. Coordinate home UI with Precision Farm agent (one weather fetch).

## Out of scope

Buyer matching, disease model, yield history charts.
