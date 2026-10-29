from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Event, Field
from app.schemas import YieldOut
from app.services.yield_engine import estimate_yield

router = APIRouter(tags=["yieldmax"])


@router.get("/fields/{field_id}/yield", response_model=YieldOut)
async def field_yield(field_id: str, db: AsyncSession = Depends(get_db)):
    field = await db.get(Field, field_id)
    if not field:
        raise HTTPException(404, "জমি পাওয়া যায়নি")
    result = await db.execute(select(Event).where(Event.field_id == field_id))
    events = list(result.scalars().all())
    return YieldOut(**estimate_yield(field.crop, field.variety, field.area_ha, events))
