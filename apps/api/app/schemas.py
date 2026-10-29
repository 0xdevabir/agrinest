from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

EventType = Literal[
    "diagnosis",
    "advice",
    "weather_alert",
    "treatment_logged",
    "sale",
]


class FarmerCreate(BaseModel):
    name: str
    district: str
    phone: str | None = None
    lang: str = "bn"


class FarmerOut(BaseModel):
    id: str
    name: str
    district: str
    phone: str | None
    lang: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class FieldCreate(BaseModel):
    farmer_id: str
    crop: str = "rice"
    variety: str = "BRRI dhan28"
    sowing_date: date
    lat: float = 25.7439
    lon: float = 89.2752
    area_ha: float = 0.8
    location_label: str | None = "রংপুর"


class FieldOut(BaseModel):
    id: str
    farmer_id: str
    crop: str
    variety: str
    sowing_date: date
    lat: float
    lon: float
    area_ha: float
    location_label: str | None

    model_config = {"from_attributes": True}


class EventCreate(BaseModel):
    type: EventType
    payload: dict[str, Any] = Field(default_factory=dict)


class EventOut(BaseModel):
    id: str
    field_id: str
    type: str
    payload: dict[str, Any]
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class DiagnoseResult(BaseModel):
    disease_id: str
    name_bn: str
    name_en: str
    confidence: float
    source: str
    steps_bn: list[str]
    chemical_note_bn: str
    event: EventOut


class AdviceOut(BaseModel):
    stage: str
    stage_bn: str
    irrigate: bool
    irrigate_bn: str
    fertilizer_bn: str | None
    summary_bn: str
    weather_source: str
    event: EventOut


class ClimateAlert(BaseModel):
    risk_id: str
    title_bn: str
    action_bn: str
    severity: str


class ClimateOut(BaseModel):
    alerts: list[ClimateAlert]
    variety_hint_bn: str | None
    weather_source: str
    events: list[EventOut]


class YieldOut(BaseModel):
    low: float
    mid: float
    high: float
    unit: str = "ton"
    baseline: float
    drivers: list[str]


class PriceRow(BaseModel):
    market: str
    crop: str
    unit: str
    price_bdt: float
    date: str


class MarketHintOut(BaseModel):
    action: Literal["wait", "sell"]
    reason_bn: str
    prices: list[PriceRow]
    source: str


class ListingCreate(BaseModel):
    quantity_ton: float
    price_hint_bdt: float | None = None
    notes: str | None = None


class ListingOut(BaseModel):
    id: str
    field_id: str
    crop: str
    quantity_ton: float
    price_hint_bdt: float | None
    district: str
    notes: str | None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class DashboardOut(BaseModel):
    farmer: FarmerOut
    field: FieldOut
    advice: AdviceOut | None = None
    climate: ClimateOut | None = None
    yield_estimate: YieldOut | None = None
    market: MarketHintOut | None = None
    latest_diagnosis: EventOut | None = None
    events: list[EventOut] = []
