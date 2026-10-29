from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models import Event, Farmer, Field, Listing
from app.services.weather import get_weather
from app.services.workbench import build_workbench

router = APIRouter(tags=["workbench"])


@router.get("/fields/{field_id}/workbench")
async def workbench(
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

    ev_result = await db.execute(select(Event).where(Event.field_id == field_id))
    events = list(ev_result.scalars().all())
    list_result = await db.execute(select(Listing).where(Listing.field_id == field_id))
    listings = list(list_result.scalars().all())
    weather = await get_weather(field.lat, field.lon, force_seed=force_seed_weather)
    return build_workbench(
        crop=field.crop,
        variety=field.variety,
        area_ha=field.area_ha,
        sowing_date=field.sowing_date,
        district=farmer.district,
        weather=weather,
        events=events,
        listings=listings,
    )
