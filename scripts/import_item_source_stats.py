"""아이템 수치 다중 출처 수집 → item_source_stats (v4.17.0).

mapledb.kr 이 갱신을 멈춰(2024 스냅샷) 운영 중인 공개 DB 를 직접 가져온다. 출처별로 행을 따로 두고
상세 API 가 crawler/item_sources.resolve 로 병합한다 (우선순위 override > matip > maplelog > mapledb).

  matip     https://matip.kr/com/db/api.php?action=item_list&page=N&per_page=100  (156 페이지 · 15,599종 · JSON)
            장비 equipment_info 에 reqJob 비트마스크 · inc* 옵션 · incMHPr/incMMPr(메랜 전용 보정) · tuc · price · attackSpeed
  maplelog  https://maplelog.gg/js/item_db.js · item_db_ext.js · item_db_custom.js
            행 [코드, 한글명, 영문명, 요구레벨, {reqLevel, reqJob, inc*, tuc, price, attackSpeed}] // 주석
            custom 은 수기 파일 — 주석의 "메랜 실측값" 같은 메모를 note 로 보존한다. 우선순위 main > custom > ext (로그지지 병합 규칙과 동일)
  mapledb   로컬 item_mapleland_stats 테이블(2024 스냅샷) 을 공통 형식으로 복사 — 네트워크 없음

실행:
  uv run --python 3.11 --no-project python scripts/import_item_source_stats.py                 # 전부 (약 30초)
  uv run --python 3.11 --no-project python scripts/import_item_source_stats.py --only matip     # 한 출처만
  uv run --python 3.11 --no-project python scripts/import_item_source_stats.py --cache DIR      # 받은 원문 재사용/저장
  uv run --python 3.11 --no-project python scripts/import_item_source_stats.py --report data/mapleland_item_option_diffs.json
출처 단위로 전체 교체(DELETE+INSERT) 라 멱등. 라이브는 start.sh SEED_TABLES 로 전달된다.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from crawler.db import get_connection, init_db  # noqa: E402
from crawler.item_sources import (  # noqa: E402
    PRIORITY, SOURCE_STATS_COLUMNS, SOURCES, STAT_KEYS, normalize_maplelog, normalize_mapledb, normalize_matip,
    normalize_override, record_to_row, resolve,
)

UA = {"User-Agent": "Mozilla/5.0 (Macintosh) memorymapledb-sync/1.0", "Accept": "application/json,text/javascript,*/*"}
MATIP_API = "https://matip.kr/com/db/api.php"
MAPLELOG_FILES = ("js/item_db.js", "js/item_db_custom.js", "js/item_db_ext.js")
MAPLELOG_ORDER = ("item_db.js", "item_db_custom.js", "item_db_ext.js")  # 로그지지 병합 우선순위
OVERRIDES_PATH = ROOT / "data" / "mapleland_overrides.json"

_ROW_RE = re.compile(
    r'^\s*\[(\d{7}),\s*"((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)",\s*(\d+|null)\s*(?:,\s*(\{.*?\}))?\s*\]\s*,?\s*(//.*)?$',
    re.M,
)


def _get(url: str, timeout: int = 60, tries: int = 3) -> str:
    err: Exception | None = None
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return r.read().decode("utf-8", "ignore")
        except Exception as e:  # noqa: BLE001
            err = e
            time.sleep(1.5 * (attempt + 1))
    print(f"  요청 실패 {url}: {err}", file=sys.stderr)
    return ""


# ── matip ────────────────────────────────────────────────────────────────────

def fetch_matip(cache: Path | None) -> list[dict]:
    if cache and (cache / "matip_items.json").exists():
        return json.loads((cache / "matip_items.json").read_text(encoding="utf-8"))

    def page(p: int) -> list[dict]:
        q = urllib.parse.urlencode({"action": "item_list", "q": "", "page": p, "per_page": 100})
        raw = _get(f"{MATIP_API}?{q}")
        try:
            d = json.loads(raw)
        except ValueError:
            return []
        return d.get("items") or [] if d.get("ok") else []

    q = urllib.parse.urlencode({"action": "item_list", "q": "", "page": 1, "per_page": 100})
    first = json.loads(_get(f"{MATIP_API}?{q}") or "{}")
    pages = int((first.get("pagination") or {}).get("pages") or 0)
    if not pages:
        print("matip: 목록을 받지 못함", file=sys.stderr)
        return []
    items: dict[int, dict] = {x["id"]: x for x in first.get("items") or []}
    with concurrent.futures.ThreadPoolExecutor(6) as ex:
        for rows in ex.map(page, range(2, pages + 1)):
            for x in rows:
                items[x["id"]] = x
    out = list(items.values())
    if cache:
        cache.mkdir(parents=True, exist_ok=True)
        (cache / "matip_items.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print(f"matip: {len(out)}종 ({pages}페이지)", file=sys.stderr)
    return out


# ── maplelog ─────────────────────────────────────────────────────────────────

def parse_maplelog_js(src: str) -> list[dict]:
    rows = []
    for m in _ROW_RE.finditer(src):
        iid, kr, en, lv, st, cm = m.groups()
        try:
            stats = json.loads(st) if st else {}
        except ValueError:
            stats = {}
        rows.append({"id": int(iid), "kr": kr, "en": en, "lv": None if lv == "null" else int(lv),
                     "stats": stats, "comment": (cm or "").lstrip("/ ").strip() or None})
    return rows


def _has_numbers(stats: dict) -> bool:
    return any((k.startswith(("inc", "req")) and k != "reqJob") or k == "tuc" for k in (stats or {}))


def fetch_maplelog(cache: Path | None) -> list[dict]:
    """세 파일을 로그지지 병합 규칙(main > custom > ext, 추가 전용)으로 합친 행 목록."""
    merged: dict[int, dict] = {}
    bust = int(time.time())
    for name in MAPLELOG_ORDER:
        path = cache / name if cache else None
        src = path.read_text(encoding="utf-8") if path and path.exists() else ""
        if not src:
            src = _get(f"https://maplelog.gg/js/{name}?t={bust}", timeout=120)
            if cache and src:
                cache.mkdir(parents=True, exist_ok=True)
                path.write_text(src, encoding="utf-8")  # type: ignore[union-attr]
        rows = parse_maplelog_js(src)
        added = 0
        for r in rows:
            if r["id"] not in merged:
                r["file"] = name
                merged[r["id"]] = r
                added += 1
            elif not _has_numbers(merged[r["id"]]["stats"]) and _has_numbers(r["stats"]):
                # 로그지지 _mergeItemDBCustom: main 행에 스탯이 없으면 custom 이 보충한다
                merged[r["id"]].update({"stats": r["stats"], "comment": r["comment"], "file": name})
        print(f"maplelog {name}: {len(rows)}행 (신규 {added})", file=sys.stderr)
    return list(merged.values())


# ── 적재 ─────────────────────────────────────────────────────────────────────

def replace_source(conn, source: str, records: list[dict], fetched_at: str) -> int:
    conn.execute("DELETE FROM item_source_stats WHERE source = ?", (source,))
    cols = ",".join(SOURCE_STATS_COLUMNS)
    marks = ",".join("?" for _ in SOURCE_STATS_COLUMNS)
    conn.executemany(f"INSERT INTO item_source_stats ({cols}) VALUES ({marks})",
                     [record_to_row(source, r, fetched_at) for r in records])
    return len(records)


def run(only: set[str] | None, cache: Path | None) -> dict[str, int]:
    init_db().close()
    conn = get_connection()
    known = {r[0] for r in conn.execute("SELECT id FROM items")}
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    counts: dict[str, int] = {}

    if not only or "matip" in only:
        recs = []
        for x in fetch_matip(cache):
            r = normalize_matip(x)
            if r is None:
                continue
            # 캐시 아닌 장비 전부 + 우리 DB 에 있는 아이템(소비·기타 상점가 등)
            if x.get("category") == "equip" or r["id"] in known:
                recs.append(r)
        counts["matip"] = replace_source(conn, "matip", recs, now)

    if not only or "maplelog" in only:
        recs = []
        for row in fetch_maplelog(cache):
            r = normalize_maplelog(row)
            if r is None:
                continue
            if row.get("file") == "item_db_custom.js":
                r["note"] = " — ".join(x for x in ("로그지지 수기 관리 파일(메랜 전용·실측 보충)", r["note"]) if x)
            elif row.get("file") == "item_db_ext.js" and not r["note"]:
                r["note"] = "로그지지 자동 수집분(KMS389/GMS95)"
            recs.append(r)
        counts["maplelog"] = replace_source(conn, "maplelog", recs, now)

    if not only or "mapledb" in only:
        recs = []
        try:
            rows = conn.execute("SELECT * FROM item_mapleland_stats").fetchall()
        except Exception:
            rows = []
        for row in rows:
            r = normalize_mapledb(dict(row))
            if r:
                recs.append(r)
        fetched = rows[0]["fetched_at"] if rows and "fetched_at" in rows[0].keys() and rows[0]["fetched_at"] else now
        counts["mapledb"] = replace_source(conn, "mapledb", recs, fetched)

    conn.commit()
    total = conn.execute("SELECT source, COUNT(*) FROM item_source_stats GROUP BY source").fetchall()
    conn.close()
    print("적재:", counts, "| 테이블:", {r[0]: r[1] for r in total}, file=sys.stderr)
    return counts


# ── 보고서 ───────────────────────────────────────────────────────────────────

def build_report(path: Path) -> None:
    """장비 전수에 대해 병합값 vs 원작(GMS v92) 차이와 출처 간 충돌을 JSON 으로 남긴다 (리뷰·커밋용)."""
    from crawler.item_sources import load_source_records

    conn = get_connection()
    try:
        overrides = (json.loads(OVERRIDES_PATH.read_text(encoding="utf-8")).get("items") or {})
    except Exception:
        overrides = {}
    items = conn.execute(
        "SELECT id, name, stats FROM items WHERE id BETWEEN 1000000 AND 1999999 AND COALESCE(is_hidden,0)=0"
    ).fetchall()
    out_items = []
    n_diff = n_conf = n_src = 0
    for row in items:
        recs = load_source_records(conn, row["id"])
        ov = overrides.get(str(row["id"]))
        if ov:
            o = normalize_override(row["id"], ov)
            if o:
                recs["override"] = o
        if not recs:
            continue
        n_src += 1
        try:
            original = json.loads(row["stats"] or "{}")
        except ValueError:
            original = {}
        res = resolve(recs, original)
        if not res:
            continue
        if res["diff"] or res["conflicts"] or res["level_conflict"] or res["job_conflict"]:
            n_diff += bool(res["diff"])
            n_conf += bool(res["conflicts"])
            out_items.append({
                "id": row["id"], "name_kr": res.get("name_kr") or row["name"], "primary": res["primary"],
                "sources": res["sources_used"],
                "resolved_vs_gms92": res["diff"],
                "source_conflicts": res["conflicts"],
                "level_conflict": res["level_conflict"], "job_conflict": res["job_conflict"],
            })
    conn.close()
    payload = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "priority": list(PRIORITY),
        "sources": {k: v["label"] for k, v in SOURCES.items()},
        "stat_keys": list(STAT_KEYS),
        "summary": {"equips_with_source": n_src, "equips_differing_from_gms92": n_diff, "equips_with_source_conflict": n_conf},
        "items": out_items,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"보고서 {path}: 출처 보유 {n_src} · 원작과 다름 {n_diff} · 출처 충돌 {n_conf}", file=sys.stderr)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", action="append", choices=["matip", "maplelog", "mapledb"], help="지정 출처만 (반복 가능)")
    ap.add_argument("--cache", type=Path, help="원문 캐시 디렉터리 (matip_items.json, item_db*.js)")
    ap.add_argument("--report", type=Path, help="병합 결과 보고서 JSON 경로")
    ap.add_argument("--report-only", action="store_true", help="수집 없이 보고서만")
    args = ap.parse_args()
    if not args.report_only:
        run(set(args.only) if args.only else None, args.cache)
    if args.report:
        build_report(args.report)
