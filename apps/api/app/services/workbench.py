"""Rich but explainable numbers for every feature screen."""

from __future__ import annotations

import json
from datetime import date
from typing import Any

from app.config import settings
from app.services.advice import build_advice, crop_stage
from app.services.climate import build_climate_alerts
from app.services.market import market_hint
from app.services.yield_engine import estimate_detail

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
    "BRRI dhan51": (
        "১০–১৫ দিন জল সহ্য করে",
        "Holds up through 10–15 days of floodwater",
    ),
    "BRRI dhan52": (
        "আকস্মিক বন্যায় ভালো",
        "A safer pick when flash floods are likely",
    ),
    "BRRI dhan47": (
        "লবণাক্ত পানিতে ফলন ধরে",
        "Keeps yield in saline water",
    ),
    "BRRI dhan67": (
        "দক্ষিণ-পশ্চিমের লবণের জন্য",
        "Suited to south-west salinity",
    ),
}


def _bi(bn: str, en: str) -> dict[str, str]:
    return {"bn": bn, "en": en}


def _calendars() -> dict:
    return json.loads((settings.data_dir / "crop_calendars.json").read_text(encoding="utf-8"))


def _varieties() -> dict:
    return json.loads((settings.data_dir / "varieties_bn.json").read_text(encoding="utf-8"))


def _day_chip(precip: float, tmax: float) -> dict[str, str]:
    if precip >= 15:
        return _bi("ভারী বৃষ্টি", "Heavy rain")
    if precip >= 5:
        return _bi("হালকা বৃষ্টি", "Light rain")
    if tmax >= 36:
        return _bi("গরম", "Hot")
    return _bi("শান্ত", "Calm")


