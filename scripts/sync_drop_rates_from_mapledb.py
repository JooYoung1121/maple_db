#!/usr/bin/env python3
"""mapledb.kr(메랜DB) 기준 드랍률 동기화.

배경: mob_drops.drop_rate 는 대부분 옛메 블로그(maplekibun.tistory.com/892, 2020)
파싱값이라 메랜 커뮤니티 표준인 mapledb.kr 수치와 상이했다. 이 스크립트는
메이플랜드 레퍼런스 몹 전체의 mapledb.kr 페이지를 읽어 드랍률을 동기화하고,
행 단위 출처(drop_rate_source)를 남긴다.

출처 우선순위 (에델슈타인 판본 원칙과 동일):
  community(실측 검증) > mapledb(메랜DB) > maplekibun(옛메 참고값)
  - community 행은 덮어쓰지 않는다 (몬스터북/툴팁 스크린샷 검증분)
  - mapledb 에 있는 (몹, 아이템) 조합은 rate 를 mapledb 값으로 교체
  - mapledb 에만 있는 조합은 새로 추가 (items 테이블에 존재하는 아이템만)
  - 우리에게만 있는 조합은 남기되 maplekibun 참고값으로 표기

주의: [[project-mapledb-parser-broken]] — 기존 mobs/maps 파서와 무관한
읽기 전용 신규 파서다. 몹 이름·레벨 등 다른 컬럼은 절대 건드리지 않는다.

사용:
  python3 scripts/sync_drop_rates_from_mapledb.py            # dry-run
  python3 scripts/sync_drop_rates_from_mapledb.py --apply
  python3 scripts/sync_drop_rates_from_mapledb.py --apply --limit 20   # 일부만
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "maple.db"
REFERENCE = ROOT / "data" / "mapleland_reference.json"

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
DELAY_SEC = 0.4

# 에델슈타인 실측 검증 몹 — community 출처로 보존
COMMUNITY_MOB_IDS = set(range(7150000, 7150005)) | set(range(8105000, 8105006))

ITEM_BLOCK_RE = re.compile(
    r'<a class="search-page-add-content-box" href="[^"]*q=(\d+)&t=item">(.*?)</a>', re.S
)
RATE_RE = re.compile(r"드랍율.*?([\d.]+)\s*%", re.S)
NAME_RE = re.compile(r'alt="([^"]+) 이미지"')


def fetch_mob_page(mob_id: int) -> str | None:
    req = urllib.request.Request(
        f"https://mapledb.kr/search.php?q={mob_id}&t=mob",
        headers={"User-Agent": UA},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            # 미등록 몹은 홈(/)으로 302 — urllib 는 따라가므로 최종 URL 로 판별
            if res.geturl().rstrip("/") == "https://mapledb.kr":
                return None
            return res.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"  ! fetch 실패 {mob_id}: {e}", file=sys.stderr)
        return None


def parse_drops(html: str) -> list[tuple[int, str, float]]:
    """(item_id, item_name, rate_percent) 목록."""
    out = []
    for item_id, block in ITEM_BLOCK_RE.findall(html):
        text = re.sub(r"<[^>]+>", " ", block)
        rate_m = RATE_RE.search(text)
        if not rate_m:
            continue
        name_m = NAME_RE.search(block)
        try:
            rate = float(rate_m.group(1))
        except ValueError:
            continue
        out.append((int(item_id), name_m.group(1) if name_m else "", rate))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--limit", type=int, default=None, help="크롤 몹 수 제한 (테스트용)")
    args = ap.parse_args()

    ref = json.loads(REFERENCE.read_text(encoding="utf-8"))
    mob_ids = sorted(
        int(r["id"]) for r in ref["entities"]["mobs"]["records"] if r.get("id")
    )
    if args.limit:
        mob_ids = mob_ids[: args.limit]

    conn = sqlite3.connect(DB_PATH)
    cols = {r[1] for r in conn.execute("PRAGMA table_info(mob_drops)")}
    if "drop_rate_source" not in cols:
        conn.execute("ALTER TABLE mob_drops ADD COLUMN drop_rate_source TEXT")

    known_items = {r[0] for r in conn.execute("SELECT id FROM items")}

    # 1) 기존 행 출처 백필 (아직 출처 없는 행만)
    conn.execute(
        "UPDATE mob_drops SET drop_rate_source='community' "
        "WHERE drop_rate_source IS NULL AND mob_id IN (%s)"
        % ",".join(str(i) for i in sorted(COMMUNITY_MOB_IDS))
    )
    conn.execute(
        "UPDATE mob_drops SET drop_rate_source='maplekibun' "
        "WHERE drop_rate_source IS NULL AND drop_rate IS NOT NULL"
    )

    updated = added = kept_community = missing_item = 0
    crawled = no_page = 0
    changed_samples: list[str] = []

    for i, mob_id in enumerate(mob_ids, 1):
        html = fetch_mob_page(mob_id)
        time.sleep(DELAY_SEC)
        if html is None:
            no_page += 1
            continue
        crawled += 1
        drops = parse_drops(html)
        if not drops:
            continue
        existing = {
            r[0]: (r[1], r[2])
            for r in conn.execute(
                "SELECT item_id, drop_rate, drop_rate_source FROM mob_drops WHERE mob_id=?",
                (mob_id,),
            )
        }
        for item_id, item_name, rate_pct in drops:
            rate = round(rate_pct / 100.0, 8)
            if item_id in existing:
                old_rate, old_src = existing[item_id]
                if old_src == "community":
                    kept_community += 1
                    continue
                if old_rate is None or abs((old_rate or 0) - rate) > 1e-9:
                    if len(changed_samples) < 8:
                        changed_samples.append(
                            f"{mob_id}/{item_name}: {old_rate} → {rate} ({old_src}→mapledb)"
                        )
                conn.execute(
                    "UPDATE mob_drops SET drop_rate=?, drop_rate_source='mapledb' "
                    "WHERE mob_id=? AND item_id=?",
                    (rate, mob_id, item_id),
                )
                updated += 1
            else:
                if item_id not in known_items:
                    missing_item += 1
                    continue
                conn.execute(
                    "INSERT INTO mob_drops (mob_id, item_id, item_name, drop_rate, drop_rate_source) "
                    "VALUES (?,?,?,?, 'mapledb')",
                    (mob_id, item_id, item_name or None, rate),
                )
                added += 1
        if i % 50 == 0:
            print(f"  … {i}/{len(mob_ids)} 몹 처리 (mapledb 페이지 {crawled}건)")

    print(
        f"\n[결과] mapledb 페이지 {crawled}건 / 미등록 {no_page}건\n"
        f"  rate 갱신 {updated}건 · 신규 추가 {added}건 · 실측 보존 {kept_community}건 · "
        f"미보유 아이템 스킵 {missing_item}건"
    )
    if changed_samples:
        print("  변경 샘플:")
        for s in changed_samples:
            print("   -", s)

    if args.apply:
        conn.commit()
        total = conn.execute(
            "SELECT drop_rate_source, COUNT(*) FROM mob_drops GROUP BY drop_rate_source"
        ).fetchall()
        print("[apply] 커밋 완료. 출처 분포:", total)
    else:
        conn.rollback()
        print("[dry-run] 반영하지 않음 (--apply 로 반영)")
    conn.close()


if __name__ == "__main__":
    main()
