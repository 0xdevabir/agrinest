from __future__ import annotations

import json
import time
from typing import Any

import httpx

from app.config import settings

_cache: dict[str, tuple[float, dict[str, Any]]] = {}
CACHE_TTL = 1800


def _seed() -> dict[str, Any]:
    path = settings.data_dir / "weather_seed.json"
    return json.loads(path.read_text(encoding="utf-8"))


async def get_weather(lat: float, lon: float, force_seed: bool = False) -> dict[str, Any]:
    if force_seed or settings.use_seed_weather:
        data = _seed()
        data["source"] = "seed"
        return data

    key = f"{round(lat, 2)}:{round(lon, 2)}"
    now = time.time()
    if key in _cache and now - _cache[key][0] < CACHE_TTL:
        return _cache[key][1]

    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "precipitation_sum,temperature_2m_max,temperature_2m_min",
        "timezone": "Asia/Dhaka",
        "forecast_days": 3,
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(settings.open_meteo_base, params=params)
            r.raise_for_status()
            raw = r.json()
        daily = raw.get("daily", {})
        precip = daily.get("precipitation_sum") or [0, 0, 0]
        tmax = daily.get("temperature_2m_max") or [30, 30, 30]
        tmin = daily.get("temperature_2m_min") or [22, 22, 22]
        dates = daily.get("time") or []
        data = {
            "precip_sum_48h_mm": float(precip[0]) + float(precip[1] if len(precip) > 1 else 0),
            "precip_24h_mm": float(precip[0]),
            "temp_max_c": float(tmax[0]),
            "temp_min_c": float(tmin[0]),
            "daily": [
                {
                    "date": dates[i] if i < len(dates) else "",
                    "precip_mm": float(precip[i]),
                    "temp_max_c": float(tmax[i]),
                    "temp_min_c": float(tmin[i]) if i < len(tmin) else None,
                }
                for i in range(min(7, len(precip)))
            ],
            "source": "open-meteo",
        }
        _cache[key] = (now, data)
        return data
    except Exception:
        data = _seed()
        data["source"] = "seed"
        return data

