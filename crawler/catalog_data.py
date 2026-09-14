"""Small, sourced catalog supplements shared by ingestion and the public API."""
import json
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


@lru_cache(maxsize=1)
def equipment_notes() -> dict:
    return json.loads((DATA_DIR / "equipment_notes.json").read_text(encoding="utf-8"))["items"]
