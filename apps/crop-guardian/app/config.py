import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = Path(os.environ.get("AGRISATHI_DATA_DIR", ROOT / "apps" / "api" / "data"))
THRESHOLD = float(os.environ.get("AGRISATHI_DISEASE_CONF_THRESHOLD", "0.45"))
LLM_API_KEY = os.environ.get("AGRISATHI_LLM_API_KEY", "")
LLM_BASE = os.environ.get("AGRISATHI_LLM_BASE", "https://api.openai.com/v1")
LLM_MODEL = os.environ.get("AGRISATHI_LLM_MODEL", "gpt-4o-mini")
