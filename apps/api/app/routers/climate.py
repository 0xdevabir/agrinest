from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from app.db import get_db
from app.models import Event, Farmer, Field
from app.schemas import ClimateAlert, ClimateOut, EventOut
from app.services.climate import build_climate_alerts
from app.services.weather import get_weather

router = APIRouter(tags=["climate-smart"])


@router.get("/fields/{field_id}/climate-alerts", response_model=ClimateOut)
async def climate_alerts(
    field_id: str,
    force_seed_weather: bool = Query(False),
    persist: bool = Query(True),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Field).where(Field.id == field_id).options(selectinload(Field.farmer))
    )
    field = result.scalar_one_or_none()
    if not field:
        raise HTTPException(404, "জমি পাওয়া যায়নি")

    farmer = field.farmer
    if farmer is None:
        farmer = await db.get(Farmer, field.farmer_id)

    weather = await get_weather(field.lat, field.lon, force_seed=force_seed_weather)
    built = build_climate_alerts(weather, farmer.district if farmer else "")

    events: list[Event] = []
    if persist:
        for alert in built["alerts"]:
            ev = Event(field_id=field_id, type="weather_alert", payload=alert)
            db.add(ev)
            events.append(ev)
        await db.commit()
        for ev in events:
            await db.refresh(ev)

    return ClimateOut(
        alerts=[ClimateAlert(**a) for a in built["alerts"]],
        variety_hint_bn=built["variety_hint_bn"],
        weather_source=built["weather_source"],
        events=[EventOut.model_validate(e) for e in events],
    )
