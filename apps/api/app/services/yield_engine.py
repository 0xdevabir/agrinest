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


def _baselines() -> dict:
    return json.loads((settings.data_dir / "bbs_yield_baselines.json").read_text(encoding="utf-8"))


def estimate_yield(crop: str, variety: str, area_ha: float, events: list[Any]) -> dict:
    base_tbl = _baselines().get(crop) or _baselines()["rice"]
    t_ha = float(base_tbl["t_per_ha"])
    factors = base_tbl.get("variety_factors") or {}
    vfactor = float(factors.get(variety) or factors.get("default") or 1.0)
    baseline = t_ha * area_ha * vfactor

    mid = baseline
    drivers: list[str] = []
    open_diseases: set[str] = set()

    # chronological
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
            drivers.append(f"{did} −{sev * 100:.0f}%")
        elif ev.type == "treatment_logged":
            # recover part of stress
            recover = 0.05 if open_diseases else 0.02
            mid *= 1.0 + recover
            drivers.append(f"treatment_logged +{recover * 100:.0f}%")
            open_diseases.clear()
        elif ev.type == "advice":
            if payload.get("followed"):
                mid *= 1.02
                drivers.append("advice_followed +2%")

    mid = max(mid, baseline * 0.4)
    return {
        "low": round(mid * 0.85, 3),
        "mid": round(mid, 3),
        "high": round(mid * 1.15, 3),
        "unit": "ton",
        "baseline": round(baseline, 3),
        "drivers": drivers[-6:],
    }