def build_workbench(
    *,
    crop: str,
    variety: str,
    area_ha: float,
    sowing_date: date,
    district: str,
    weather: dict,
    events: list[Any],
    listings: list[Any],
) -> dict:
    advice = build_advice(crop, sowing_date, weather)
    stage = crop_stage(crop, sowing_date)
    climate = build_climate_alerts(weather, district)
    y = estimate_detail(crop, variety, area_ha, events)
    hint = market_hint(district)
    cal = _calendars().get(crop) or _calendars()["rice"]

    precip48 = float(weather.get("precip_sum_48h_mm") or 0)
    days = stage["days_after_sowing"]
    current = next((s for s in cal["stages"] if s["id"] == stage["stage"]), cal["stages"][-1])
    span = max(1, current["day_end"] - current["day_start"])
    progress = min(1.0, max(0.0, (days - current["day_start"]) / span))
    days_left = max(0, current["day_end"] - days)

    timeline = []
    for s in cal["stages"]:
        if days > s["day_end"]:
            state = "past"
        elif s["id"] == current["id"]:
            state = "now"
        else:
            state = "next"
        timeline.append(
            {
                "id": s["id"],
                "name": _bi(s["name_bn"], STAGE_EN.get(s["id"], s["id"])),
                "day_start": s["day_start"],
                "day_end": s["day_end"],
                "state": state,
                "tip": _bi(cal["tips_bn"].get(s["id"], ""), cal["tips_bn"].get(s["id"], "")),
            }
        )

    mm = 0 if not advice["irrigate"] else 25
    if advice["irrigate"]:
        why = _bi(advice["irrigate_bn"], "Water today — little rain is expected over the next two days")
    else:
        why = _bi(
            advice["irrigate_bn"],
            f"Skip irrigation — about {precip48:.0f} mm of rain is likely in the next 48 hours",
        )
    irrigation = {
        "decision": "water" if advice["irrigate"] else "skip",
        "mm": mm,
        "why": why,
        "precip_48h_mm": round(precip48, 1),
        "days": [
            {
                "date": d.get("date"),
                "precip_mm": d.get("precip_mm"),
                "temp_max_c": d.get("temp_max_c"),
                "chip": _day_chip(float(d.get("precip_mm") or 0), float(d.get("temp_max_c") or 0)),
            }
            for d in (weather.get("daily") or [])
        ],
    }

    splits = []
    apply_today = False
    kg_ha = 0
    for sid, kg, bn, en in UREA_SPLITS:
        meta = next(s for s in cal["stages"] if s["id"] == sid)
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

    tasks = [
        {
            "id": "irrigate",
            "title": _bi("সেচ", "Irrigation"),
            "detail": irrigation["why"],
            "tone": "skip" if irrigation["decision"] == "skip" else "do",
        },
        {
            "id": "fertilizer",
            "title": _bi("সার", "Fertilizer"),
            "detail": _bi(
                advice["fertilizer_bn"] or "আজ সারের জানালা নেই",
                advice["fertilizer_bn"] or "No fertilizer window today",
            ),
            "tone": "do" if apply_today else "skip",
        },
        {
            "id": "stage",
            "title": _bi(stage["stage_bn"], STAGE_EN.get(stage["stage"], stage["stage"])),
            "detail": _bi(stage["tip_bn"], stage["tip_bn"]),
            "tone": "info",
        },
    ]

    prices = hint["prices"]
    best = max(prices, key=lambda p: p["price_bdt"]) if prices else None
    series = _price_series(district)
    today_avg = series[-1]["avg"] if series else 0
    mean7 = sum(p["avg"] for p in series[-7:]) / max(1, len(series[-7:]))
    quintals = y["mid"] * 10
    now_bdt = round(quintals * today_avg)
    wait_price = max(mean7, today_avg * 1.03)
    wait_bdt = round(quintals * wait_price)
    listed = sum(float(getattr(item, "quantity_ton", 0) or 0) for item in listings)

    vkb = _varieties()
    tags = set(vkb.get("district_tags", {}).get(district) or [])
    risk_ids = {a["risk_id"] for a in climate["alerts"]}
    if "heavy_rain" in risk_ids or "flood_proxy" in risk_ids:
        tags.add("flood_tolerant")
    varieties = []
    for tag, rows in (("flood_tolerant", vkb.get("flood_tolerant") or []), ("salt_tolerant", vkb.get("salt_tolerant") or [])):
        for row in rows:
            why = VARIETY_COPY.get(row["id"], (row.get("note_bn", ""), row.get("note_bn", "")))
            varieties.append(
                {
                    "id": row["id"],
                    "name": _bi(row["name_bn"], row["id"]),
                    "why": _bi(why[0], why[1]),
                    "fits": tag in tags,
                    "tag": tag,
                }
            )

    history = []
    latest = None
    for ev in sorted(events, key=lambda e: e.created_at or "", reverse=True):
        if ev.type not in ("diagnosis", "treatment_logged"):
            continue
        payload = ev.payload or {}
        item = {
            "id": ev.id,
            "type": ev.type,
            "created_at": ev.created_at.isoformat() if ev.created_at else None,
            "disease_id": payload.get("disease_id"),
            "name": _bi(str(payload.get("name_bn") or ""), str(payload.get("name_en") or "")),
            "confidence": payload.get("confidence"),
            "steps": payload.get("steps_bn") or [],
            "note": payload.get("chemical_note_bn"),
        }
        history.append(item)
        if latest is None and ev.type == "diagnosis":
            latest = item

    return {
        "precision": {
            "summary": _bi(advice["summary_bn"], advice["summary_bn"]),
            "stage": stage["stage"],
            "stage_name": _bi(stage["stage_bn"], STAGE_EN.get(stage["stage"], stage["stage"])),
            "days_after_sowing": days,
            "days_left_in_stage": days_left,
            "progress": round(progress, 2),
            "tasks": tasks,
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
            **{k: y[k] for k in ("low", "mid", "high", "unit", "baseline", "if_treated_mid", "open_stress", "t_per_ha", "variety_factor")},
            "rows": y["rows"],
            "gap_ton": round(max(0, y["baseline"] - y["mid"]), 3),
            "area_ha": area_ha,
            "variety": variety,
        },
        "market": {
            "action": hint["action"],
            "reason": _bi(hint["reason_bn"], hint["reason_bn"]),
            "source": hint["source"],
            "prices": prices,
            "best": best,
            "series": series,
            "today_avg": round(today_avg),
            "mean7": round(mean7),
            "now_bdt": now_bdt,
            "wait_bdt": wait_bdt,
            "delta_bdt": wait_bdt - now_bdt,
            "cap_ton": y["mid"],
            "listed_ton": round(listed, 3),
            "remaining_ton": round(max(0, y["mid"] - listed), 3),
            "listings": [
                {
                    "id": item.id,
                    "quantity_ton": item.quantity_ton,
                    "district": item.district,
                    "crop": item.crop,
                }
                for item in listings
            ],
        },
        "climate": {
            "alerts": [
                {
                    "risk_id": a["risk_id"],
                    "severity": a["severity"],
                    "title": _bi(a["title_bn"], a["title_bn"]),
                    "action": _bi(a["action_bn"], a["action_bn"]),
                }
                for a in climate["alerts"]
            ],
            "varieties": varieties,
            "outlook": irrigation["days"],
            "weather_source": climate["weather_source"],
        },
        "guardian": {"latest": latest, "history": history[:12]},
    }


def _price_series(district: str) -> list[dict]:
    from app.services.market import _load_prices

    rows = [r for r in _load_prices() if r["district"] == district and r["crop"] == "ধান"]
    if not rows:
        rows = [r for r in _load_prices() if r["crop"] == "ধান"]
    by_date: dict[str, list[float]] = {}
    for r in rows:
        by_date.setdefault(r["date"], []).append(r["price_bdt"])
    return [{"date": d, "avg": round(sum(by_date[d]) / len(by_date[d]))} for d in sorted(by_date)]

