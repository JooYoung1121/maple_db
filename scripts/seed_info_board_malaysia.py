#!/usr/bin/env python3
"""정보공유 게시판 시드: 말레이시아 지역·사냥터·보스 가이드 (2026-10-08 패치).

seed_info_board_quest_guide.py 와 같은 방식으로 제목이 일치하는 시드 글만
등록/갱신하고 유저 글은 건드리지 않는다. (start.sh 가 배포 시 --update 로 갱신)

수치 근거:
- 맵·몹 목록, 레벨, 보스 조건 : 메랜 10/8 공식 패치노트
  https://maple.land/board/notices/h0ifyesthgb4e79hecngkcgh
- HP/EXP/젠 수 : GMS v92 원본 (data/research/malaysia/gms92_map_spawns.json)
  — 메랜은 공지에 레벨만 공개. HP/EXP는 참고값으로 실측과 다를 수 있음.
- 보스 페이즈 구성·입장 NPC : GMS v92 원본 참고 (메랜 실측 전)

  python3 scripts/seed_info_board_malaysia.py            # 없을 때만 등록
  python3 scripts/seed_info_board_malaysia.py --update   # 시드 글 최신본으로 갱신
"""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "maple.db"
TITLE = "말레이시아 사냥터·보스 타르가 & 스칼리온 정리 (10/8 패치)"
TITLE_LIKE = "말레이시아 사냥터·보스 타르가 & 스칼리온 정리%"
NICKNAME = "운영자"

CONTENT = """10/8 패치로 신규 지역 <말레이시아>가 열렸습니다. 공지 확정 정보(맵·몹·레벨·보스 조건)에
원본(GMS v92) 데이터의 HP·EXP·젠 수를 붙여 레벨대별 사냥터로 정리했습니다.
⚠ 레벨은 공지 확정, HP·EXP·젠 수는 원본 참고값입니다 — 메랜 실측과 다르면 제보 부탁드립니다.

■ 가는 법 · 지역 구조
· 각 마을에 있는 스피넬에게 말을 걸면 말레이시아로 이동할 수 있습니다. (공지 확정)
· 트렌드 존 메트로폴리스(마을) ─ 진흙 사면 변두리·1·2·3 ─ 캄퐁 마을(마을)
  ─ 히비스커스 길목 1·2·3 ─ 판타지 테마 파크 1·2·3 ─ 스푸키 월드 입구 ─ 스푸키 월드(보스)
· '히비스커스 길목 3'은 원본에 없는 메랜 커스텀 맵이라 사이트 맵 DB에는 아직 없습니다. (실측 후 추가)

■ 레벨대별 사냥터 (HP/EXP는 원본 참고값)
[Lv.45~56 — 진흙 사면]
· 클로로트랩 Lv.45 (HP 2,600/EXP 132) · 이모 슬라임 Lv.47 (2,850/135) — 진흙 사면 변두리, 합계 29젠
· 다크 피션 Lv.52 (3,700/172) · 올리 올리 Lv.56 (4,600/185) — 진흙 사면 1, 합계 28젠
→ 40대 중반 물몸 몹이 평지형 맵에 밀집. 같은 레벨대 '빛을잃은동굴1(혼줌 드랍)'과 비교해
  혼줌이 급하면 빛동1, 신규 몬스터북·쾌적한 단독 사냥이면 이쪽입니다.

[Lv.59~65 — 진흙 사면 안쪽 · 히비스커스 길목]
· 로데오 Lv.61 (6,000/235) — 진흙 사면 2(17젠) · 히비스커스 길목 1
· 챠머 Lv.65 (9,800/255) — 진흙 사면 3(16젠) · 히비스커스 길목 1
· 겁쟁이 스칼리온 Lv.59 (5,800/220) + 라타툴라 Lv.59 (6,200/210) — 히비스커스 길목 2, 합계 37젠
→ 히비스커스 길목 2가 밀도 최고(37젠). 50대 후반 구간에서 기억자리 경쟁 없이 사냥할 대안입니다.

[Lv.68~75 — 판타지 테마 파크 초입]
· 제스터 스칼리온 Lv.68 (12,000/270) + 프로스콜라 Lv.72 (15,200/300) — 판타지 테마 파크 1, 합계 29젠
· 야바 두 Lv.75 (15,800/352) — 판타지 테마 파크 2(7젠)

[Lv.82~94 — 판타지 테마 파크 안쪽 ★주목]
· 부퍼 스칼리온 Lv.82 (28,000/1,250) — 판타지 테마 파크 2(10젠)
· 바이크롤라 Lv.87 (36,000/2,000) — 판타지 테마 파크 3, 단일몹 26젠!
· 갤러페라 Lv.94 (43,000/2,500) — 스푸키 월드 입구(17젠)
→ 참고값 기준 EXP/HP 비율이 바이크롤라 0.056, 갤러페라 0.058로 와일드카고(0.044)·
  다크 코니언(0.055)급 이상입니다. 단일몹 26젠 맵(바이크롤라)은 광역 직업의
  80대 후반~90대 신규 명당 후보 — 실측 경험치가 참고값대로인지가 관건입니다.

■ 보스 : 타르가 & 스칼리온 (스푸키 월드)
· 도전 조건 (공지 확정): 선행 퀘스트 완료 + Lv.90 이상 + '판타지 테마파크의 영혼' 소지, 7일에 1회
· 원본 참고: 타르가·스칼리온 각각 3페이즈(HP 6,000만 → 9,000만 → 1억 5,000만)로 강화되며
  입장은 스푸키 월드의 NPC를 통합니다. 메랜 패턴·스펙컷 실측은 수집 중입니다.
· 보상: 혼돈의 주문서 드랍이 공지로 확정. 원본에서는 올스탯 투구(스칼리온 모자/타르가 모자)로
  유명한 보스지만 메랜 드랍 테이블은 아직 미확인입니다.
· 말레이시아 필드몹은 혼줌 드랍 목록에 없습니다 — 혼줌 파밍과 말레 사냥은 별개로 계획하세요.

■ 기타 (공지 확정)
· 말레이시아 몬스터북 데이터가 추가되었습니다 — 수집러는 신규 14종 체크.
· 보따리상인 묘묘에 캄퐁 마을 특산물이 추가되었습니다.

※ 출처: 메이플랜드 10/8 공식 패치노트 (maple.land/board/notices/h0ifyesthgb4e79hecngkcgh)
   원본 수치: maplestory.io GMS v92 (빅뱅 전 MSEA 수입 데이터)
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
