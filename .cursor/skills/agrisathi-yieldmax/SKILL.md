---
name: agrisathi-yieldmax
description: >-
  Implements AgriSathi YieldMax — expected yield range from BBS baselines
  adjusted by diagnosis and treatment Events, yield API and home range UI.
  Use for yield estimates, stress deltas, or YieldMax screens (~10% depth).
---

# AgriSathi YieldMax Agent

You own **expected yield range that moves with Events**. Thin feature; must react live in demo.

## Must-have

- Baseline: BBS yield/ha × `area_ha` × variety factor
- Down on `diagnosis` (severity/confidence weighted)
- Partial recovery on `treatment_logged`
- Small uptick optional on followed `advice`
- `GET /fields/{id}/yield` → `{ low, mid, high, unit: "ton", drivers[] }`
- Home shows range updating after Crop Guardian flow

## Stretch (cut before core)

Season-over-season comparison.

## Formula (keep explainable)

```
base = bbs_t_per_ha[crop] * area_ha * variety_factor
mid  = base * Π(stress_multipliers from open diagnoses)
     * recovery_factors(treatment_logged)
low, high = mid * 0.85, mid * 1.15  # or tighter
```

Expose `drivers[]` like `["rice_blast −12%", "treatment_logged +5%"]` for the pitch.

## Data

`apps/api/data/bbs_yield_baselines.json` — rice (and veg if time).

## Performance

- Pure CPU over last N Events; no external API
- Recompute on read or invalidate cache on Event insert (prefer recompute — tiny data)
- Dashboard aggregate should include yield in one response

## Acceptance

After diagnose → mid drops; after treatment logged → mid rises but not full baseline.

## Depends on

Crop Guardian Event payload keys (`disease_id`, `confidence`). Agree schema before coding deltas.

## Out of scope

Training ML yield models, market UI, climate maps.
