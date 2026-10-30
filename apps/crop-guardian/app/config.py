import os
from pathlib import Path

def default_data_dir() -> Path:
    here = Path(__file__).resolve()
    # Repo layout is <root>/apps/<service>/app/config.py. A container copy is shallower.
    if len(here.parents) > 3:
        bundled = here.parents[3] / "apps" / "api" / "data"
        if bundled.is_dir():
            return bundled
    return Path("/data")


DATA_DIR = Path(os.environ.get("AGRISATHI_DATA_DIR", default_data_dir()))
THRESHOLD = float(os.environ.get("AGRISATHI_DISEASE_CONF_THRESHOLD", "0.45"))
LLM_API_KEY = os.environ.get("AGRISATHI_LLM_API_KEY", "")
LLM_BASE = os.environ.get("AGRISATHI_LLM_BASE", "https://api.openai.com/v1")
LLM_MODEL = os.environ.get("AGRISATHI_LLM_MODEL", "gpt-4o-mini")

