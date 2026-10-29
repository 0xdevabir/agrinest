from __future__ import annotations

import csv
from functools import lru_cache

from app.config import settings


@lru_cache(maxsize=1)
def _load_prices() -> list[dict]:
    path = settings.data_dir / "dam_prices_seed.csv"
    rows: list[dict] = []
    with path.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rows.append(
                {
                    "date": row["date"],
                    "district": row["district"],
                    "market": row["market"],
                    "crop": row["crop"],
                    "unit": row["unit"],
                    "price_bdt": float(row["price_bdt"]),
                }
            )
    return rows


def prices_for_district(district: str, crop: str = "ধান") -> tuple[list[dict], str]:
    rows = _load_prices()
    filtered = [r for r in rows if r["district"] == district and r["crop"] == crop]
    if not filtered:
        # fallback: any matching crop latest
        filtered = [r for r in rows if r["crop"] == crop]
    # latest date rows for markets
    if not filtered:
        return [], "seed"
    latest = max(r["date"] for r in filtered)
    today_rows = [r for r in filtered if r["date"] == latest]
    return [
        {
            "market": r["market"],
            "crop": r["crop"],
            "unit": r["unit"],
            "price_bdt": r["price_bdt"],
            "date": r["date"],
        }
        for r in today_rows
    ], "seed"


def market_hint(district: str, crop: str = "ধান") -> dict:
    rows = _load_prices()
    series = [r for r in rows if r["district"] == district and r["crop"] == crop]
    if not series:
        series = [r for r in rows if r["crop"] == crop]
    prices, source = prices_for_district(district, crop)
    if not series:
        return {
            "action": "wait",
            "reason_bn": "বাজারের তথ্য পাওয়া যায়নি—কিছুদিন অপেক্ষা করুন",
            "prices": prices,
            "source": source,
        }

    by_date: dict[str, list[float]] = {}
    for r in series:
        by_date.setdefault(r["date"], []).append(r["price_bdt"])
    dates = sorted(by_date)
    latest = dates[-1]
    today_avg = sum(by_date[latest]) / len(by_date[latest])
    window = dates[-7:]
    mean7 = sum(sum(by_date[d]) / len(by_date[d]) for d in window) / len(window)

    if today_avg >= mean7 * 1.02:
        action = "sell"
        reason = f"আজকের দাম ({today_avg:.0f} টাকা) গত সপ্তাহের গড়ের চেয়ে ভালো—বিক্রি বিবেচনা করুন"
    else:
        action = "wait"
        reason = f"আজকের দাম ({today_avg:.0f} টাকা) একটু কম—২–৩ দিন অপেক্ষা করলে ভালো হতে পারে"

    return {
        "action": action,
        "reason_bn": reason,
        "prices": prices,
        "source": source,
    }
