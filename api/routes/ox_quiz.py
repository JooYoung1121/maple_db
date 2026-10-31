"""OX퀴즈 족보 검색 — 3주년 '추억의 이벤트' 토요일 21시 OX퀴즈 대비.

데이터는 data/ox_quiz.json (원작 빅뱅 이전 OX 이벤트 문제, 출처는 _meta.sources).
문제 일부만 입력해도 찾도록 공백·문장부호를 제거하고 모든 단어가 포함된 문항을 돌려준다.
"""
import json
import re
from pathlib import Path
from typing import Optional
from urllib.parse import quote_plus

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


# 'ox'/'오엑스'로 시작하는 메시지 — 'oxford'처럼 영문이 바로 이어지면 제외
OX_TRIGGER = re.compile(r"^\s*!?\s*(?:ox|오엑스)(?![a-z])\s*(?:퀴즈)?\s*(?:족보)?\s*[:：]?\s*", re.IGNORECASE)
_ASK_TAIL = re.compile(r"\s*(?:정답|답)?\s*(?:은|이)?\s*(?:뭐야|뭐임|뭔가요|알려줘)?\s*[?？!]*$")


def parse_ox_query(text: str) -> Optional[str]:
    """'!ox 왕도깨비', 'OX퀴즈 왕도깨비 정답 뭐야?' 같은 메시지면 검색어('' 가능)를, 아니면 None."""
    m = OX_TRIGGER.match(text)
    if not m:
        return None
    return _ASK_TAIL.sub("", text[m.end():]).strip()


def format_ox_reply(arg: str, site: str, *, markdown: bool = False, top: int = 3) -> str:
    """카톡봇·디스코드봇 공용 답장. markdown=True면 디스코드용 굵게 표시."""
    page = f"{site}/ox"
    if not arg:
        return f"⭕❌ OX퀴즈 족보 — 문제 일부를 같이 적어주세요! (예: !ox 왕도깨비)\n{page}"
    hits = search_ox(arg)
    if not hits:
        return f"'{arg}' 문제를 족보에서 못 찾았어요. 다른 단어로 검색해보세요.\n{page}"
    lines = []
    for it in hits[:top]:
        ans = f"**[{it['a']}]**" if markdown else f"[{it['a']}]"
        tag = " 🆕메랜 출제" if it.get("basis") == "observed" else ""
        line = f"{ans}{tag} {it['q']}"
        if it.get("ex"):
            line += f"\n  └ {it['ex']}"
        if it.get("alt"):
            line += f"\n  ⚠ {it['alt']['by']}: {it['alt']['a']} — {it['alt']['note']}"
        lines.append(line)
    more = f"\n…외 {len(hits) - top}건" if len(hits) > top else ""
    warn = "\n※ 메랜은 원작 족보와 다른 문제·정답도 나와요 (🆕 표시만 메랜 실제 출제 확인)"
    return "\n".join(lines) + more + warn + f"\n{page}?q={quote_plus(arg)}"


@router.get("/ox-quiz")
def ox_quiz(q: str = Query("", max_length=100), cat: Optional[str] = None):
    doc = load_ox()
    items = search_ox(q) if q.strip() else doc["items"]
    if cat in ("maple", "general"):
        items = [it for it in items if it["cat"] == cat]
    return {"meta": doc["_meta"], "total": len(items), "items": items}
