import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class Farmer(Base):
    __tablename__ = "farmers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(120))
    district: Mapped[str] = mapped_column(String(80))
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    lang: Mapped[str] = mapped_column(String(8), default="bn")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    fields: Mapped[list["Field"]] = relationship(back_populates="farmer", cascade="all, delete-orphan")


class Field(Base):
    __tablename__ = "fields"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    farmer_id: Mapped[str] = mapped_column(ForeignKey("farmers.id", ondelete="CASCADE"))
    crop: Mapped[str] = mapped_column(String(40), default="rice")
    variety: Mapped[str] = mapped_column(String(80), default="BRRI dhan28")
    sowing_date: Mapped[date] = mapped_column(Date)
    lat: Mapped[float] = mapped_column(Float, default=25.7439)  # Rangpur
    lon: Mapped[float] = mapped_column(Float, default=89.2752)
    area_ha: Mapped[float] = mapped_column(Float, default=0.8)
    location_label: Mapped[str | None] = mapped_column(String(120), nullable=True)

    farmer: Mapped["Farmer"] = relationship(back_populates="fields")
    events: Mapped[list["Event"]] = relationship(back_populates="field", cascade="all, delete-orphan")
    listings: Mapped[list["Listing"]] = relationship(back_populates="field", cascade="all, delete-orphan")


class Event(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    field_id: Mapped[str] = mapped_column(ForeignKey("fields.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(40), index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    field: Mapped["Field"] = relationship(back_populates="events")


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    field_id: Mapped[str] = mapped_column(ForeignKey("fields.id", ondelete="CASCADE"), index=True)
    crop: Mapped[str] = mapped_column(String(40))
    quantity_ton: Mapped[float] = mapped_column(Float)
    price_hint_bdt: Mapped[float | None] = mapped_column(Float, nullable=True)
    district: Mapped[str] = mapped_column(String(80))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    field: Mapped["Field"] = relationship(back_populates="listings")
