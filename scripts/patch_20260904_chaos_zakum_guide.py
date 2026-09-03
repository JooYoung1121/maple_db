#!/usr/bin/env python3
"""카오스 자쿰 공략(길드 정보공유 post 5)에 '파츠별 패턴 · 타이밍' 섹션 추가.

공략글은 프로덕션 DB에만 있어(admin PATCH 흐름, 커밋 783e27d 참고) 라이브 API로 갱신한다.
현재 본문을 받아 '■ 공대 구성 예시' 앞에 신규 섹션을 끼워 넣는 방식 — 기존 내용은 그대로 보존.

출처:
- 아카라이브 메이플랜드 채널 카오스 자쿰 공략 (arca.live/b/mapleland/177722971, 2026-07-23)
  · 좌4·우4팔 버프해제 / 좌2팔 단체유혹 (팔 패턴 그림 검증)
  · 단체유혹: 페이즈 시작 90초 후 첫 시전, 이후 30~180초 무작위 · 입장순서 5명 · 우측 고정
  · 몸통 벞해: 1페 없음 / 2페 HP 50%부터 2분 간격 / 3페 30~180초 무작위 (스크린샷 검증)
- 유앤나PLAY 공략 영상 2편 (팔 페이즈 helkVg-aw5E · 본 페이즈 aB0WbgoCjjw)

  python3 scripts/patch_20260904_chaos_zakum_guide.py --dry-run   # 갱신될 본문 미리보기
  GAME_ADMIN_PASSWORD=... python3 scripts/patch_20260904_chaos_zakum_guide.py   # 라이브 반영
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request

API_BASE = os.environ.get("MAPLEDB_API_BASE", "https://memorymapledb.up.railway.app")
POST_ID = 5
MARKER = "■ 파츠별 패턴 · 타이밍"  # 이미 반영됐으면 재실행해도 중복 삽입하지 않는다
ANCHOR = "■ 공대 구성 예시"  # 이 섹션 바로 앞에 삽입

NEW_SECTION = """■ 파츠별 패턴 · 타이밍 정리 (커뮤니티 실측 — 2026-07 아카라이브 메랜채널 공략 + 유앤나PLAY 영상 기준)

[팔 8개 — 좌1~4 · 우1~4]
- 좌4팔 · 우4팔: 버프해제 (무작위 수시 시전 — 최우선 격파 대상. ⚠️ 공식 공지엔 좌4 벞해가 없다고 되어 있으나 실서버에선 좌4도 사용 — 공지가 틀림)
- 좌2팔: 단체유혹
- 나머지 팔(좌1·3, 우1~3): 일반 공격만
- 격파 순서는 공대 유파에 따라 둘 다 통용:
  ① 원격팟 좌4 스타트 → 우4 → 좌3·2·1 / 히어로팟 우2 발판에서 우1·2·3 3타겟 후 좌측 합류 (아카 공략)
  ② 전원 우측 스타트 → 우상단(우3·4, 4팔 메인) → 좌상단(좌3·4) → 좌하단(좌1·2) (본 헤딩팟 — 아래 동선 참고)
  어느 쪽이든 핵심은 벞해팔(좌4·우4)을 1초라도 빨리 없애는 것 — 영메·공도핑을 여기에 쓴다
- 벞해팔 제거 전: 비숍·닼나는 힐/버스터 금지, 뻥(하이퍼바디)·가드만 연타 (혼테일 다리스타트와 동일 요령)

[단체유혹 — 팔페·몸페 공통]
- 입장순서 앞 5명 대상, 혼테일과 달리 무조건 "우측"으로 걸음 → 유혹 순번은 우측에서 딜
- 몸페: 각 페이즈 시작 90초 후 첫 시전, 이후 30~180초 무작위
- 2.0 변경: 피격 시 무조건 좌측으로 밀림(1.0은 좌우 랜덤) — 우측딜 인원은 몸통 몸박 주의

[몸통 버프해제 타이밍]
- 1페: 벞해 없음 (사실상 휴식 구간)
- 2페: HP 50% 시점부터 약 2분 간격 — 예상 시점 5초 전부터 뻥·가드 대기하면 무난
- 3페: 진입 후 30~180초 무작위 — 마지막 벞해 30초 후부터는 힐/버스터를 멈추고 대기
- 벞해는 영웅의 메아리를 제외한 모든 버프를 지움. 벞해+단유가 겹칠 때가 최위험 — 힐케숍 사망 시 즉시 교체 콜, 예비숍은 힐케숍 근처(50픽셀 이내) 대기, 단유 대상자는 용사의 의지로 탈출
- 불기둥·1/1·스톤(석화) 번개는 일반 자쿰과 동일 (좌측 돌기둥 무적존 활용)

※ 위 주기 수치는 사이트 보스 타이머(/boss-timer?boss=chaos-zakum)에 프리셋으로 들어 있습니다 — 공유 방을 만들어 공대원과 같이 쓰세요.
※ 참고: 아카라이브 메랜채널 카쿰 공략(arca.live/b/mapleland/177722971) · 유앤나PLAY 영상 — 팔 페이즈(youtu.be/helkVg-aw5E) / 본 페이즈(youtu.be/aB0WbgoCjjw)

"""


def fetch_post() -> dict:
    with urllib.request.urlopen(f"{API_BASE}/api/guild/info/posts/{POST_ID}", timeout=30) as r:
        return json.load(r)


def patch_post(content: str, admin_pw: str) -> None:
    req = urllib.request.Request(
        f"{API_BASE}/api/guild/info/posts/{POST_ID}",
        data=json.dumps({"content": content}, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", "X-Admin-Password": admin_pw},
        method="PATCH",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        print("PATCH:", json.load(r))


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    post = fetch_post()
    content = post.get("content") or post.get("post", {}).get("content", "")
    if not content:
        sys.exit("본문을 가져오지 못했습니다 — API 응답 구조 확인 필요")
    if MARKER in content:
        print("이미 반영되어 있습니다 — 변경 없음")
        return
    if ANCHOR not in content:
        sys.exit(f"삽입 위치({ANCHOR})를 찾지 못했습니다 — 본문 구조가 바뀐 듯. 수동 확인 필요")

    new_content = content.replace(ANCHOR, NEW_SECTION + ANCHOR, 1)

    if dry_run:
        print(new_content)
        print(f"\n--- {len(content)}자 → {len(new_content)}자 (dry-run, 반영 안 함) ---")
        return

    admin_pw = os.environ.get("GAME_ADMIN_PASSWORD", "")
    if not admin_pw:
        sys.exit("GAME_ADMIN_PASSWORD 환경변수가 필요합니다")
    patch_post(new_content, admin_pw)
    print("완료 — 카오스 자쿰 공략에 파츠별 패턴 섹션이 추가되었습니다")


if __name__ == "__main__":
    main()
