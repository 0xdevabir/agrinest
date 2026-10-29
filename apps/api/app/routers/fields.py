from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Event, Farmer, Field
from app.schemas import EventCreate, EventOut, FieldCreate, FieldOut

router = APIRouter(prefix="/fields", tags=["fields"])


@router.post("", response_model=FieldOut)
async def create_field(body: FieldCreate, db: AsyncSession = Depends(get_db)):
    farmer = await db.get(Farmer, body.farmer_id)
    if not farmer:
        raise HTTPException(404, "কৃষক পাওয়া যায়নি")
    field = Field(**body.model_dump())
    db.add(field)
    await db.commit()
    await db.refresh(field)
    return field


@router.get("", response_model=list[FieldOut])
async def list_fields(farmer_id: str | None = None, db: AsyncSession = Depends(get_db)):
    q = select(Field)
    if farmer_id:
        q = q.where(Field.farmer_id == farmer_id)
    result = await db.execute(q)
    return list(result.scalars().all())


@router.get("/{field_id}", response_model=FieldOut)
async def get_field(field_id: str, db: AsyncSession = Depends(get_db)):
    field = await db.get(Field, field_id)
    if not field:
        raise HTTPException(404, "জমি পাওয়া যায়নি")
    return field


@router.get("/{field_id}/events", response_model=list[EventOut])
async def list_events(field_id: str, db: AsyncSession = Depends(get_db)):
    field = await db.get(Field, field_id)
    if not field:
        raise HTTPException(404, "জমি পাওয়া যায়নি")
    result = await db.execute(
        select(Event).where(Event.field_id == field_id).order_by(Event.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("/{field_id}/events", response_model=EventOut)
async def append_event(field_id: str, body: EventCreate, db: AsyncSession = Depends(get_db)):
    field = await db.get(Field, field_id)
    if not field:
        raise HTTPException(404, "জমি পাওয়া যায়নি")
    event = Event(field_id=field_id, type=body.type, payload=body.payload)
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event
