from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Event, Field
from app.schemas import AdviceOut, EventOut
from app.services.advice import build_advice
from app.services.weather import get_weather

router = APIRouter(tags=["precision-farm"])


@router.get("/fields/{field_id}/advice/today", response_model=AdviceOut)
async def advice_today(
    field_id: str,
    force_seed_weather: bool = Query(False),
    persist: bool = Query(True),
    db: AsyncSession = Depends(get_db),
):
    field = await db.get(Field, field_id)
    if not field:
        raise HTTPException(404, "জমি পাওয়া যায়নি")

    weather = await get_weather(field.lat, field.lon, force_seed=force_seed_weather)
    advice = build_advice(field.crop, field.sowing_date, weather)

    event = Event(field_id=field_id, type="advice", payload=advice)
    if persist:
        db.add(event)
        await db.commit()
        await db.refresh(event)

    return AdviceOut(**advice, event=EventOut.model_validate(event))
