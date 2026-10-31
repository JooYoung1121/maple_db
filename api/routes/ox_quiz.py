"""OX퀴즈 족보 검색 — 3주년 '추억의 이벤트' 토요일 21시 OX퀴즈 대비.

데이터는 data/ox_quiz.json (원작 빅뱅 이전 OX 이벤트 문제, 출처는 _meta.sources).
문제 일부만 입력해도 찾도록 공백·문장부호를 제거하고 모든 단어가 포함된 문항을 돌려준다.
"""
import json
import re
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Query

router = APIRouter()

DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "ox_quiz.json"
_cache: dict[str, object] = {"mtime": None, "doc": None}


def load_ox() -> dict:
    mtime = DATA_PATH.stat().st_mtime
    if _cache["mtime"] != mtime:
        _cache["doc"] = json.loads(DATA_PATH.read_text(encoding="utf-8"))
        _cache["mtime"] = mtime
    return _cache["doc"]  # type: ignore[return-value]


def _norm(s: str) -> str:
    return re.sub(r"[^0-9A-Za-z가-힣ㄱ-ㅎ]", "", s).lower()


def search_ox(q: str, limit: Optional[int] = None) -> list[dict]:
    """공백으로 나눈 모든 단어가 문제(또는 해설)에 들어 있는 문항. 문제 본문 일치를 먼저."""
    items = load_ox()["items"]
    words = [_norm(w) for w in q.split() if _norm(w)]
    if not words:
        return []
    in_q, in_ex = [], []
    for it in items:
        nq = _norm(it["q"])
        if all(w in nq for w in words):
            in_q.append(it)
        elif all(w in nq + _norm(it.get("ex", "")) for w in words):
            in_ex.append(it)
    hits = in_q + in_ex
    return hits[:limit] if limit else hits


@router.get("/ox-quiz")
def ox_quiz(q: str = Query("", max_length=100), cat: Optional[str] = None):
    doc = load_ox()
    items = search_ox(q) if q.strip() else doc["items"]
    if cat in ("maple", "general"):
        items = [it for it in items if it["cat"] == cat]
    return {"meta": doc["_meta"], "total": len(items), "items": items}
