from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import init_db
from app.routers import advice, climate, dashboard, diagnose, farmers, fields, market, seed, yield_route


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="AgriSathi API",
    description="Unified AI Farming Platform — Bangla-first hackathon API",
    version="0.1.0",
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(farmers.router, prefix="/api")
app.include_router(fields.router, prefix="/api")
app.include_router(diagnose.router, prefix="/api")
app.include_router(advice.router, prefix="/api")
app.include_router(climate.router, prefix="/api")
app.include_router(yield_route.router, prefix="/api")
app.include_router(market.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(seed.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "product": "AgriSathi"}
