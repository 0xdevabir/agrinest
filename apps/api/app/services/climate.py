from __future__ import annotations

import json

from app.config import settings


def _varieties() -> dict:
    return json.loads((settings.data_dir / "varieties_bn.json").read_text(encoding="utf-8"))


def build_climate_alerts(weather: dict, district: str) -> dict:
    alerts: list[dict] = []
    precip24 = float(weather.get("precip_24h_mm") or 0)
    precip48 = float(weather.get("precip_sum_48h_mm") or 0)
    tmax = float(weather.get("temp_max_c") or 0)

    if precip24 >= 15 or precip48 >= 25:
        alerts.append(
            {
                "risk_id": "heavy_rain",
                "title_bn": "ভারী বৃষ্টির ঝুঁকি",
                "action_bn": "আইল ও নিকাশ নালা খোলা রাখুন যাতে ক্ষেতে পানি জমে না থাকে",
                "severity": "high" if precip48 >= 30 else "medium",
            }
        )
    if precip48 >= 40:
        alerts.append(
            {
                "risk_id": "flood_proxy",
                "title_bn": "বন্যার মতো জলাবদ্ধতার ঝুঁকি",
                "action_bn": "চারা উঁচু জায়গায় সরান এবং বন্যাসহনশীল জাত বিবেচনা করুন",
                "severity": "high",
            }
        )
    if tmax >= 36:
        alerts.append(
            {
                "risk_id": "heat",
                "title_bn": "তীব্র গরমের চাপ",
                "action_bn": "সকাল/বিকেলে সেচ দিন; দুপুরে জলসেক এড়ান",
                "severity": "medium",
            }
        )

    variety_hint = None
    vkb = _varieties()
    tags = vkb.get("district_tags", {}).get(district) or []
    if any(a["risk_id"] in ("flood_proxy", "heavy_rain") for a in alerts) and "flood_tolerant" in tags:
        pick = vkb["flood_tolerant"][0]
        variety_hint = f"পরামর্শকৃত জাত: {pick['name_bn']} ({pick['note_bn']})"
    elif "salt_tolerant" in tags:
        pick = vkb["salt_tolerant"][0]
        variety_hint = f"লবণাক্ত এলাকায় উপযোগী: {pick['name_bn']}"
    elif any(a["risk_id"] == "flood_proxy" for a in alerts):
        pick = vkb["flood_tolerant"][0]
        variety_hint = f"পরামর্শকৃত জাত: {pick['name_bn']} ({pick['note_bn']})"

    return {
        "alerts": alerts,
        "variety_hint_bn": variety_hint,
        "weather_source": weather.get("source", "unknown"),
    }
