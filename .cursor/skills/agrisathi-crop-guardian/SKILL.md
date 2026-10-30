---
name: agrisathi-crop-guardian
description: >-
  Implements AgriSathi Crop Guardian hero feature — leaf photo disease
  classification, Bangla treatment steps, diagnose API, camera UI, diagnosis
  and treatment_logged Events. Use for disease model, PlantVillage training,
  /diagnose, vision-LLM backup, or Crop Guardian screens. Highest priority gate.
---

# AgriSathi Crop Guardian Agent (HERO)

You own **photo → disease → Bangla Rx → Field Event**. This is ~40% of effort and **GATE A (hour 24)**. If this is broken, tell the user to pause other features.

## Must-have

1. Upload/capture leaf image
2. Model returns disease name + confidence
3. Bangla treatment steps (≥3) from DAE/BRRI knowledge file
4. Persist `diagnosis` Event on Field; photo in Storage
5. “Treatment done” → `treatment_logged` Event (YieldMax depends on this)

## Stretch (only after E2E green)

Outbreak map; Bangla TTS of steps.

## Implementation order (perf-first)

1. **Scope diseases to 4–6 rice classes** (blast, BLB, brown spot, sheath blight, …). Do not chase 38-class PlantVillage on day one.
2. Train/fine-tune **EfficientNet-B0 or MobileNetV3**; preprocess 224×224; export weights into `apps/api`.
3. Nest `POST /fields/{id}/diagnose` (multipart): resize → infer → KB lookup → optional LLM shorten to Bangla → insert Event.
4. **Backup path:** if conf < 0.45 or model error → vision LLM classifier with same JSON schema (`disease_id`, `confidence`, `source: "backup"`).
5. In-memory cache of Rx KB; warm on startup.
6. Frontend: one screen — shutter → result card (Bangla name, %, steps, disclaimer).

## Knowledge file shape

`apps/api/data/treatments_bn.json`:

```json
{
  "rice_blast": {
    "name_bn": "...",
    "steps_bn": ["...", "...", "..."],
    "source": "BRRI/DAE",
    "chemical_note_bn": "স্থানীয় কৃষি কর্মকর্তার সাথে নিশ্চিত করুন"
  }
}
```

## Performance

- p95 infer < 3s on free CPU; batch size 1; no GPU assumed
- Reject / compress images > 2MB
- Do not block response on LLM polish — return KB steps first, polish async only if time allows; for demo, sync LLM OK if timeout 8s with KB fallback

## Acceptance (GATE A)

Judge photo of printed diseased leaf → named disease + confidence + Bangla steps + Event exists → YieldMax agent can read it.

## Never

- Cut this flow or shared profile to save time
- Invent unsafe pesticide doses; stick to KB + officer disclaimer
- Build outbreak map before E2E diagnose works

## Depends on

`agrisathi-platform` schema + Storage. Coordinate Event payload keys with YieldMax (`disease_id`, `confidence`, `severity`).
