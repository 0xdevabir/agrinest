from pathlib import Path
from pydantic_settings import BaseSettings

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


class Settings(BaseSettings):
    database_url: str = f"sqlite+aiosqlite:///{ROOT / 'agrisathi.db'}"
    photos_dir: Path = ROOT / "uploads" / "leaf-photos"
    data_dir: Path = DATA
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    open_meteo_base: str = "https://api.open-meteo.com/v1/forecast"
    use_seed_weather: bool = False
    use_seed_prices: bool = True
    disease_conf_threshold: float = 0.45

    class Config:
        env_prefix = "AGRISATHI_"


settings = Settings()
settings.photos_dir.mkdir(parents=True, exist_ok=True)
