"""로그지지·메팁에 있는데 사이트 아이템 화이트리스트(메랜DB 2024 스냅샷)에 없는 아이템을 추가한다 (v4.18.0).

화이트리스트(data/mapleland_reference.json · data/mapleland_items.json 의 items records)는 mapledb.kr 2024년 기준이라
그 뒤 추가된 아이템(허리띠 5종 · 리버스 무기 · 말레이시아 신규 아이템 등)의 상세 페이지가 없었다.

후보: 로그지지 item_db.js(원본 목록) + item_db_custom.js(수기·메랜 전용) 에 있는 아이템 — 로그지지는 메랜 전용 사이트라
      목록 자체가 메랜 기준이다. item_db_ext.js(KMS389 대량 수집분)는 메랜 미출시 장비가 섞여 있어 제외.
제외: 가상 코드(끝 4자리 9900 이상 — 로그지지가 실코드를 모를 때 쓰는 번호), 우리 DB 에 없는 장비 분류(빅뱅 이후 직업 무기), 캐시(5xxxxxx)·설치(3xxxxxx)·
      퀘스트 전용(403xxxx)·이름에 테스트/퀘/임시/교환권/세트(퀘스트) 가 들어간 행, 아이콘 404 로 숨긴 아이템.
적용: items 테이블에 없는 아이템은 출처 병합값(crawler/item_sources.resolve: matip > maplelog)으로 행을 만들고,
      두 화이트리스트 파일에 {"id","name_kr","level","jobs","source":"maplelog"} 를 덧붙인다.
      한글명은 apply_mapleland_reference_names 가 entity_names_en(mapleland-current) 로 올린다.

실행: uv run --python 3.11 --no-project python scripts/expand_item_whitelist_from_sources.py [--dry-run]
"""
from __future__ import annotations

import argparse
import collections
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from crawler.db import apply_mapleland_reference_names, get_connection, init_db, rebuild_search_index  # noqa: E402
from crawler.item_sources import load_source_records, resolve  # noqa: E402

REF_COMBINED = ROOT / "data" / "mapleland_reference.json"
REF_ITEMS = ROOT / "data" / "mapleland_items.json"
BAD_NAME = re.compile(r"테스트|퀘|임시|교환권|세트\(퀘스트\)|개발자")


def allowed_id(iid: int) -> bool:
    if iid % 10000 >= 9900:
        return False  # 로그지지 가상 코드
    if 1000000 <= iid < 3000000:
        return True  # 장비 · 소비
    if 4000000 <= iid < 4030000:
        return True  # 기타(몬스터 드롭 · 원석)
    if 4160000 <= iid < 4170000:
        return True  # 스토리북
    return False


def prefix_category_map(conn) -> dict[int, tuple[str, str | None, str]]:
    by: dict[int, collections.Counter] = collections.defaultdict(collections.Counter)
    for iid, c, s, o in conn.execute("SELECT id, category, subcategory, overall_category FROM items WHERE category IS NOT NULL"):
        by[iid // 10000][(c, s, o)] += 1
    return {p: cnt.most_common(1)[0][0] for p, cnt in by.items()}


def main(dry_run: bool) -> dict:
    init_db().close()
    conn = get_connection()
    combined = json.loads(REF_COMBINED.read_text(encoding="utf-8"))
    standalone = json.loads(REF_ITEMS.read_text(encoding="utf-8"))
    known = {int(r["id"]) for r in combined["entities"]["items"]["records"]}
    hidden = {r[0] for r in conn.execute("SELECT id FROM items WHERE COALESCE(is_hidden,0)=1")}
    existing = {r[0] for r in conn.execute("SELECT id FROM items")}
    # 로그지지 main+custom 에서 온 행 = item_source_stats.maplelog 중 ext 가 아닌 것
    cands = conn.execute(
        "SELECT item_id, name_kr FROM item_source_stats WHERE source='maplelog' AND (note IS NULL OR note NOT LIKE '로그지지 자동 수집분%')"
    ).fetchall()
    cat_map = prefix_category_map(conn)
    added_rows: list[dict] = []
    created = 0
    skipped = collections.Counter()
    for iid, name_kr in cands:
        iid = int(iid)
        if iid in known:
            continue
        if not allowed_id(iid):
            skipped["id_range"] += 1
            continue
        if iid in hidden:
            skipped["hidden"] += 1
            continue
        if iid < 2000000 and iid // 10000 not in cat_map:
            # 우리 DB 에 한 번도 없던 장비 분류(샤이닝 로드·소울슈터·케인 등 빅뱅 이후 직업 무기) → 메랜에 없는 아이템
            skipped["unknown_equip_type"] += 1
            continue
        if BAD_NAME.search(name_kr or ""):
            skipped["name"] += 1
            continue
        recs = load_source_records(conn, iid)
        res = resolve(recs, {}) or {}
        kr = name_kr or res.get("name_kr")  # 로그지지(메랜 전용 사이트) 표기를 우선
        if not kr:
            skipped["no_name"] += 1
            continue
        jobs = res.get("jobs")
        level = res.get("level") or 0
        if iid not in existing and not dry_run:
            cat, sub, overall = cat_map.get(iid // 10000, ("Other", None, "Equip" if iid < 2000000 else ("Consume" if iid < 3000000 else "Etc")))
            stats = {s["key"]: s["value"] for s in res.get("stats") or []}
            for k, v in (res.get("req") or {}).items():
                if v:
                    stats[f"req{k}"] = v
            conn.execute(
                """INSERT INTO items (id, name, category, subcategory, level_req, job_req, stats, description, source_url,
                                      attack_speed, price, upgrade_slots, overall_category, is_hidden)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0)""",
                (iid, kr, cat, sub, level, "/".join(jobs) if jobs else "", json.dumps(stats, ensure_ascii=False),
                 res.get("description"), (res.get("source_meta") or {}).get(res.get("primary") or "", {}).get("url"),
                 res.get("attack_speed"), res.get("price"), res.get("tuc"), overall),
            )
            created += 1
        rec = {"id": iid, "name_kr": kr, "level": level, "jobs": ",".join(jobs) if jobs else "공용", "source": "maplelog"}
        added_rows.append(rec)
        known.add(iid)
    if not dry_run and added_rows:
        combined["entities"]["items"]["records"].extend(added_rows)
        combined["entities"]["items"]["total"] = len(combined["entities"]["items"]["records"])
        standalone["items"].extend(added_rows)
        standalone["total"] = len(standalone["items"])
        REF_COMBINED.write_text(json.dumps(combined, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        REF_ITEMS.write_text(json.dumps(standalone, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        conn.commit()
        apply_mapleland_reference_names(conn)
        rebuild_search_index(conn)
        conn.commit()
    conn.close()
    out = {"added_to_whitelist": len(added_rows), "created_item_rows": created, "skipped": dict(skipped),
           "equips": sum(1 for r in added_rows if r["id"] < 2000000)}
    print(out, file=sys.stderr)
    for r in added_rows[:400]:
        print(" ", r["id"], r["name_kr"], r["level"], r["jobs"], file=sys.stderr)
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    main(ap.parse_args().dry_run)
