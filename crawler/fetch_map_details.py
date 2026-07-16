"""메이플랜드 레퍼런스 맵의 상세 데이터(스폰 위치·발판·로프·미니맵) 수집

maplestory.io GMS v92 /map/{id} JSON에서 맵 구조도를 그리는 데 필요한 데이터만
추려서 map_details 테이블에 저장한다. 기존 maps 테이블은 건드리지 않는다.

사용법:
    python3 crawler/fetch_map_details.py            # 미수집분만
    python3 crawler/fetch_map_details.py --force    # 전체 재수집
"""
from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "maple.db"
REFERENCE_PATH = ROOT / "data" / "mapleland_reference.json"
API_BASE = "https://maplestory.io/api/gms/92/map"
CONCURRENCY = 4
RETRIES = 3

SCHEMA = """
CREATE TABLE IF NOT EXISTS map_details (
    map_id INTEGER PRIMARY KEY,
    spawns_json TEXT,      -- [[mob_id, x, y], ...]
    npcs_json TEXT,        -- [[npc_id, x, y], ...]
    footholds_json TEXT,   -- [[x1, y1, x2, y2], ...]
    ropes_json TEXT,       -- [[x, y1, y2, is_ladder], ...]
    minimap_json TEXT,     -- {canvas(base64 png), width, height, centerX, centerY, magnification}
    vr_json TEXT,          -- [x, y, width, height]
    bgm TEXT,
    is_swim INTEGER DEFAULT 0,
    crawled_at TEXT
);
"""


def reference_map_ids() -> list[int]:
    ref = json.loads(REFERENCE_PATH.read_text(encoding="utf-8"))
    records = ref.get("entities", {}).get("maps", {}).get("records", [])
    return sorted({int(r["id"]) for r in records if str(r.get("id", "")).isdigit()})


def extract(data: dict) -> dict:
    spawns = []
    for m in data.get("mobs") or []:
        if not isinstance(m, dict) or m.get("id") is None:
            continue
        if m.get("hidden"):
            continue
        spawns.append([m["id"], m.get("x", 0), m.get("y", 0)])

    npcs = []
    for n in data.get("npcs") or []:
        if not isinstance(n, dict) or n.get("id") is None:
            continue
        npcs.append([n["id"], n.get("x", 0), n.get("y", 0)])

    fh_raw = data.get("footholds") or {}
    if isinstance(fh_raw, dict):
        fh_raw = fh_raw.values()
    footholds = [
        [f["x1"], f["y1"], f["x2"], f["y2"]]
        for f in fh_raw
        if isinstance(f, dict) and all(k in f for k in ("x1", "y1", "x2", "y2"))
    ]

    ropes = [
        [r["x"], r["y1"], r["y2"], 1 if r.get("isLadder") else 0]
        for r in data.get("ladderRopes") or []
        if isinstance(r, dict) and all(k in r for k in ("x", "y1", "y2"))
    ]

    mm = data.get("miniMap") or None
    minimap = None
    if mm and mm.get("canvas"):
        minimap = {
            "canvas": mm["canvas"],
            "width": mm.get("width"),
            "height": mm.get("height"),
            "centerX": mm.get("centerX"),
            "centerY": mm.get("centerY"),
            "magnification": mm.get("magnification"),
        }

    vr = data.get("vrBounds") or {}
    vr_out = [vr.get("x", 0), vr.get("y", 0), vr.get("width", 0), vr.get("height", 0)] if vr else None

    return {
        "spawns_json": json.dumps(spawns, separators=(",", ":")),
        "npcs_json": json.dumps(npcs, separators=(",", ":")),
        "footholds_json": json.dumps(footholds, separators=(",", ":")),
        "ropes_json": json.dumps(ropes, separators=(",", ":")),
        "minimap_json": json.dumps(minimap, separators=(",", ":")) if minimap else None,
        "vr_json": json.dumps(vr_out, separators=(",", ":")) if vr_out else None,
        "bgm": data.get("backgroundMusic"),
        "is_swim": 1 if data.get("isSwim") else 0,
    }


async def fetch_one(client: httpx.AsyncClient, sem: asyncio.Semaphore, map_id: int) -> tuple[int, dict | None]:
    async with sem:
        for attempt in range(RETRIES):
            try:
                res = await client.get(f"{API_BASE}/{map_id}")
                if res.status_code == 404:
                    return map_id, None
                res.raise_for_status()
                return map_id, extract(res.json())
            except Exception as e:
                if attempt == RETRIES - 1:
                    print(f"  ! {map_id} 실패: {e}", flush=True)
                    return map_id, None
                await asyncio.sleep(1.5 * (attempt + 1))
    return map_id, None


async def main() -> None:
    import sqlite3

    force = "--force" in sys.argv
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)

    ids = reference_map_ids()
    if not force:
        done = {r[0] for r in conn.execute("SELECT map_id FROM map_details WHERE spawns_json IS NOT NULL")}
        ids = [i for i in ids if i not in done]
    print(f"수집 대상: {len(ids)}개 맵", flush=True)

    sem = asyncio.Semaphore(CONCURRENCY)
    ok = missing = 0
    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "MapleDataCollector/1.0 (educational project)"}) as client:
        tasks = [fetch_one(client, sem, i) for i in ids]
        for n, coro in enumerate(asyncio.as_completed(tasks), 1):
            map_id, row = await coro
            if row is None:
                missing += 1
            else:
                ok += 1
                conn.execute(
                    """INSERT INTO map_details
                       (map_id, spawns_json, npcs_json, footholds_json, ropes_json,
                        minimap_json, vr_json, bgm, is_swim, crawled_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?)
                       ON CONFLICT(map_id) DO UPDATE SET
                        spawns_json=excluded.spawns_json, npcs_json=excluded.npcs_json,
                        footholds_json=excluded.footholds_json, ropes_json=excluded.ropes_json,
                        minimap_json=excluded.minimap_json, vr_json=excluded.vr_json,
                        bgm=excluded.bgm, is_swim=excluded.is_swim, crawled_at=excluded.crawled_at""",
                    (
                        map_id, row["spawns_json"], row["npcs_json"], row["footholds_json"],
                        row["ropes_json"], row["minimap_json"], row["vr_json"], row["bgm"],
                        row["is_swim"], datetime.now(timezone.utc).isoformat(),
                    ),
                )
            if n % 50 == 0:
                conn.commit()
                print(f"  {n}/{len(ids)} (성공 {ok} · 실패/없음 {missing})", flush=True)
    conn.commit()
    conn.close()
    print(f"완료: 성공 {ok} · 실패/없음 {missing}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
