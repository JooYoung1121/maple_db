"""mapledb.kr 퀘스트 전체 크롤 → mapledb_quests 테이블

메이플랜드 2.0 퀘스트 로드맵의 데이터 소스. 기존 quests 테이블(수기 큐레이션 419건)은
건드리지 않고 별도 테이블에 저장한다 — 로드맵 API가 두 테이블을 이름으로 조인한다.
(기존 mapledb 몹/맵 파서와 완전 분리된 신규 파서 — 훼손 이력과 무관)

사용법:
    .venv/bin/python crawler/fetch_mapledb_quests.py            # 미수집분만
    .venv/bin/python crawler/fetch_mapledb_quests.py --force    # 전체 재수집
"""
from __future__ import annotations

import asyncio
import json
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "maple.db"
BASE = "https://mapledb.kr"
UA = {"User-Agent": "Mozilla/5.0 (compatible; maple-db-quest-sync/1.0)"}
CONCURRENCY = 4
RETRIES = 3

SCHEMA = """
CREATE TABLE IF NOT EXISTS mapledb_quests (
    quest_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    repeatable INTEGER DEFAULT 0,
    min_level INTEGER DEFAULT 0,
    max_level INTEGER,
    req_meso INTEGER DEFAULT 0,
    jobs TEXT,
    start_npc_id INTEGER, start_npc TEXT,
    end_npc_id INTEGER, end_npc TEXT,
    exp INTEGER DEFAULT 0,
    meso INTEGER DEFAULT 0,
    fame INTEGER DEFAULT 0,
    prereq_json TEXT,        -- [[quest_id|null, 이름], ...] 체인상 이전 퀘스트
    next_json TEXT,          -- [[quest_id|null, 이름], ...] '다음 ->' 이후
    requirements_json TEXT,  -- [{type,id,name,raw}] 완료 조건 (아이템/몹 등)
    rewards_json TEXT,       -- [{type,id,name,raw}] 보상 아이템
    crawled_at TEXT
);
"""

LINK_RE = re.compile(r"search\.php\?q=(\d+)&t=(\w+)")
NUM_RE = re.compile(r"-?[\d,]+")


def _num(text: str) -> int:
    m = NUM_RE.search(text or "")
    return int(m.group(0).replace(",", "")) if m else 0


def _link_of(el) -> tuple[int | None, str | None]:
    """박스 자신/조상/자손의 search.php 링크에서 (id, type) 추출."""
    for a in [el] + list(el.parents)[:2] + el.select("a[href*='search.php']"):
        href = a.get("href") if a and a.name == "a" else None
        if href:
            m = LINK_RE.search(href)
            if m:
                return int(m.group(1)), m.group(2)
    return None, None


def parse_quest(quest_id: int, raw: str) -> dict | None:
    soup = BeautifulSoup(raw, "html.parser")
    if not soup.title:
        return None
    name = soup.title.get_text().split("|")[0].strip()
    if not name or "데이터베이스" in name and "|" not in soup.title.get_text():
        return None

    out: dict = {
        "quest_id": quest_id, "name": name, "repeatable": 0,
        "min_level": 0, "max_level": None, "req_meso": 0, "jobs": None,
        "start_npc_id": None, "start_npc": None, "end_npc_id": None, "end_npc": None,
        "exp": 0, "meso": 0, "fame": 0,
        "prereq": [], "next": [], "requirements": [], "rewards": [],
    }

    # 정보 박스 (라벨 값)
    for el in soup.select(".search-page-info-content-box-detail, .search-page-info-content-box-default"):
        t = " ".join(el.get_text(" ", strip=True).split())
        if t.startswith("시작 최소 레벨"):
            out["min_level"] = _num(t)
        elif t.startswith("시작 최대 레벨"):
            out["max_level"] = _num(t) if "없음" not in t else None
        elif t.startswith("시작 필요 메소"):
            out["req_meso"] = _num(t)
        elif t.startswith("시작 가능 직업"):
            out["jobs"] = t.replace("시작 가능 직업", "").strip()
        elif t.startswith("시작 NPC"):
            out["start_npc"] = t.replace("시작 NPC", "").strip()
            nid, _ = _link_of(el)
            out["start_npc_id"] = nid
        elif t.startswith("종료 NPC"):
            out["end_npc"] = t.replace("종료 NPC", "").strip()
            nid, _ = _link_of(el)
            out["end_npc_id"] = nid
        elif t.startswith("메소"):
            out["meso"] = _num(t)
        elif t.startswith("경험치"):
            out["exp"] = _num(t)
        elif t.startswith("인기도"):
            out["fame"] = _num(t)
        elif "반복" in t:
            out["repeatable"] = 1
        elif t == "1회성":
            out["repeatable"] = 0

    # 섹션(제목 → 뒤따르는 박스들) 순회
    section = None
    seen_self = False
    for el in soup.select(".search-page-add-content-title, .search-page-add-content-box"):
        if "search-page-add-content-title" in el.get("class", []):
            section = el.get_text(strip=True)
            seen_self = False
            continue
        title_el = el.select_one(".search-page-add-content-box-main-title")
        btitle = title_el.get_text(strip=True) if title_el else el.get_text(" ", strip=True)[:60]
        bid, btype = _link_of(el)
        raw_text = " ".join(el.get_text(" ", strip=True).split())[:120]

        if section == "퀘스트 순서":
            marker = btitle.replace(" ", "")
            if marker in ("다음->", "->다음") or "다음" == marker:
                seen_self = True  # '다음 ->' 마커
                continue
            if marker in ("<-이전", "이전<-", "이전"):
                continue  # '<- 이전' 마커는 무시
            if btitle == name and btype != "quest" and bid is None:
                seen_self = True
                continue
            entry = [bid if btype == "quest" else None, btitle]
            if btitle == name:
                seen_self = True
            elif seen_self:
                out["next"].append(entry)
            else:
                out["prereq"].append(entry)
        elif section == "완료 조건":
            out["requirements"].append({"type": btype, "id": bid, "name": btitle, "raw": raw_text})
        elif section == "보상":
            # 메소/경험치/인기도 박스는 정보 파트에서 이미 파싱 — 아이템 보상만 수집
            if btype == "item":
                out["rewards"].append({"type": btype, "id": bid, "name": btitle, "raw": raw_text})
    return out


