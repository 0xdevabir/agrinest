from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Farmer
from app.schemas import FarmerCreate, FarmerOut

router = APIRouter(prefix="/farmers", tags=["farmers"])


@router.post("", response_model=FarmerOut)
async def create_farmer(body: FarmerCreate, db: AsyncSession = Depends(get_db)):
    farmer = Farmer(**body.model_dump())
    db.add(farmer)
    await db.commit()
    await db.refresh(farmer)
    return farmer


@router.get("", response_model=list[FarmerOut])
async def list_farmers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Farmer).order_by(Farmer.created_at.desc()))
    return list(result.scalars().all())


@router.get("/{farmer_id}", response_model=FarmerOut)
async def get_farmer(farmer_id: str, db: AsyncSession = Depends(get_db)):
    farmer = await db.get(Farmer, farmer_id)
    if not farmer:
        raise HTTPException(404, "কৃষক পাওয়া যায়নি")
    return farmer
