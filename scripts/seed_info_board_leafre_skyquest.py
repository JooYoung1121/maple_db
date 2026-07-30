#!/usr/bin/env python3
"""정보공유 게시판 시드: 리프레 '드래곤 라이더 / 하늘을 향해' 연계 공략 (플라잉 스킬).

출시 예정 콘텐츠 선반영. seed_info_board_quest_guide.py 와 같은 방식으로
제목이 일치하는 시드 글만 등록/갱신하고 유저 글은 건드리지 않는다.

수치 근거 (전부 data/maple.db 실측):
- 조건·보상·시작/완료 NPC : kms_quest_cache.raw_json (quest_id 3756~3761)
- 드랍률                : mob_drops.drop_rate
- 사냥터 스폰 수         : mob_spawns.spawn_count (GMS v92 map_details 기준)
- 몹 레벨/HP            : data/mapleland_reference.json entities.mobs

  python3 scripts/seed_info_board_leafre_skyquest.py            # 없을 때만 등록
  python3 scripts/seed_info_board_leafre_skyquest.py --update   # 시드 글 최신본으로 갱신
"""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "maple.db"
TITLE = "리프레 드래곤 라이더 연계 공략 — 플라잉 스킬 얻기"
TITLE_LIKE = "리프레 드래곤 라이더 연계 공략%"
NICKNAME = "운영자"

CONTENT = """[출시 예정 콘텐츠] 인게임에서 확인된 사라진 숲의 하프링거 모험가 '마타타' 기준으로 미리 정리한 공략입니다.
정식 패치 시 수치가 바뀔 수 있습니다.

■ 한눈에 보기
· 요구 레벨 : 150 (전 단계 공통)
· 시작      : 레벨 150 달성 시 '드래곤 라이더의 정체 1' 자동 수락
· 핵심 보상 : 플라잉(Flying) 스킬 — '하늘을 향해 2' 완료 시 습득
· 총 경험치 : 1,471,795 (15,332 + 15,332 + 383,306 + 383,306 + 689,951)
· 주요 NPC  : 촌장 타타모(리프레 마을) / 마타타(미나르 숲 - 사라진 숲) / 드래곤 라이더

■ 진행 순서
1) 드래곤 라이더의 정체 1  — 타타모에서 수락·완료. 경험치 15,332
2) 드래곤 라이더의 정체 2  — 타타모에서 수락 → '사라진 숲'의 마타타에서 완료. 경험치 15,332
   ※ 여기서 두 갈래로 갈라집니다.
      A라인(플라잉) : 하늘을 향해 1 → 하늘을 향해 2 → 참회의 눈물
      B라인(분기)   : 드래고니카의 뿔   ← '정체 2'만 끝내면 바로 열립니다
3) 하늘을 향해 1 — 마타타. 재료 4종 납품. 경험치 383,306
4) 하늘을 향해 2 — 마타타. 용족의 이끼 추출액 1개 납품 → 플라잉 스킬 습득
5) 드래고니카의 뿔 — 타타모. 드래고니카 처치 후 뿔 1개 납품. 경험치 383,306
6) 참회의 눈물 — 드래곤 라이더에서 수락 → 타타모에서 완료. 경험치 689,951

■ '하늘을 향해 1' 재료 4종 — 여기가 제일 오래 걸립니다
· 비틀의 뿔 40개
  └ 비틀(Lv72) — 리프레 동쪽 숲 15마리 / 투구벌레의 숲 4마리
· 레쉬의 털뭉치 40개
  └ 레쉬(Lv70) — 리프레 서쪽 숲 11마리 / 털복숭이의 숲 6마리 / 미나르숲 서쪽 경계 1마리
· 드래곤의 정수 10개
  └ 그린코니언(Lv100)·다크코니언(Lv105) 드랍률 15.12%
  └ 사라진 숲 17마리(그린 9 + 다크 8) / 불타는 숲 6마리 / 용의 숲1 2마리
· 황혼의 이슬 1개
  └ 그린코니언 3.44% 등 여러 몹 공용 드랍. 정수 파밍 중 대개 같이 나옵니다.

추천 동선 : 마타타가 있는 '사라진 숲'이 코니언 최대 스폰지(17마리)라
드래곤의 정수와 황혼의 이슬을 그 자리에서 함께 해결하고,
비틀의 뿔·레쉬의 털뭉치만 리프레 동/서쪽 숲에서 따로 채우는 쪽이 왕복이 가장 적습니다.

■ '하늘을 향해 2' — 헷갈리기 쉬운 구간
용족의 이끼 추출액은 몹 드랍이 아니라 촌장 타타모에게서 받는 퀘스트 전용 아이템입니다.
받는 곳은 리프레의 타타모, 반납은 사라진 숲의 마타타입니다.
안내 문구만 보고 타타모에게 반납하려 하면 헤매기 쉽습니다.

■ 드래고니카 / 드래곤 라이더
· 드래고니카   : Lv120, HP 1억 2천만. '드래고니카의 뿔' 확정 드랍(1회 처치로 충분)
· 드래곤 라이더 : Lv120, HP 1억 3천만
· 두 몹 모두 일반 사냥터 스폰 데이터에는 없어 소환·스크립트 등장으로 보입니다.
· 드래고니카의 뿔 설명에 "천공지역에 서식하는" 이라고 적혀 있어,
  사라진 숲의 '천공의 문'으로 이어지는 천공 지역이 무대로 보입니다. (추정)

■ 드래곤 라이더가 주는 직업별 상자 (전부 확정 드랍)
· 드래곤라이더의 전사 상자 / 마법사 상자 / 도적 상자 / 궁수 상자 / 해적 상자
· 아이템 설명 : "드래곤라이더가 떨어트린 상자다. OO 무기가 들어있다. 더블클릭으로 열어볼 수 있다."
· 상자 안 무기의 정확한 목록은 클라이언트 보상 데이터에 있어 아직 확인하지 못했습니다.
  확인되는 대로 갱신하겠습니다.

■ 참고
· 플라잉 스킬은 전 직업군이 배울 수 있게 설계돼 있습니다(직업별 스킬 ID가 따로 등록됨).
· '참회의 눈물'은 '하늘을 향해 2'가 선행이라 플라잉을 먼저 배워야 열립니다.
"""


def main() -> int:
    update = "--update" in sys.argv
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("SELECT 1 FROM info_posts LIMIT 1")
    except sqlite3.OperationalError:
        print("info_posts 테이블 없음 — init_db 먼저 필요")
        conn.close()
        return 0

    existing = conn.execute(
        "SELECT id FROM info_posts WHERE title LIKE ? ORDER BY id LIMIT 1", (TITLE_LIKE,)
    ).fetchone()

    if existing and not update:
        print(f"이미 등록됨 (id={existing[0]}) — 건너뜀")
        conn.close()
        return 0

    if existing:
        conn.execute(
            "UPDATE info_posts SET title=?, content=? WHERE id=?", [TITLE, CONTENT, existing[0]]
        )
        print(f"[갱신] info_posts id={existing[0]} → {TITLE}")
    else:
        cur = conn.execute(
            "INSERT INTO info_posts (nickname, title, content) VALUES (?,?,?)",
            [NICKNAME, TITLE, CONTENT],
        )
        print(f"[등록] info_posts id={cur.lastrowid} → {TITLE}")
    conn.commit()
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
