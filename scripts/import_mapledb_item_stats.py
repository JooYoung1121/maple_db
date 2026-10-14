"""[보존용 · 2024 스냅샷] 메이플랜드 아이템 수치(mapledb.kr) 전수 수집 → item_mapleland_stats 테이블.

⚠ 2026-10-14: mapledb.kr 은 2024년 이후 갱신이 멈춰 재수집하지 않는다. 현행 수치는 scripts/import_item_source_stats.py
(메팁 · 로그지지)로 가져오고, 이 테이블은 'mapledb' 출처(GMS v64 와 일치하는 클라이언트 스냅샷)로만 병합에 참여한다.

배경(2026-10-14): 아이템 상세의 옵션은 GMS v92 크롤(items.stats)이라 메랜 실서버와 다른 항목이 있었다
(예: 니르첸 투구 STR↔DEX, 카날 후드 HP↔MP, 타임리스 이어링 마방 100→80). mapledb.kr은 메랜 기준 아이템
3,956종의 옵션을 기본값·범위(min-max)·요구 스탯·세부 직업·성별·공격속도·상점가까지 제공한다.
원작 테이블을 덮어쓰지 않고 별도 테이블에 두어, 상세 페이지가 "메랜 수치"를 보여주고 원작과의 차이를 표시한다.

1단계: https://mapledb.kr/item.php (전체 목록, 약 6MB) → id·이름·레벨·직업·목록 노출 옵션
2단계: https://mapledb.kr/search.php?q={id}&t=item (상세) → 요구 스탯·세부 직업·성별·전체 옵션·공격속도·상점가·설명
       (목록은 일부 아이템의 옵션을 생략하므로 상세를 정본으로 쓴다)

실행:
  uv run --python 3.11 --no-project python scripts/import_mapledb_item_stats.py            # 전체 재수집(약 10분)
  uv run --python 3.11 --no-project python scripts/import_mapledb_item_stats.py --cache DIR  # 수집 캐시 재사용
멱등(UPSERT). 라이브는 start.sh 시드 동기화(SEED_TABLES)로 전달된다.
"""
import argparse
import concurrent.futures
import datetime as dt
import html
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from crawler.db import get_connection, init_db  # noqa: E402

LIST_URL = "https://mapledb.kr/item.php"
DETAIL_URL = "https://mapledb.kr/search.php?q={id}&t=item"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh) memorymapledb-sync/1.0"}
STAT_LABELS = ["물리방어력", "마법방어력", "물리공격력", "마법공격력", "STR", "DEX", "INT", "LUK",
               "최대체력", "최대마나", "명중률", "회피율", "이동속도", "점프력"]
STAT_RE = re.compile(r"(" + "|".join(STAT_LABELS) + r") (-?\d+)(?: \((-?\d+)-(-?\d+)\))?")


def _text(h: str) -> str:
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", h, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    return html.unescape(re.sub(r"\s+", " ", t))


def _get(url: str, timeout: int = 60) -> str:
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return r.read().decode("utf-8", "ignore")
        except Exception:
            time.sleep(1.5 * (attempt + 1))
    return ""


def parse_list(h: str) -> list[dict]:
    items = []
    for m in re.finditer(r'<a level="(\d*)" jobs="([^"]*)" class="search-page-add-content-box" '
                         r'href="https://mapledb.kr/search.php\?q=(\d+)&t=item"(.*?)</a>', h, flags=re.S):
        level, jobs, iid, body = m.group(1), m.group(2), int(m.group(3)), m.group(4)
        name = re.search(r"search-page-add-content-box-main-title[^>]*>(.*?)</h3>", body, flags=re.S)
        stats = {}
        for sm in re.finditer(r'<span class="favorite-item-info-text">\s*<div>(.*?)</div>\s*<div>(.*?)</div>\s*</span>', body, flags=re.S):
            k = html.unescape(sm.group(1).strip()); v = html.unescape(sm.group(2).strip())
            if k in ("LEVEL", "직업"):
                continue
            mm = re.match(r"(-?\d+)\s*(?:\((-?\d+)-(-?\d+)\))?", v)
            if mm:
                stats[k] = {"base": int(mm.group(1)), "min": int(mm.group(2)) if mm.group(2) else None,
                            "max": int(mm.group(3)) if mm.group(3) else None}
        items.append({"id": iid, "name_kr": html.unescape(name.group(1).strip()) if name else "",
                      "level": int(level) if level else None, "jobs": jobs, "stats": stats})
    return items


