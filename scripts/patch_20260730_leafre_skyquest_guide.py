#!/usr/bin/env python3
"""2026-07-30 리프레 '드래곤 라이더 / 하늘을 향해' 연계 공략을 quests 테이블에 반영.

레퍼런스 등록은 patch_20260730_leafre_skyquest.py 가 담당하고, 이 스크립트는
사이트 퀘스트 페이지가 읽는 quests 테이블에 한글 공략 6건을 넣는다.

근거 (전부 data/maple.db 실측):
- 퀘스트 조건·보상·시작/완료 NPC: kms_quest_cache.raw_json (quest_id 3756~3761)
  · requirementToStart.levelMinimum = 150, 3756 은 normalAutoStart
- 재료 드랍처: mob_drops + mob_spawns (스폰 수는 GMS v92 map_details 기준)
- 몹 레벨/HP: data/mapleland_reference.json entities.mobs

주의: scripts/rebuild_quests_from_excel.py 는 quests 테이블을 DROP 하고
엑셀(퀘매.xlsx) 419건으로 재구축하며 entity_names_en 의 quest 행도 지운다.
그 스크립트를 다시 돌렸다면 이 스크립트와 patch_20260730_leafre_skyquest.py 를
재실행해야 한다. (id 420~425 고정이라 재실행은 멱등)

사용:
  python3 scripts/patch_20260730_leafre_skyquest_guide.py            # dry-run
  python3 scripts/patch_20260730_leafre_skyquest_guide.py --apply
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "maple.db"

CHAIN_PARENT = "드래곤 라이더의 정체 1"
AREA = "리프레"

# (id, name, level_req, start_location, conditions[], exp, item_reward, extra_reward,
#  note, tip, difficulty, is_chain, quest_type, npc_start_id, npc_end_id)
ROWS = [
    (
        420, "드래곤 라이더의 정체 1", 150, "리프레 (촌장 타타모)",
        ["레벨 150 달성 시 자동 수락", "촌장 타타모와 대화"],
        15332, "", "",
        "드래곤 라이더 연계 1/6 · 리프레 마을에 나타난 정체불명의 존재를 조사하는 도입부. "
        "레벨 150이 되면 자동으로 수락된다.",
        "이 연계의 최종 목표는 '하늘을 향해 2'에서 얻는 플라잉 스킬이다.",
        "추천", 0, "일반", 2081000, 2081000,
    ),
    (
        421, "드래곤 라이더의 정체 2", 150, "리프레 (촌장 타타모)",
        ["'드래곤 라이더의 정체 1' 완료", "미나르 숲 '사라진 숲'으로 이동", "하프링거 모험가 마타타와 대화"],
        15332, "", "",
        "드래곤 라이더 연계 2/6 · 타타모에게 받아 사라진 숲의 마타타에게서 완료한다. "
        "여기서 연계가 '하늘을 향해 1'(마타타)과 '드래고니카의 뿔'(타타모) 두 갈래로 나뉜다.",
        "사라진 숲에는 그린코니언·다크코니언이 17마리 스폰된다. 이동한 김에 다음 단계 재료인 "
        "드래곤의 정수와 황혼의 이슬을 함께 파두면 왕복을 줄일 수 있다.",
        "추천", 1, "일반", 2081000, 2085000,
    ),
    (
        422, "하늘을 향해 1", 150, "사라진 숲 (마타타)",
        [
            "'드래곤 라이더의 정체 2' 완료",
            "비틀의 뿔 40개",
            "레쉬의 털뭉치 40개",
            "드래곤의 정수 10개",
            "황혼의 이슬 1개",
        ],
        383306, "", "",
        "드래곤 라이더 연계 3/6 · 연계 전체에서 재료 부담이 가장 큰 구간. 수집처는 아래 팁 참고.",
        "비틀의 뿔 ← 비틀(Lv72) / 리프레 동쪽 숲 15마리·투구벌레의 숲 4마리. "
        "레쉬의 털뭉치 ← 레쉬(Lv70) / 리프레 서쪽 숲 11마리·털복숭이의 숲 6마리. "
        "드래곤의 정수 ← 그린코니언(Lv100)·다크코니언(Lv105) 드랍률 15.1% / 사라진 숲 17마리·불타는 숲 6마리. "
        "황혼의 이슬 ← 그린코니언 3.4% 등 다수 몹 공용 드랍이라 정수를 파는 동안 대개 함께 나온다.",
        "체인", 1, "일반", 2085000, 2085000,
    ),
    (
        423, "하늘을 향해 2", 150, "사라진 숲 (마타타)",
        ["'하늘을 향해 1' 완료", "용족의 이끼 추출액 1개 (촌장 타타모에게서 수령)", "마타타에게 반납"],
        0, "플라잉 스킬", "플라잉(Flying) 스킬 습득",
        "드래곤 라이더 연계 4/6 · 이 연계의 핵심 보상. 용족의 이끼 추출액은 몹 드랍이 아니라 "
        "촌장 타타모에게서 받는 퀘스트 전용 아이템이라 파밍이 필요 없다.",
        "받는 곳은 리프레의 타타모, 반납은 사라진 숲의 마타타다. 안내 문구만 보고 타타모에게 "
        "반납하려 하면 헤매기 쉽다.",
        "필수", 1, "일반", 2085000, 2085000,
    ),
    (
        424, "드래고니카의 뿔", 150, "리프레 (촌장 타타모)",
        ["'드래곤 라이더의 정체 2' 완료", "드래고니카 처치", "드래고니카의 뿔 1개"],
        383306, "", "",
        "드래곤 라이더 연계 5/6 · '하늘을 향해' 라인과 별개로 '정체 2'에서 갈라지는 분기라 "
        "플라잉 습득과 순서를 바꿔 진행해도 된다.",
        "드래고니카는 레벨 120·HP 1억 2천만의 보스다. 드래고니카의 뿔은 확정 드랍이라 1회 처치로 충분하다. "
        "일반 사냥터 스폰 데이터에는 없어 소환·스크립트 등장으로 보인다.",
        "체인", 1, "일반", 2081000, 2081000,
    ),
    (
        425, "참회의 눈물", 150, "드래곤 라이더 (NPC)",
        ["'하늘을 향해 2' 완료", "드래곤 라이더와 대화", "촌장 타타모에게 결과 전달"],
        689951, "", "",
        "드래곤 라이더 연계 6/6 · 연계 최대 경험치 구간이며 하프링거 일족의 사연으로 이야기가 마무리된다.",
        "선행이 '하늘을 향해 2'라서 플라잉을 먼저 배워야 열린다.",
        "추천", 1, "일반", 2085003, 2081000,
    ),
]

IDS = tuple(r[0] for r in ROWS)

INSERT_SQL = """
INSERT INTO quests (
    id, name, level_req, area, start_location, quest_conditions,
    exp_reward, meso_reward, item_reward, extra_reward, note, tip,
    difficulty, is_chain, chain_parent, quest_type, is_mapleland,
    npc_start_id, npc_end_id, auto_start, start_level
) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    records = []
    for (qid, name, lv, loc, conds, exp, item_rw, extra_rw,
         note, tip, diff, is_chain, qtype, npc_s, npc_e) in ROWS:
        records.append((
            qid, name, lv, AREA, loc, json.dumps(conds, ensure_ascii=False),
            exp, 0, item_rw, extra_rw, note, tip,
            diff, is_chain, CHAIN_PARENT if is_chain else "", qtype, 1,
            npc_s, npc_e, 1 if qid == 420 else 0, lv,
        ))
        print(f"  {qid} {name:<18} Lv{lv} exp={exp:,} {'체인' if is_chain else '연계시작'}")

    conn = sqlite3.connect(DB_PATH)
    existing = conn.execute(
        f"SELECT id, name FROM quests WHERE id IN ({','.join('?' * len(IDS))})", IDS
    ).fetchall()
    clash = [(i, n) for i, n in existing if n.strip() not in {r[1] for r in ROWS}]
    if clash:
        print(f"\n중단: id {IDS} 에 다른 퀘스트가 있음 → {clash}")
        return 1

    print(f"\nquests {len(records)}건 (기존 {len(existing)}건 교체)")
    if not args.apply:
        print("(dry-run — --apply 로 적용)")
        conn.close()
        return 0

    conn.execute(f"DELETE FROM quests WHERE id IN ({','.join('?' * len(IDS))})", IDS)
    conn.executemany(INSERT_SQL, records)
    conn.commit()
    total = conn.execute("SELECT COUNT(*) FROM quests").fetchone()[0]
    leafre = conn.execute("SELECT COUNT(*) FROM quests WHERE area=?", (AREA,)).fetchone()[0]
    conn.close()
    print(f"적용 완료 — quests 총 {total}건, 리프레 {leafre}건")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
