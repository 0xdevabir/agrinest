from __future__ import annotations

import time

import httpx

from app.config import OPEN_METEO, USE_SEED_WEATHER
from app.json_data import read_json

_cache: dict[str, tuple[float, dict]] = {}
CACHE_TTL = 1800


async def get_weather(lat: float, lon: float, force_seed: bool = False) -> dict:
    if force_seed or USE_SEED_WEATHER:
        data = dict(read_json("weather_seed.json"))
        data["source"] = "seed"
        return data

    key = f"{round(lat, 2)}:{round(lon, 2)}"
    now = time.time()
    hit = _cache.get(key)
    if hit and now - hit[0] < CACHE_TTL:
        return hit[1]

    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "precipitation_sum,temperature_2m_max,temperature_2m_min",
        "timezone": "Asia/Dhaka",
        "forecast_days": 3,
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(OPEN_METEO, params=params)
            response.raise_for_status()
            raw = response.json()
        daily = raw.get("daily") or {}
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
        data = dict(read_json("weather_seed.json"))
        data["source"] = "seed"
        return data
