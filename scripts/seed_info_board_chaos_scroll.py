#!/usr/bin/env python3
"""정보공유 게시판 시드: 혼돈의 주문서 드랍 몹·사냥터 연구 (2026-10-08 패치).

seed_info_board_quest_guide.py 와 같은 방식으로 제목이 일치하는 시드 글만
등록/갱신하고 유저 글은 건드리지 않는다. (start.sh 가 배포 시 --update 로 갱신)

수치 근거:
- 드랍 몹 목록·획득처 : 메랜 10/8 공식 패치노트 (확률은 미공개)
  https://maple.land/board/notices/h0ifyesthgb4e79hecngkcgh
- 사냥터 젠 수        : mob_spawns.spawn_count (GMS v92 map_details 기준)
- 몹 레벨/HP/EXP      : mobs 테이블 (GMS v92 참고값 — 메랜 실측과 다를 수 있음)
- 참고 드랍률         : mob_drops.maplekibun (옛메 블로그 참고값 — 메랜 실측 아님)

  python3 scripts/seed_info_board_chaos_scroll.py            # 없을 때만 등록
  python3 scripts/seed_info_board_chaos_scroll.py --update   # 시드 글 최신본으로 갱신
"""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "maple.db"
TITLE = "혼돈의 주문서 드랍 몹·사냥터 총정리 (10/8 패치)"
TITLE_LIKE = "혼돈의 주문서 드랍 몹·사냥터 총정리%"
NICKNAME = "운영자"

CONTENT = """10/8 패치로 혼돈의 주문서(혼줌)가 추가됐습니다. 공식 패치노트의 드랍 몬스터 33종을
사이트 DB(서식 맵·젠 수)와 대조해 어디서 어떻게 파밍하면 좋을지 정리했습니다.
드랍 확률은 공지에 공개되지 않았습니다 — 아래 효율 분석은 몹별 확률이 비슷하다는 가정 위의 추론이고,
각 몹 상세 페이지의 '참고' 배지 확률은 옛메 참고값입니다. 실측이 모이면 갱신합니다.

■ 획득처 (공지 확정)
· 필드/미니보스 몬스터 20종 + 보스 13종 드랍 (아래 표)
· 파티퀘스트 <크림슨우드 성채 공략> 보상 스테이지
· 인게임 콘텐츠로만 무료 획득 (캐시 판매 없음)

■ 필드 몹 드랍 목록 — 레벨 순 (젠 수는 GMS v92 기준 스폰 포인트)
· Lv.21 주니어 네키   — 주니어네키의 늪(23젠) · 축축한나무숲습지(22젠)
· Lv.24 좀비버섯      — 개미굴3(62젠!) · 개미굴2(32젠) · 깊은개미굴1(31젠)
· Lv.24 짜증내는 좀비버섯 — 개미굴4(37젠)
· Lv.30 북치는 토끼   — 에오스탑 24층·92층·100층(각 20~21젠)
· Lv.32 큐브슬라임    — 연구소 101호(18젠)
· Lv.36 팬더테니      — 장난감공장 메인공정2(35젠) · 1공정 3구역(32젠)
· Lv.40 콜드아이      — 빛을잃은동굴1(32젠) · 빛을잃은동굴2(25젠)
· Lv.45 세르프        — 바다 해초 탑
· Lv.45 카파 드레이크 — 빛을잃은동굴1(60젠!) · 동쪽바위산7(22젠)
· Lv.48 삼단지        — 백초마을 약초밭 (50년(9젠)·60년(5젠))
· Lv.53 라이오너      — 노란빛의정원2(30젠) · 하늘계단1(14젠)
· Lv.56 달곰          — 야생곰의 영토1(19젠)
· Lv.62 와일드카고    — 와일드카고의영역(13젠) · 드레이크의밥상(10젠) · 빛을잃은동굴2(7젠)
· Lv.65 호문          — 연구소 201호(11젠)
· Lv.70 캡틴          — 빨간코 해적단 소굴3(12젠)·소굴2(9젠)
· Lv.71 태륜          — 떠돌이곰의 영토 (HP 9.3만 미니보스)
· Lv.90 스노우맨      — 설인의 골짜기 (HP 12만 미니보스, 단일 젠)
· Lv.92 본피쉬        — 깊은 바다 협곡1(16젠)·협곡2(10젠)
· Lv.102 콜드샤크     — 난파선의 무덤(15젠)
· Lv.105 다크 코니언  — 숨겨진 용의 무덤2(13젠) · 사라진 숲(8젠)

■ 보스 드랍 (공지 확정 13종)
발록(발록의 무덤) · 그리프 · 피아누스(좌/우) · 파풀라투스 · 자쿰 · 카오스 자쿰 ·
라이카 · 혼테일 · 대보스(뉴리프시티) · 영주 두꺼비(카에데 성) · 핑크빈 ·
타르가 & 스칼리온(신규 — 말레이시아 스푸키 월드, 7일 1회)
→ 옛메 참고값 기준 보스류 드랍률(자쿰·혼테일·파풀 15% 안팎)이 필드몹(0.3% 안팎)보다 월등히 높았습니다.
  보스 다니는 스펙이면 '주간 보스 로테이션 + 평시 필드 파밍' 병행이 기대값이 가장 큽니다.

■ 사냥터 추천 — 시간당 처치 수 기준 추론
★ 1순위 빛을잃은동굴1 (슬리피우드 던전) — 카파 드레이크 60젠 + 콜드아이 32젠.
  드랍 몹 2종이 한 맵에 92젠. Lv.45 물몹이라 원킬 스펙 만들기 쉽고, 혼줌 외 일반 드랍도 쏠쏠합니다.
  2순위로 빛을잃은동굴2(콜드아이 25 + 와일드카고 7)도 같은 동선에 있습니다.
★ 저레벨/부캐: 개미굴3~4 — 좀비버섯 62젠 + 짜증내는 좀비버섯 37젠, HP 500으로 어떤 직업이든 쓸어 담습니다.
  빅토리아 섬이라 접근성도 좋습니다.
★ 30~40대 본캐 성장 겸용: 에오스탑 중층(북치는 토끼) · 장난감공장(팬더테니) — 루디 PQ 동선과 겹쳐
  '차원의 균열(이번 패치로 금이 간 안경 20회로 하향)'과 병행하기 좋습니다.
★ 중레벨 겸사 파밍: 노란빛의정원2(라이오너 30젠) · 와일드카고의영역.
  90 이상은 깊은 바다 협곡(본피쉬)·난파선의 무덤(콜드샤크)·용의 숲(다크 코니언)이 경험치와 같이 갑니다.
★ 지나가다 챙기기: 태륜·스노우맨은 리젠 긴 미니보스라 '보이면 잡기' 정도로.

■ 왜 지금 파밍하나 (추론)
혼줌은 장비 공격력/스탯 옵션을 ±5 범위로 다시 굴리는 핵심 강화 재료라 수요가 꾸준합니다.
출시 직후가 시세가 가장 높게 형성되는 구간이라, 원킬 가능한 고밀도 맵(위 1~2순위)에서
초반에 파밍하는 편이 메소 효율이 좋습니다. 공급이 풀리면 시세는 내려갈 가능성이 큽니다.

※ 젠 수·HP는 GMS v92 원본 참고값입니다. 메이플랜드 실측과 다르면 제보 부탁드립니다.
※ 출처: 메이플랜드 10/8 공식 패치노트 (maple.land/board/notices/h0ifyesthgb4e79hecngkcgh)
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
