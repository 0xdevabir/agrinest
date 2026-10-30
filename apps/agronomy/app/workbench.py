from datetime import date

from app.advice import build_advice, crop_stage
from app.climate import build_climate_alerts
from app.json_data import read_json
from app.yield_engine import estimate_detail

STAGE_EN = {
    "nursery": "Seedling",
    "tillering": "Tillering",
    "panicle": "Panicle initiation",
    "flowering": "Flowering",
    "maturity": "Maturity",
}
UREA_SPLITS = [
    ("tillering", 60, "কুশির সময় প্রথম ভাগ", "First split at tillering"),
    ("panicle", 50, "থোড়ের সময় দ্বিতীয় ভাগ", "Second split at panicle"),
]
VARIETY_COPY = {
    "BRRI dhan51": ("১০–১৫ দিন জল সহ্য করে", "Holds up through 10–15 days of floodwater"),
    "BRRI dhan52": ("আকস্মিক বন্যায় ভালো", "A safer pick when flash floods are likely"),
    "BRRI dhan47": ("লবণাক্ত পানিতে ফলন ধরে", "Keeps yield in saline water"),
    "BRRI dhan67": ("দক্ষিণ-পশ্চিমের লবণের জন্য", "Suited to south-west salinity"),
}


def _bi(bn: str, en: str) -> dict:
    return {"bn": bn, "en": en}


def _day_chip(precip: float, tmax: float) -> dict:
    if precip >= 15:
        return _bi("ভারী বৃষ্টি", "Heavy rain")
    if precip >= 5:
        return _bi("হালকা বৃষ্টি", "Light rain")
    if tmax >= 36:
        return _bi("গরম", "Hot")
    return _bi("শান্ত", "Calm")


