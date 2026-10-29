from __future__ import annotations

import json
from typing import Any

from app.config import settings

SEVERITY = {
    "rice_blast": 0.12,
    "bacterial_leaf_blight": 0.14,
    "brown_spot": 0.08,
    "sheath_blight": 0.10,
    "unknown": 0.05,
    "healthy": 0.0,
}

DISEASE_NAMES = {
    "rice_blast": ("ব্লাস্ট", "Blast"),
    "bacterial_leaf_blight": ("বিএলবি", "Bacterial leaf blight"),
    "brown_spot": ("বাদামি দাগ", "Brown spot"),
    "sheath_blight": ("শেথ ব্লাইট", "Sheath blight"),
    "unknown": ("অনিশ্চিত", "Uncertain"),
    "healthy": ("সুস্থ", "Healthy"),
}


def _baselines() -> dict:
    return json.loads((settings.data_dir / "bbs_yield_baselines.json").read_text(encoding="utf-8"))


def estimate_detail(crop: str, variety: str, area_ha: float, events: list[Any]) -> dict:
    base_tbl = _baselines().get(crop) or _baselines()["rice"]
    t_ha = float(base_tbl["t_per_ha"])
    factors = base_tbl.get("variety_factors") or {}
    vfactor = float(factors.get(variety) or factors.get("default") or 1.0)
    baseline = t_ha * area_ha * vfactor

    mid = baseline
    drivers: list[str] = []
    rows: list[dict] = []
    open_diseases: set[str] = set()

    ordered = sorted(events, key=lambda e: e.created_at or "")
    for ev in ordered:
        payload = ev.payload or {}
        if ev.type == "diagnosis":
            did = payload.get("disease_id", "unknown")
            if did == "healthy":
                continue
            conf = float(payload.get("confidence") or 0.5)
            sev = SEVERITY.get(did, 0.08) * (0.7 + 0.3 * conf)
            mid *= 1.0 - sev
            open_diseases.add(did)
            bn, en = DISEASE_NAMES.get(did, (did, did))
            drivers.append(f"{did} −{sev * 100:.0f}%")
            rows.append({"id": did, "pct": round(-sev * 100, 1), "bn": bn, "en": en})
        elif ev.type == "treatment_logged":
            recover = 0.05 if open_diseases else 0.02
            mid *= 1.0 + recover
            drivers.append(f"treatment_logged +{recover * 100:.0f}%")
            rows.append(
                {
                    "id": "treatment",
                    "pct": round(recover * 100, 1),
                    "bn": "চিকিৎসা লগ",
                    "en": "Treatment logged",
                }
            )
            open_diseases.clear()
        elif ev.type == "advice" and payload.get("followed"):
            mid *= 1.02
            drivers.append("advice_followed +2%")
            rows.append({"id": "advice", "pct": 2.0, "bn": "পরামর্শ মানা হয়েছে", "en": "Advice followed"})

    mid = max(mid, baseline * 0.4)
    if_treated = mid * (1.05 if open_diseases else 1.0)
    if_treated = min(if_treated, baseline)
    return {
        "low": round(mid * 0.85, 3),
        "mid": round(mid, 3),
        "high": round(mid * 1.15, 3),
        "unit": "ton",
        "baseline": round(baseline, 3),
        "drivers": drivers[-6:],
        "rows": rows[-6:],
        "if_treated_mid": round(if_treated, 3),
        "open_stress": bool(open_diseases),
        "t_per_ha": t_ha,
        "variety_factor": vfactor,
    }


def estimate_yield(crop: str, variety: str, area_ha: float, events: list[Any]) -> dict:
    detail = estimate_detail(crop, variety, area_ha, events)
    return {k: detail[k] for k in ("low", "mid", "high", "unit", "baseline", "drivers")}
