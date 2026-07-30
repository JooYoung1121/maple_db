#!/usr/bin/env python3
"""2026-07-30 리프레 연계 관련 아이템 보강.

1) 드래곤 라이더 확정 드랍 상자 5종(2022652~2022656)을 mapleland_reference.json 에 등록
   · mob_drops 기준 드랍률 1.0(확정), 직업별로 1종씩
   · wz_data_v62 String_*.json 에 전부 존재 확인 (v62 클라 보유 아이템)
2) 연계 재료/보상 아이템의 한글 설명을 maplestory.io KMS 에서 받아 items.description 에 채움
   · 현재 전부 빈 문자열이라 상세 페이지에 설명이 안 나옴
   · items 는 start.sh SEED_TABLES 에 포함돼 있어 라이브까지 반영됨

사용:
  python3 scripts/patch_20260730_leafre_skyquest_items.py            # dry-run
  python3 scripts/patch_20260730_leafre_skyquest_items.py --apply
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "maple.db"
REF_PATH = ROOT / "data" / "mapleland_reference.json"

API = "https://maplestory.io/api/KMS/284/item/{}"
# crawler/client.py 와 동일한 UA — 미지정 시 maplestory.io 가 403 을 준다
UA = "MapleDataCollector/1.0 (educational project)"

# 드래곤 라이더 확정 드랍 상자 (id, 한글명, 착용레벨, 직업)
BOXES = [
    (2022652, "드래곤라이더의 전사 상자", 0, "전사"),
    (2022653, "드래곤라이더의 마법사 상자", 0, "법사"),
    (2022654, "드래곤라이더의 도적 상자", 0, "도적"),
    (2022655, "드래곤라이더의 궁수 상자", 0, "궁수"),
    (2022656, "드래곤라이더의 해적 상자", 0, "해적"),
]

# 설명을 채울 대상 — 상자 5종 + 연계 재료/보상
DESC_TARGETS = [i for i, *_ in BOXES] + [2020015, 4000226, 4000236, 4001401, 4001402, 4032531]


def clean(text: str) -> str:
    """WZ 문자열 서식코드 제거 — #c/#b/#k 등 색상 지시자와 개행을 걷어낸다.

    items.description 은 현재 14,146건 전부 비어 있어 기존 표기 관례가 없다.
    프론트(web/app/items/[id]/page.tsx:127)가 평문으로 그대로 출력하므로 평문화한다.
    """
    text = re.sub(r"#[a-zA-Z]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def fetch_description(item_id: int) -> str | None:
    req = urllib.request.Request(API.format(item_id), headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        print(f"  {item_id}: 조회 실패 {exc!r}")
        return None
    desc = (data.get("description") or {}).get("description")
    if not isinstance(desc, str) or not desc.strip():
        return None
    return clean(desc) or None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    ref = json.loads(REF_PATH.read_text(encoding="utf-8"))
    records = ref["entities"]["items"]["records"]
    known = {int(r["id"]) for r in records}
    new_boxes = [b for b in BOXES if b[0] not in known]
    for i, n, lv, jobs in new_boxes:
        print(f"레퍼런스 아이템 추가: {i} {n} ({jobs})")

    print(f"\n설명 조회 {len(DESC_TARGETS)}건 (maplestory.io KMS/284)")
    descs: dict[int, str] = {}
    for item_id in DESC_TARGETS:
        desc = fetch_description(item_id)
        if desc:
            descs[item_id] = desc
            print(f"  {item_id}: {desc[:60]}")
        time.sleep(0.3)

    print(f"\n레퍼런스 신규 {len(new_boxes)}건 / 설명 갱신 {len(descs)}건")
    if not args.apply:
        print("(dry-run — --apply 로 적용)")
        return 0

    for i, n, lv, jobs in new_boxes:
        records.append({"id": i, "name_kr": n, "level": lv, "jobs": jobs})
    REF_PATH.write_text(json.dumps(ref, ensure_ascii=False, indent=2), encoding="utf-8")

    conn = sqlite3.connect(DB_PATH)
    conn.executemany(
        "UPDATE items SET description=? WHERE id=? AND ifnull(description,'')=''",
        [(d, i) for i, d in descs.items()],
    )
    conn.executemany(
        "INSERT OR IGNORE INTO entity_names_en (entity_type, entity_id, name_en, source) VALUES ('item',?,?,'kms')",
        [(i, n) for i, n, _, _ in BOXES],
    )
    conn.commit()
    conn.close()
    print("적용 완료")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
