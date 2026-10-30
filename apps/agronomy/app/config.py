import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = Path(os.environ.get("AGRISATHI_DATA_DIR", ROOT / "apps" / "api" / "data"))
OPEN_METEO = os.environ.get("AGRISATHI_OPEN_METEO_BASE", "https://api.open-meteo.com/v1/forecast")
USE_SEED_WEATHER = os.environ.get("AGRISATHI_USE_SEED_WEATHER", "false") == "true"
