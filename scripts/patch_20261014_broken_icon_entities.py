"""2026-10-14 — 아이콘 원본(maplestory.io)이 404 인 엔티티 숨김 처리.

배경: 사이트 전반 썸네일 점검에서 items/mobs/npcs 17,661건의 icon_url 을 전수 요청한 결과
아이템 128 · 몹 76 · NPC 132건이 영구 404 였다. 몹 75건은 이미 hidden 이었고, 실제로 화면에
새어 나오던 것은 (1) 코디 시뮬레이터의 아이템 31종(레퍼런스 필터 미적용) (2) 보스 목록의
이벤트 고스텀프 (3) NPC 목록·NPC 퀴즈의 마네키네코 4종이었다.

수행:
- items 128종 · mobs 1종 is_hidden=1 (crawler.audit_repairs.repair_broken_icon_entities 와 동일 로직)
- data/mapleland_reference.json npcs.records 에서 마네키네코 4종 제거

실행: uv run --python 3.11 --no-project python scripts/patch_20261014_broken_icon_entities.py
멱등. 라이브는 기동 시 repair + 시드 동기화 + 레퍼런스 파일 배포로 반영된다.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from crawler.audit_repairs import repair_broken_icon_entities  # noqa: E402
from crawler.broken_icons import BROKEN_ICON_NPC_IDS  # noqa: E402
from crawler.db import get_connection  # noqa: E402

REF_PATH = ROOT / "data" / "mapleland_reference.json"


def main() -> None:
    conn = get_connection()
    try:
        changed = repair_broken_icon_entities(conn)
        print(f"is_hidden 적용: {changed}행")
    finally:
        conn.close()

    payload = json.loads(REF_PATH.read_text(encoding="utf-8"))
    records = payload["entities"]["npcs"]["records"]
    before = len(records)
    drop = set(BROKEN_ICON_NPC_IDS)
    payload["entities"]["npcs"]["records"] = [r for r in records if int(r["id"]) not in drop]
    removed = before - len(payload["entities"]["npcs"]["records"])
    if removed:
        REF_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"레퍼런스 NPC 제거: {removed}건 ({before} → {before - removed})")


if __name__ == "__main__":
    main()
