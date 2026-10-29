from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Event, Farmer, Field, Listing

router = APIRouter(prefix="/seed", tags=["seed"])


@router.post("/rahim")
async def seed_rahim(db: AsyncSession = Depends(get_db)):
    """Idempotent demo seed: Rahim in Rangpur, 0.8 ha rice."""
    existing = await db.execute(select(Farmer).where(Farmer.name == "রহিম"))
    farmer = existing.scalar_one_or_none()
    if farmer:
        fields = await db.execute(select(Field).where(Field.farmer_id == farmer.id))
        field = fields.scalars().first()
        if field:
            return {
                "farmer_id": farmer.id,
                "field_id": field.id,
                "message": "already_seeded",
            }

    farmer = Farmer(name="রহিম", district="রংপুর", phone="01700000000", lang="bn")
    db.add(farmer)
    await db.flush()

    # ~40 DAS → tillering / interesting stage for advice
    sowing = date.today() - timedelta(days=40)
    field = Field(
        farmer_id=farmer.id,
        crop="rice",
        variety="BRRI dhan28",
        sowing_date=sowing,
        lat=25.7439,
        lon=89.2752,
        area_ha=0.8,
        location_label="রংপুর",
    )
    db.add(field)
    await db.commit()
    await db.refresh(farmer)
    await db.refresh(field)
    return {
        "farmer_id": farmer.id,
        "field_id": field.id,
        "message": "seeded",
        "persona": {
            "name_bn": "রহিম",
            "district": "রংপুর",
            "area_ha": 0.8,
            "crop": "rice",
            "sowing_date": str(sowing),
        },
    }


@router.post("/reset")
async def reset_demo(db: AsyncSession = Depends(get_db)):
    await db.execute(delete(Listing))
    await db.execute(delete(Event))
    await db.execute(delete(Field))
    await db.execute(delete(Farmer))
    await db.commit()
    return {"ok": True}
