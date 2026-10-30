from datetime import date

from fastapi import FastAPI
from pydantic import BaseModel, Field

from app.advice import build_advice
from app.climate import build_climate_alerts
from app.weather import get_weather
from app.workbench import build_desk
from app.yield_engine import estimate_yield

app = FastAPI(title="AgriSathi Agronomy", version="0.1.0")


class FieldContext(BaseModel):
    crop: str = "rice"
    sowing_date: date
    lat: float = 25.7439
    lon: float = 89.2752
    district: str = "রংপুর"
    force_seed_weather: bool = False


class YieldIn(BaseModel):
    crop: str = "rice"
    variety: str = "BRRI dhan28"
    area_ha: float = 0.8
    events: list[dict] = Field(default_factory=list)


class DeskIn(FieldContext):
    variety: str = "BRRI dhan28"
    area_ha: float = 0.8
    events: list[dict] = Field(default_factory=list)


@app.get("/health")
def health():
    return {"status": "ok", "service": "agronomy"}


@app.post("/advice")
async def advice(body: FieldContext):
    weather = await get_weather(body.lat, body.lon, body.force_seed_weather)
    result = build_advice(body.crop, body.sowing_date, weather)
    result["service"] = "agronomy"
    return result


@app.post("/climate")
async def climate(body: FieldContext):
    weather = await get_weather(body.lat, body.lon, body.force_seed_weather)
    result = build_climate_alerts(weather, body.district)
    result["service"] = "agronomy"
    return result


@app.post("/yield")
def yield_estimate(body: YieldIn):
    result = estimate_yield(body.crop, body.variety, body.area_ha, body.events)
    result["service"] = "agronomy"
    return result


@app.post("/desk")
async def desk(body: DeskIn):
    weather = await get_weather(body.lat, body.lon, body.force_seed_weather)
    return build_desk(body.crop, body.variety, body.area_ha, body.sowing_date, body.district, weather, body.events)
