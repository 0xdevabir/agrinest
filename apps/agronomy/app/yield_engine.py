from app.json_data import read_json

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


def _round3(value: float) -> float:
    return round(value, 3)


def estimate_detail(crop: str, variety: str, area_ha: float, events: list[dict]) -> dict:
    table = read_json("bbs_yield_baselines.json")
    base = table.get(crop) or table["rice"]
    factors = base.get("variety_factors") or {}
    vfactor = float(factors.get(variety) or factors.get("default") or 1.0)
    baseline = float(base["t_per_ha"]) * area_ha * vfactor
    mid = baseline
    drivers: list[str] = []
    rows: list[dict] = []
    open_diseases: set[str] = set()

    ordered = sorted(events, key=lambda event: event.get("created_at") or "")
    for event in ordered:
        payload = event.get("payload") or {}
        if event.get("type") == "diagnosis":
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
        elif event.get("type") == "treatment_logged":
            recover = 0.05 if open_diseases else 0.02
            mid *= 1.0 + recover
            drivers.append(f"treatment_logged +{recover * 100:.0f}%")
            rows.append({"id": "treatment", "pct": round(recover * 100, 1), "bn": "চিকিৎসা লগ", "en": "Treatment logged"})
            open_diseases.clear()
        elif event.get("type") == "advice" and payload.get("followed"):
            mid *= 1.02
            drivers.append("advice_followed +2%")
            rows.append({"id": "advice", "pct": 2.0, "bn": "পরামর্শ মানা হয়েছে", "en": "Advice followed"})

    mid = max(mid, baseline * 0.4)
    if_treated = min(mid * (1.05 if open_diseases else 1.0), baseline)
    return {
        "low": _round3(mid * 0.85),
        "mid": _round3(mid),
        "high": _round3(mid * 1.15),
        "unit": "ton",
        "baseline": _round3(baseline),
        "drivers": drivers[-6:],
        "rows": rows[-6:],
        "if_treated_mid": _round3(if_treated),
        "open_stress": bool(open_diseases),
        "t_per_ha": base["t_per_ha"],
        "variety_factor": vfactor,
    }


def estimate_yield(crop: str, variety: str, area_ha: float, events: list[dict]) -> dict:
    detail = estimate_detail(crop, variety, area_ha, events)
    return {key: detail[key] for key in ("low", "mid", "high", "unit", "baseline", "drivers")}
