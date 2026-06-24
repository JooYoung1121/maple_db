"""maplestory.io GMS/62 맵 life 데이터로 맵별 몹 젠 수를 mob_spawns 에 보강.

- 안전: 기존 행을 삭제/덮어쓰지 않음. spawn_count UPDATE + (몹 존재 시) 누락 쌍만 INSERT.
- 출처: https://maplestory.io/api/GMS/62/map/{id} 의 mobs 배열 (= 스폰 지점 목록). mapledb와 동일 소스.
"""
from __future__ import annotations
import json
import sqlite3
import time
import urllib.request
from collections import Counter
from pathlib import Path

DB = Path(__file__).resolve().parent.parent / "data" / "maple.db"
API = "https://maplestory.io/api/GMS/62/map/{}"
SLEEP = 0.4  # 초당 ~2.5요청


def fetch_map(map_id: int) -> dict | None:
    url = API.format(map_id)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 maple_db"})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception:
        return None


def main() -> None:
    conn = sqlite3.connect(str(DB))
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("ALTER TABLE mob_spawns ADD COLUMN spawn_count INTEGER")
    except Exception:
        pass

    known_mobs = {r[0] for r in conn.execute("SELECT id FROM mobs").fetchall()}
    maps = conn.execute(
        "SELECT DISTINCT map_id, map_name FROM mob_spawns WHERE map_id IS NOT NULL"
    ).fetchall()
    total = len(maps)
    print(f"[spawn-count] 대상 맵 {total}개 크롤 시작 (GMS/62)")

    updated = inserted = empty = err = 0
    for i, row in enumerate(maps, 1):
        mid, mname = row["map_id"], row["map_name"]
        data = fetch_map(mid)
        if data is None:
            err += 1
        else:
            counts = Counter(m["id"] for m in (data.get("mobs") or []) if m.get("id"))
            mob_rate = data.get("mobRate")
            if not counts:
                empty += 1
            for mob_id, cnt in counts.items():
                exists = conn.execute(
                    "SELECT 1 FROM mob_spawns WHERE mob_id=? AND map_id=?", (mob_id, mid)
                ).fetchone()
                if exists:
                    conn.execute(
                        "UPDATE mob_spawns SET spawn_count=? WHERE mob_id=? AND map_id=?",
                        (cnt, mob_id, mid),
                    )
                    updated += 1
                elif mob_id in known_mobs:
                    conn.execute(
                        "INSERT INTO mob_spawns (mob_id, map_id, map_name, spawn_count) VALUES (?,?,?,?)",
                        (mob_id, mid, mname, cnt),
                    )
                    inserted += 1
            # maps.mob_rate 보강 (있을 때만, 덮어쓰기 허용 — 수치 갱신)
            if mob_rate is not None:
                try:
                    conn.execute("UPDATE maps SET mob_rate=? WHERE id=?", (round(mob_rate, 3), mid))
                except Exception:
                    pass
        if i % 50 == 0 or i == total:
            conn.commit()
            print(f"[spawn-count] {i}/{total} (update {updated}, insert {inserted}, empty {empty}, err {err})")
        time.sleep(SLEEP)

    conn.commit()
    # 검증 요약
    filled = conn.execute("SELECT COUNT(*) FROM mob_spawns WHERE spawn_count IS NOT NULL").fetchone()[0]
    tot = conn.execute("SELECT COUNT(*) FROM mob_spawns").fetchone()[0]
    print(f"[spawn-count] 완료: spawn_count 채워진 행 {filled}/{tot} (신규 {inserted})")
    conn.close()


if __name__ == "__main__":
    main()