def parse_detail(t: str) -> dict:
    """상세 페이지 텍스트('기본 LEVEL …' ~ '추가정보')를 구조화."""
    out: dict = {"req": {}, "stats": {}}
    i = t.find("기본 LEVEL"); j = t.find("추가정보", i)
    if i < 0:
        return out
    t = t[i:j if j > 0 else None]
    m = re.search(r"기본 LEVEL (\d+)", t)
    out["level"] = int(m.group(1)) if m else None
    seg = re.search(r"기본 LEVEL \d+(.*?) 분류 ", t)
    if seg:
        for k, v in re.findall(r"\b(STR|DEX|INT|LUK|POP) (\d+)", seg.group(1)):
            out["req"][k] = int(v)
        desc = re.sub(r"\b(STR|DEX|INT|LUK|POP) \d+", "", seg.group(1)).strip()
        out["description"] = desc or None
    # 분류명은 "한손 무기"처럼 띄어쓰기가 있어 lazy 매칭 (\S+ 로 잡으면 무기 전부가 빠져 요구 스탯이 옵션으로 오인됐다)
    m = re.search(r"분류 (.+?) 주 카테고리 (.+?) 부 카테고리 (.+?) 세부 직업 (\S+) 성별 (\S+)", t)
    body = t
    if m:
        out.update(dict(zip(["class", "category", "subcategory", "jobs", "gender"], m.groups())))
        body = t[m.end():]
    if not m:
        # 분류 블록이 없으면 요구 스탯 구간 뒤부터만 옵션으로 본다
        body = t[seg.end():] if seg else t
    for lab, val, mn, mx in STAT_RE.findall(body):
        out["stats"][lab] = {"base": int(val), "min": int(mn) if mn else None, "max": int(mx) if mx else None}
    m = re.search(r"상점 판매가 ([\d,]+) 메소", t)
    out["price"] = int(m.group(1).replace(",", "")) if m else None
    m = re.search(r"공격 ?속도 (\S+)", t)
    out["attack_speed"] = m.group(1) if m else None
    return out


def collect(cache: Path | None) -> list[dict]:
    if cache and (cache / "mapledb_full.json").exists():
        return json.loads((cache / "mapledb_full.json").read_text(encoding="utf-8"))
    print("목록 수집…", file=sys.stderr)
    listed = parse_list(_get(LIST_URL, timeout=120))
    print(f"목록 {len(listed)}종 · 상세 수집…", file=sys.stderr)

    def one(it):
        d = parse_detail(_text(_get(DETAIL_URL.format(id=it["id"]))))
        row = {"id": it["id"], "name_kr": it["name_kr"], "jobs": d.get("jobs") or it["jobs"],
               "level": d.get("level", it["level"]),
               **{k: d.get(k) for k in ("gender", "category", "subcategory", "description", "price", "attack_speed")},
               "req": d.get("req", {}), "stats": d.get("stats") or it["stats"]}
        return row

    rows = []
    with concurrent.futures.ThreadPoolExecutor(6) as ex:
        for n, row in enumerate(ex.map(one, listed)):
            rows.append(row)
            if n % 300 == 0:
                print(f"  {n}/{len(listed)}", file=sys.stderr)
    if cache:
        cache.mkdir(parents=True, exist_ok=True)
        (cache / "mapledb_full.json").write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    return rows


def upsert(rows: list[dict]) -> int:
    init_db().close()
    conn = get_connection()
    cols = {r[1] for r in conn.execute("PRAGMA table_info(item_mapleland_stats)")}
    for col in ("category", "subcategory"):
        if col not in cols:
            conn.execute(f"ALTER TABLE item_mapleland_stats ADD COLUMN {col} TEXT")
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    n = 0
    for r in rows:
        stats = {k: v for k, v in (r.get("stats") or {}).items() if v.get("base") is not None}
        conn.execute(
            """INSERT INTO item_mapleland_stats
               (item_id, name_kr, level, jobs, gender, category, subcategory, req_json, stats_json, price, attack_speed, description, source_url, fetched_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
               ON CONFLICT(item_id) DO UPDATE SET name_kr=excluded.name_kr, level=excluded.level, jobs=excluded.jobs,
                 gender=excluded.gender, category=excluded.category, subcategory=excluded.subcategory,
                 req_json=excluded.req_json, stats_json=excluded.stats_json, price=excluded.price,
                 attack_speed=excluded.attack_speed, description=excluded.description, source_url=excluded.source_url,
                 fetched_at=excluded.fetched_at""",
            (r["id"], r.get("name_kr"), r.get("level"), r.get("jobs"), r.get("gender"), r.get("category"), r.get("subcategory"),
             json.dumps(r.get("req") or {}, ensure_ascii=False), json.dumps(stats, ensure_ascii=False),
             r.get("price"), r.get("attack_speed"), r.get("description"), DETAIL_URL.format(id=r["id"]), now),
        )
        n += 1
    conn.commit()
    total = conn.execute("SELECT COUNT(*) FROM item_mapleland_stats").fetchone()[0]
    conn.close()
    print(f"upsert {n}행 · 테이블 총 {total}행", file=sys.stderr)
    return n


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", type=Path, help="수집 결과 캐시 디렉터리 (mapledb_full.json 재사용/저장)")
    args = ap.parse_args()
    upsert(collect(args.cache))
