from __future__ import annotations

import json
from datetime import date

from app.config import settings


def _calendars() -> dict:
    return json.loads((settings.data_dir / "crop_calendars.json").read_text(encoding="utf-8"))


def crop_stage(crop: str, sowing_date: date, today: date | None = None) -> dict:
    today = today or date.today()
    days = max(0, (today - sowing_date).days)
    cal = _calendars().get(crop) or _calendars()["rice"]
    stage = cal["stages"][-1]
    for s in cal["stages"]:
        if s["day_start"] <= days <= s["day_end"]:
            stage = s
            break
        if days < s["day_start"]:
            stage = s
            break
    return {
        "stage": stage["id"],
        "stage_bn": stage["name_bn"],
        "days_after_sowing": days,
        "urea_windows": cal["urea_windows"],
        "tip_bn": cal["tips_bn"].get(stage["id"], ""),
    }


def build_advice(crop: str, sowing_date: date, weather: dict) -> dict:
    stage = crop_stage(crop, sowing_date)
    precip48 = float(weather.get("precip_sum_48h_mm") or 0)
    irrigate = precip48 < 15
    if irrigate:
        irrigate_bn = "আজ সেচ দিন—আগামী দুই দিনে পর্যাপ্ত বৃষ্টির সম্ভাবনা কম"
    else:
        irrigate_bn = f"সেচ এড়িয়ে চলুন—আগামী ৪৮ ঘণ্টায় প্রায় {precip48:.0f} মিমি বৃষ্টির সম্ভাবনা"

    fertilizer_bn = None
    if stage["stage"] in stage["urea_windows"] and precip48 < 25:
        fertilizer_bn = f"{stage['stage_bn']} পর্যায়ে ইউরিয়া সারের উপযুক্ত সময়"
    elif stage["stage"] in stage["urea_windows"]:
        fertilizer_bn = "বৃষ্টির পর সার দিন—আজ নয়"

    summary = irrigate_bn
    if fertilizer_bn:
        summary = f"{irrigate_bn}. {fertilizer_bn}."
    elif stage["tip_bn"]:
        summary = f"{irrigate_bn}. {stage['tip_bn']}"

    return {
        "stage": stage["stage"],
        "stage_bn": stage["stage_bn"],
        "irrigate": irrigate,
        "irrigate_bn": irrigate_bn,
        "fertilizer_bn": fertilizer_bn,
        "summary_bn": summary,
        "weather_source": weather.get("source", "unknown"),
    }