def build_desk(crop: str, variety: str, area_ha: float, sowing_date: date, district: str, weather: dict, events: list[dict]) -> dict:
    advice = build_advice(crop, sowing_date, weather)
    stage = crop_stage(crop, sowing_date)
    climate = build_climate_alerts(weather, district)
    detail = estimate_detail(crop, variety, area_ha, events)
    calendars = read_json("crop_calendars.json")
    cal = calendars.get(crop) or calendars["rice"]
    precip48 = float(weather.get("precip_sum_48h_mm") or 0)
    days = stage["days_after_sowing"]
    current = next((item for item in cal["stages"] if item["id"] == stage["stage"]), cal["stages"][-1])
    span = max(1, current["day_end"] - current["day_start"])
    progress = min(1.0, max(0.0, (days - current["day_start"]) / span))
    days_left = max(0, current["day_end"] - days)

    timeline = []
    for item in cal["stages"]:
        if days > item["day_end"]:
            state = "past"
        elif item["id"] == current["id"]:
            state = "now"
        else:
            state = "next"
        timeline.append(
            {
                "id": item["id"],
                "name": _bi(item["name_bn"], STAGE_EN.get(item["id"], item["id"])),
                "day_start": item["day_start"],
                "day_end": item["day_end"],
                "state": state,
                "tip": _bi(cal["tips_bn"].get(item["id"], ""), cal["tips_bn"].get(item["id"], "")),
            }
        )

    if advice["irrigate"]:
        why = _bi(advice["irrigate_bn"], "Water today — little rain is expected over the next two days")
    else:
        why = _bi(advice["irrigate_bn"], f"Skip irrigation — about {precip48:.0f} mm of rain is likely in the next 48 hours")
    irrigation = {
        "decision": "water" if advice["irrigate"] else "skip",
        "mm": 25 if advice["irrigate"] else 0,
        "why": why,
        "precip_48h_mm": round(precip48, 1),
        "days": [
            {
                "date": day.get("date"),
                "precip_mm": day.get("precip_mm"),
                "temp_max_c": day.get("temp_max_c"),
                "chip": _day_chip(float(day.get("precip_mm") or 0), float(day.get("temp_max_c") or 0)),
            }
            for day in (weather.get("daily") or [])
        ],
    }

    apply_today = False
    kg_ha = 0
    splits = []
    for sid, kg, bn, en in UREA_SPLITS:
        meta = next(item for item in cal["stages"] if item["id"] == sid)
        if days > meta["day_end"]:
            status = "done"
        elif sid == current["id"] and precip48 < 25:
            status = "now"
            apply_today = True
            kg_ha = kg
        elif sid == current["id"]:
            status = "wait_rain"
        else:
            status = "later"
        splits.append(
            {
                "stage": sid,
                "name": _bi(meta["name_bn"], STAGE_EN.get(sid, sid)),
                "kg_per_ha": kg,
                "kg_for_field": round(kg * area_ha, 1),
                "status": status,
                "label": _bi(bn, en),
            }
        )

    book = read_json("varieties_bn.json")
    tags = set(book.get("district_tags", {}).get(district) or [])
    risk_ids = {alert["risk_id"] for alert in climate["alerts"]}
    if "heavy_rain" in risk_ids or "flood_proxy" in risk_ids:
        tags.add("flood_tolerant")
    varieties = []
    for tag, rows in (("flood_tolerant", book.get("flood_tolerant") or []), ("salt_tolerant", book.get("salt_tolerant") or [])):
        for row in rows:
            why_copy = VARIETY_COPY.get(row["id"], (row.get("note_bn", ""), row.get("note_bn", "")))
            varieties.append(
                {
                    "id": row["id"],
                    "name": _bi(row["name_bn"], row["id"]),
                    "why": _bi(why_copy[0], why_copy[1]),
                    "fits": tag in tags,
                    "tag": tag,
                }
            )

    history = []
    for event in sorted(events, key=lambda item: item.get("created_at") or "", reverse=True):
        if event.get("type") not in ("diagnosis", "treatment_logged"):
            continue
        payload = event.get("payload") or {}
        history.append(
            {
                "id": event.get("id"),
                "type": event.get("type"),
                "created_at": event.get("created_at"),
                "disease_id": payload.get("disease_id"),
                "name": _bi(str(payload.get("name_bn") or ""), str(payload.get("name_en") or "")),
                "confidence": payload.get("confidence"),
                "steps": payload.get("steps_bn") or [],
                "note": payload.get("chemical_note_bn"),
            }
        )

    return {
        "service": "agronomy",
        "advice": advice,
        "climate_alerts": climate,
        "yield_estimate": {key: detail[key] for key in ("low", "mid", "high", "unit", "baseline", "drivers")},
        "precision": {
            "summary": _bi(advice["summary_bn"], advice["summary_bn"]),
            "stage": stage["stage"],
            "stage_name": _bi(stage["stage_bn"], STAGE_EN.get(stage["stage"], stage["stage"])),
            "days_after_sowing": days,
            "days_left_in_stage": days_left,
            "progress": round(progress, 2),
            "tasks": [
                {"id": "irrigate", "title": _bi("সেচ", "Irrigation"), "detail": irrigation["why"], "tone": "skip" if irrigation["decision"] == "skip" else "do"},
                {
                    "id": "fertilizer",
                    "title": _bi("সার", "Fertilizer"),
                    "detail": _bi(advice["fertilizer_bn"] or "আজ সারের জানালা নেই", advice["fertilizer_bn"] or "No fertilizer window today"),
                    "tone": "do" if apply_today else "skip",
                },
                {
                    "id": "stage",
                    "title": _bi(stage["stage_bn"], STAGE_EN.get(stage["stage"], stage["stage"])),
                    "detail": _bi(stage["tip_bn"], stage["tip_bn"]),
                    "tone": "info",
                },
            ],
            "irrigation": irrigation,
            "fertilizer": {
                "apply_today": apply_today,
                "kg_per_ha": kg_ha,
                "kg_for_field": round(kg_ha * area_ha, 1),
                "rain_blocked": (not apply_today) and current["id"] in ("tillering", "panicle") and precip48 >= 25,
                "splits": splits,
                "note": _bi(
                    "পরিমাণ আনুমানিক। রাসায়নিক দেওয়ার আগে স্থানীয় কৃষি কর্মকর্তাকে জিজ্ঞাসা করুন।",
                    "Amounts are estimates. Confirm any chemical with a local agriculture officer.",
                ),
            },
            "timeline": timeline,
            "weather_source": weather.get("source", "unknown"),
        },
        "yield": {
            "low": detail["low"],
            "mid": detail["mid"],
            "high": detail["high"],
            "unit": detail["unit"],
            "baseline": detail["baseline"],
            "if_treated_mid": detail["if_treated_mid"],
            "open_stress": detail["open_stress"],
            "t_per_ha": detail["t_per_ha"],
            "variety_factor": detail["variety_factor"],
            "rows": detail["rows"],
            "gap_ton": round(max(0, detail["baseline"] - detail["mid"]), 3),
            "area_ha": area_ha,
            "variety": variety,
        },
        "climate": {
            "alerts": [
                {
                    "risk_id": alert["risk_id"],
                    "severity": alert["severity"],
                    "title": _bi(alert["title_bn"], alert["title_bn"]),
                    "action": _bi(alert["action_bn"], alert["action_bn"]),
                }
                for alert in climate["alerts"]
            ],
            "varieties": varieties,
            "outlook": irrigation["days"],
            "weather_source": climate["weather_source"],
        },
        "guardian": {"latest": next((item for item in history if item["type"] == "diagnosis"), None), "history": history[:12]},
    }
