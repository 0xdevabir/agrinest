import json
from functools import lru_cache

from app.config import DATA_DIR


@lru_cache(maxsize=8)
def read_json(name: str):
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))
