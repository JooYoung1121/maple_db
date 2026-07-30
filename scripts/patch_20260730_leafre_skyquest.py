#!/usr/bin/env python3
"""2026-07-30 리프레 '드래곤 라이더 / 하늘을 향해' 연계 퀘스트 출시 대비 레퍼런스 반영.

출시 예정 콘텐츠 — 인게임 확인(사라진 숲의 하프링거 모험가 마타타) 기준으로 선반영한다.

근거:
- 퀘스트 본문·보상은 data/maple.db 의 kms_quest_cache(quest_id 3756~3761, maplestory.io KMS 캐시)
- NPC/맵/아이템 ID는 GMS v92 덤프(maps·npcs·items 테이블, 2026-03-20 수집)
- 천공 지역 맵 10종은 wz_data_v62/String_Map.json 에 존재 확인 (v62 클라 보유 맵)
  · 240080600/700/800(Crimson Sky Edge·Nest Entrance·Nest)은 v62 에 없어 제외
- 마타타(2085000)·천공의 문(2085001/2)·드래곤 라이더(2085003) NPC 와 퀘스트 3756~3761 은
  v62/v83 WZ 어디에도 없음 → ML 이 상위 버전에서 백포트하는 신규 콘텐츠로 판단
  (2026-07-24 켄타 PQ 와 동일한 패턴)

entity_names_en 한글명은 quest 6종을 제외하고 이미 kms 소스로 수록돼 있다.

사용:
  python3 scripts/patch_20260730_leafre_skyquest.py            # dry-run
  python3 scripts/patch_20260730_leafre_skyquest.py --apply
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "maple.db"
REF_PATH = ROOT / "data" / "mapleland_reference.json"

# 연계 퀘스트 NPC (GMS v92 npcs 테이블 기수록, 레퍼런스 화이트리스트에만 누락)
NEW_NPCS = [
    (2085000, "마타타"),
    (2085001, "천공의 문"),
    (2085002, "천공의 문"),
    (2085003, "드래곤 라이더"),
]

# 천공 지역 — 마타타 연계 종착지. v62 String_Map.json 존재분만.
NEW_MAPS = [
    (240080000, "천공의 나루터"),
    (240080040, "천공의 부활터"),
    (240080041, "천공의 부활터"),
    (240080050, "망자의 동굴"),
    (240080051, "망자의 동굴"),
    (240080100, "천공 지역 1"),
    (240080200, "천공 지역 2"),
    (240080300, "천공 지역 끝자락"),
    (240080400, "천공의 둥지 입구"),
    (240080500, "천공의 둥지"),
]

# 연계 퀘스트 재료/보상 아이템 (id, 한글명, 착용 레벨, 직업) — 전부 기타(4xxxxxx) 아이템
NEW_ITEMS = [
    (4001401, "드래고니카의 뿔", 0, "공용"),
    (4001402, "드래곤의 정수", 0, "공용"),
    (4032531, "용족의 이끼 추출액", 0, "공용"),
]

# 연계 퀘스트 6단 (kms_quest_cache 기준)
NEW_QUESTS = [
    (3756, "드래곤 라이더의 정체 1"),
    (3757, "드래곤 라이더의 정체 2"),
    (3758, "하늘을 향해 1"),
    (3759, "하늘을 향해 2"),
    (3760, "드래고니카의 뿔"),
    (3761, "참회의 눈물"),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    ref = json.loads(REF_PATH.read_text(encoding="utf-8"))
    ent = ref["entities"]
    nodes = {
        "npcs": (ent["npcs"]["records"], NEW_NPCS),
        "maps": (ent["maps"]["records"], NEW_MAPS),
        "quests": (ent["quests"]["records"], NEW_QUESTS),
    }

    added = {}
    for kind, (records, incoming) in nodes.items():
        known = {int(r["id"]) for r in records}
        new = [(i, n) for i, n in incoming if i not in known]
        for i, n in new:
            records.append({"id": i, "name_kr": n})
            print(f"{kind} 추가: {i} {n}")
        added[kind] = new

    item_records = ent["items"]["records"]
    known_items = {int(r["id"]) for r in item_records}
    new_items = [row for row in NEW_ITEMS if row[0] not in known_items]
    for i, n, lv, jobs in new_items:
        item_records.append({"id": i, "name_kr": n, "level": lv, "jobs": jobs})
        print(f"items 추가: {i} {n}")
    added["items"] = new_items

    # entity_names_en — 퀘스트 한글명만 미수록 (NPC/맵/아이템은 kms 소스로 기수록)
    name_rows = [("quest", i, n, "kms") for i, n in NEW_QUESTS]

    total = sum(len(v) for v in added.values())
    print(f"\n레퍼런스 신규 {total}건, entity_names_en INSERT OR IGNORE {len(name_rows)}건")

    if not args.apply:
        print("(dry-run — --apply 로 적용)")
        return 0

    REF_PATH.write_text(json.dumps(ref, ensure_ascii=False, indent=2), encoding="utf-8")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.executemany(
        "INSERT OR IGNORE INTO entity_names_en (entity_type, entity_id, name_en, source) VALUES (?,?,?,?)",
        name_rows,
    )
    conn.commit()
    print(f"적용 완료 (entity_names_en {cur.rowcount}행 삽입)")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
