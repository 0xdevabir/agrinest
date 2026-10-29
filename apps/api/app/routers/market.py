from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models import Event, Farmer, Field, Listing
from app.schemas import ListingCreate, ListingOut, MarketHintOut, PriceRow
from app.services import market as market_svc
from app.services.yield_engine import estimate_yield

router = APIRouter(tags=["farmmarket"])


@router.get("/markets/prices")
async def market_prices(district: str = "রংপুর"):
    prices, source = market_svc.prices_for_district(district)
    return {"prices": prices, "source": source}


@router.get("/fields/{field_id}/market-hint", response_model=MarketHintOut)
async def market_hint(field_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Field).where(Field.id == field_id).options(selectinload(Field.farmer))
    )
    field = result.scalar_one_or_none()
    if not field:
        raise HTTPException(404, "জমি পাওয়া যায়নি")
    farmer = field.farmer or await db.get(Farmer, field.farmer_id)
    district = farmer.district if farmer else "রংপুর"
    hint = market_svc.market_hint(district)
    return MarketHintOut(
        action=hint["action"],
        reason_bn=hint["reason_bn"],
        prices=[PriceRow(**p) for p in hint["prices"]],
        source=hint["source"],
    )


@router.post("/fields/{field_id}/listings", response_model=ListingOut)
async def create_listing(field_id: str, body: ListingCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Field).where(Field.id == field_id).options(selectinload(Field.farmer))
    )
    field = result.scalar_one_or_none()
    if not field:
        raise HTTPException(404, "জমি পাওয়া যায়নি")

    ev_result = await db.execute(select(Event).where(Event.field_id == field_id))
    events = list(ev_result.scalars().all())
    y = estimate_yield(field.crop, field.variety, field.area_ha, events)
    if body.quantity_ton > y["mid"] + 1e-6:
        raise HTTPException(
            400,
            f"পরিমাণ বেশি—আনুমানিক ফলন {y['mid']:.2f} টন পর্যন্ত তালিকাভুক্ত করতে পারবেন",
        )

    farmer = field.farmer or await db.get(Farmer, field.farmer_id)
    listing = Listing(
        field_id=field_id,
        crop=field.crop,
        quantity_ton=body.quantity_ton,
        price_hint_bdt=body.price_hint_bdt,
        district=farmer.district if farmer else "",
        notes=body.notes,
    )
    db.add(listing)
    sale = Event(
        field_id=field_id,
        type="sale",
        payload={
            "quantity_ton": body.quantity_ton,
            "price_hint_bdt": body.price_hint_bdt,
            "notes": body.notes,
        },
    )
    db.add(sale)
    await db.commit()
    await db.refresh(listing)
    return listing


@router.get("/listings", response_model=list[ListingOut])
async def list_listings(district: str | None = None, db: AsyncSession = Depends(get_db)):
    q = select(Listing).order_by(Listing.created_at.desc())
    if district:
        q = q.where(Listing.district == district)
    result = await db.execute(q)
    return list(result.scalars().all())
