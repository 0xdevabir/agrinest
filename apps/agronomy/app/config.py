import os
from pathlib import Path

def default_data_dir() -> Path:
    here = Path(__file__).resolve()
    if len(here.parents) > 3:
        bundled = here.parents[3] / "apps" / "api" / "data"
        if bundled.is_dir():
            return bundled
    return Path("/data")


DATA_DIR = Path(os.environ.get("AGRISATHI_DATA_DIR", default_data_dir()))
OPEN_METEO = os.environ.get("AGRISATHI_OPEN_METEO_BASE", "https://api.open-meteo.com/v1/forecast")
USE_SEED_WEATHER = os.environ.get("AGRISATHI_USE_SEED_WEATHER", "false") == "true"

