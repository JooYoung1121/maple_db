"""메팁 「옛날 메이플 DB」 드롭 테이블 수집 → mob_drop_sources, mob_drops 보강 (v4.18.0).

출처: https://matip.kr/com/db/api.php?action=monster_list (2,251종) → action=monster_detail&id= (드롭 있는 664종)
      combined_drops[] = {item_id, chance, chance_denominator, minimum_quantity, maximum_quantity, drop_source, quest_id}
      분모는 행마다 다르다(1,000,000,000 primary / 1,000,000 legacy) — rate = chance / chance_denominator.

반영 규칙 (기존 확률값은 덮어쓰지 않는다):
  1. mob_drop_sources 에 전 행 보관 (source='matip').
  2. mob_drops 에 (몹, 아이템) 쌍이 없으면 추가 — drop_rate_source='matip', list_source='matip'.
  3. mob_drops 에 쌍은 있지만 확률도 목록 출처도 없는 행(drop_rate NULL, list_source NULL)만 matip 확률로 채운다.
     mapledb(2024 스냅샷)·maplekibun·community 확률과 official/community 목록 검증은 그대로 둔다 — 대조는 API 가
     mob_drop_sources 의 값을 matip_rate 로 함께 내려 화면에서 보여준다.
  몹·아이템은 우리 DB(mobs/items)에 있는 것만 넣는다(화이트리스트는 API 가 다시 거른다).

실행:
  uv run --python 3.11 --no-project python scripts/import_matip_drops.py [--cache DIR]
"""
from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from crawler.db import get_connection, init_db  # noqa: E402

API = "https://matip.kr/com/db/api.php"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh) memorymapledb-sync/1.0", "Accept": "application/json"}


def _get(params: dict, tries: int = 3) -> dict | None:
    url = API + "?" + urllib.parse.urlencode(params)
    err: Exception | None = None
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            err = e
            time.sleep(1.5 * (attempt + 1))
    print(f"  요청 실패 {params}: {err}", file=sys.stderr)
    return None


def fetch(cache: Path | None) -> dict[int, dict]:
    if cache and (cache / "details.json").exists():
        return {int(k): v for k, v in json.loads((cache / "details.json").read_text(encoding="utf-8")).items()}
    first = _get({"action": "monster_list", "q": "", "page": 1, "per_page": 100}) or {}
    pages = int((first.get("pagination") or {}).get("pages") or 0)
    mons = {m["id"]: m for m in first.get("monsters") or []}
    with concurrent.futures.ThreadPoolExecutor(6) as ex:
        for d in ex.map(lambda p: _get({"action": "monster_list", "q": "", "page": p, "per_page": 100}), range(2, pages + 1)):
            for m in (d or {}).get("monsters") or []:
                mons[m["id"]] = m
    targets = [m["id"] for m in mons.values() if (m.get("sql_drop_count") or 0) > 0 or (m.get("reward_count") or 0) > 0]
    print(f"matip 몬스터 {len(mons)}종 · 드롭 보유 {len(targets)}종 상세 수집…", file=sys.stderr)
    details: dict[int, dict] = {}
    with concurrent.futures.ThreadPoolExecutor(6) as ex:
        for mid, d in zip(targets, ex.map(lambda i: _get({"action": "monster_detail", "id": i}), targets)):
            if d and d.get("ok"):
                details[mid] = {"monster": {k: v for k, v in d["monster"].items() if k != "episode"},
                                "combined_drops": d.get("combined_drops") or []}
    if cache:
        cache.mkdir(parents=True, exist_ok=True)
        (cache / "details.json").write_text(json.dumps(details, ensure_ascii=False), encoding="utf-8")
    return details


def rows_from_details(details: dict[int, dict]) -> list[dict]:
    out = []
    for mid, d in details.items():
        for r in d.get("combined_drops") or []:
            iid = int(r.get("item_id") or 0)
            den = r.get("chance_denominator") or 0
            if not iid or not den:
                continue
            out.append({
                "mob_id": int(mid), "item_id": iid, "rate": float(r.get("chance") or 0) / float(den),
                "chance": r.get("chance"), "den": den, "min_qty": r.get("minimum_quantity"), "max_qty": r.get("maximum_quantity"),
                "drop_source": r.get("drop_source"), "quest_id": r.get("quest_id") or 0,
            })
    return out


def apply(rows: list[dict]) -> dict:
    init_db().close()
    conn = get_connection()
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    mobs = {r[0] for r in conn.execute("SELECT id FROM mobs")}
    items = {r[0]: r[1] for r in conn.execute("SELECT id, name FROM items")}
    conn.execute("DELETE FROM mob_drop_sources WHERE source='matip'")
    kept = [r for r in rows if r["mob_id"] in mobs and r["item_id"] in items]
    conn.executemany(
        "INSERT OR REPLACE INTO mob_drop_sources (mob_id, item_id, source, rate, chance, chance_denominator, min_qty, max_qty, drop_source, fetched_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [(r["mob_id"], r["item_id"], "matip", r["rate"], r["chance"], r["den"], r["min_qty"], r["max_qty"], r["drop_source"], now) for r in kept],
    )
    existing = {(m, i): (dr, ds, ls) for m, i, dr, ds, ls in conn.execute("SELECT mob_id, item_id, drop_rate, drop_rate_source, list_source FROM mob_drops")}
    added = filled = 0
    for r in kept:
        if r["quest_id"]:
            continue  # 퀘스트 전용 드롭은 목록에 넣지 않는다
        key = (r["mob_id"], r["item_id"])
        if key not in existing:
            conn.execute("INSERT INTO mob_drops (mob_id, item_id, item_name, drop_rate, drop_rate_source, list_source) VALUES (?,?,?,?,'matip','matip')",
                         (r["mob_id"], r["item_id"], items[r["item_id"]], r["rate"]))
            existing[key] = (r["rate"], "matip", "matip")
            added += 1
        else:
            dr, ds, ls = existing[key]
            if dr is None and ds is None and ls is None:
                conn.execute("UPDATE mob_drops SET drop_rate=?, drop_rate_source='matip' WHERE mob_id=? AND item_id=?", (r["rate"], r["mob_id"], r["item_id"]))
                filled += 1
    conn.commit()
    total = conn.execute("SELECT COUNT(*) FROM mob_drop_sources").fetchone()[0]
    agree = conn.execute(
        "SELECT SUM(ABS(md.drop_rate - s.rate) < 1e-9), COUNT(*) FROM mob_drops md JOIN mob_drop_sources s ON s.mob_id=md.mob_id AND s.item_id=md.item_id AND s.source='matip' WHERE md.drop_rate_source='mapledb'"
    ).fetchone()
    conn.close()
    res = {"source_rows": total, "kept": len(kept), "added_pairs": added, "filled_rates": filled,
           "mapledb_agree": int(agree[0] or 0), "mapledb_compared": int(agree[1] or 0)}
    print("드롭 반영:", res, file=sys.stderr)
    return res


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", type=Path)
    args = ap.parse_args()
    apply(rows_from_details(fetch(args.cache)))