async def fetch_one(client: httpx.AsyncClient, sem: asyncio.Semaphore, qid: int):
    async with sem:
        for attempt in range(RETRIES):
            try:
                res = await client.get(f"{BASE}/search.php?q={qid}&t=quest")
                res.raise_for_status()
                return qid, parse_quest(qid, res.text)
            except Exception as e:
                if attempt == RETRIES - 1:
                    print(f"  ! {qid} 실패: {e}", flush=True)
                    return qid, None
                await asyncio.sleep(1.2 * (attempt + 1))
    return qid, None


async def main() -> None:
    force = "--force" in sys.argv
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)

    async with httpx.AsyncClient(timeout=25, headers=UA) as client:
        res = await client.get(f"{BASE}/quest.php")
        ids = sorted({int(m) for m in re.findall(r"[?&]q=(\d+)&t=quest", res.text)})
        print(f"목록: {len(ids)}개 퀘스트", flush=True)
        if not force:
            done = {r[0] for r in conn.execute("SELECT quest_id FROM mapledb_quests")}
            ids = [i for i in ids if i not in done]
        print(f"수집 대상: {len(ids)}개", flush=True)

        sem = asyncio.Semaphore(CONCURRENCY)
        ok = fail = 0
        tasks = [fetch_one(client, sem, i) for i in ids]
        for n, coro in enumerate(asyncio.as_completed(tasks), 1):
            qid, q = await coro
            if q is None:
                fail += 1
            else:
                ok += 1
                conn.execute(
                    """INSERT INTO mapledb_quests
                       (quest_id,name,repeatable,min_level,max_level,req_meso,jobs,
                        start_npc_id,start_npc,end_npc_id,end_npc,exp,meso,fame,
                        prereq_json,next_json,requirements_json,rewards_json,crawled_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                       ON CONFLICT(quest_id) DO UPDATE SET
                        name=excluded.name, repeatable=excluded.repeatable,
                        min_level=excluded.min_level, max_level=excluded.max_level,
                        req_meso=excluded.req_meso, jobs=excluded.jobs,
                        start_npc_id=excluded.start_npc_id, start_npc=excluded.start_npc,
                        end_npc_id=excluded.end_npc_id, end_npc=excluded.end_npc,
                        exp=excluded.exp, meso=excluded.meso, fame=excluded.fame,
                        prereq_json=excluded.prereq_json, next_json=excluded.next_json,
                        requirements_json=excluded.requirements_json, rewards_json=excluded.rewards_json,
                        crawled_at=excluded.crawled_at""",
                    (
                        q["quest_id"], q["name"], q["repeatable"], q["min_level"], q["max_level"],
                        q["req_meso"], q["jobs"], q["start_npc_id"], q["start_npc"],
                        q["end_npc_id"], q["end_npc"], q["exp"], q["meso"], q["fame"],
                        json.dumps(q["prereq"], ensure_ascii=False),
                        json.dumps(q["next"], ensure_ascii=False),
                        json.dumps(q["requirements"], ensure_ascii=False),
                        json.dumps(q["rewards"], ensure_ascii=False),
                        datetime.now(timezone.utc).isoformat(),
                    ),
                )
            if n % 50 == 0:
                conn.commit()
                print(f"  {n}/{len(ids)} (성공 {ok} · 실패 {fail})", flush=True)
    conn.commit()
    conn.close()
    print(f"완료: 성공 {ok} · 실패 {fail}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
