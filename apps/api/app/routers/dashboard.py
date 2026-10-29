from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models import Event, Farmer, Field
from app.schemas import (
    AdviceOut,
    ClimateAlert,
    ClimateOut,
    DashboardOut,
    EventOut,
    FarmerOut,
    FieldOut,
    MarketHintOut,
    PriceRow,
    YieldOut,
)
from app.services.advice import build_advice
from app.services.climate import build_climate_alerts
from app.services import market as market_svc
from app.services.weather import get_weather
from app.services.yield_engine import estimate_yield

router = APIRouter(tags=["dashboard"])


@router.get("/fields/{field_id}/dashboard", response_model=DashboardOut)
async def dashboard(
    field_id: str,
    force_seed_weather: bool = Query(True),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Field).where(Field.id == field_id).options(selectinload(Field.farmer))
    )
    field = result.scalar_one_or_none()
    if not field:
        raise HTTPException(404, "জমি পাওয়া যায়নি")
    farmer = field.farmer or await db.get(Farmer, field.farmer_id)
    if not farmer:
        raise HTTPException(404, "কৃষক পাওয়া যায়নি")

    ev_result = await db.execute(
        select(Event).where(Event.field_id == field_id).order_by(Event.created_at.desc())
    )
    events = list(ev_result.scalars().all())

    weather = await get_weather(field.lat, field.lon, force_seed=force_seed_weather)
    advice = build_advice(field.crop, field.sowing_date, weather)
    climate = build_climate_alerts(weather, farmer.district)
    y = estimate_yield(field.crop, field.variety, field.area_ha, events)
    hint = market_svc.market_hint(farmer.district)

    latest_diag = next((e for e in events if e.type == "diagnosis"), None)

    advice_event = EventOut(
        id="dashboard-advice",
        field_id=field_id,
        type="advice",
        payload=advice,
        created_at=None,
    )

    return DashboardOut(
        farmer=FarmerOut.model_validate(farmer),
        field=FieldOut.model_validate(field),
        advice=AdviceOut(**advice, event=advice_event),
        climate=ClimateOut(
            alerts=[ClimateAlert(**a) for a in climate["alerts"]],
            variety_hint_bn=climate["variety_hint_bn"],
            weather_source=climate["weather_source"],
            events=[],
        ),
        yield_estimate=YieldOut(**y),
        market=MarketHintOut(
            action=hint["action"],
            reason_bn=hint["reason_bn"],
            prices=[PriceRow(**p) for p in hint["prices"]],
            source=hint["source"],
        ),
        latest_diagnosis=EventOut.model_validate(latest_diag) if latest_diag else None,
        events=[EventOut.model_validate(e) for e in events[:20]],
    )

