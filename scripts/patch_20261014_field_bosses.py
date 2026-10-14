"""2026-10-14 — 필드보스 노출 복구 (세르프 등 20종이 몬스터 목록·검색에서 빠져 있던 문제).

배경: crawler/cleanup.py 8) "보스와 동명의 일반 몹 숨김" 이 is_boss=1 인 복제 개체(무릉도장 9303xxx·카니발 9500xxx)를
정본으로 남기고 실제 필드 젠 개체(4220000 세르프 등, is_boss=0)를 숨겼다. 복제본은 화이트리스트 밖이라
검색·목록 어디에도 나오지 않아 "세르프가 사이트에 없다"로 보였다.

수행 (멱등):
- crawler.field_bosses.enforce_field_boss_visibility — 정본 30종 is_hidden=0·is_boss=1, 동명 복제본 is_hidden=1
- mob_spawns 보강: 대왕지네·포장마차·블루 머쉬맘·크림슨 발록 (메팁 DB monster_detail.maps 기준)
- 화이트리스트에 포장마차·블루 머쉬맘(mobs) · 오르비스행·도깨비집(maps) 추가 (reference + 개별 파일)
- 한글명 반영 + 검색 인덱스 재구축

실행: uv run --python 3.11 --no-project python scripts/patch_20261014_field_bosses.py
라이브는 기동 시 repair_field_boss_visibility + mob_spawns 시드 교체 + 레퍼런스 파일 배포로 반영된다.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from crawler.db import apply_mapleland_reference_names, get_connection, rebuild_search_index  # noqa: E402
from crawler.field_bosses import FIELD_BOSS_IDS, enforce_field_boss_visibility  # noqa: E402

REF_PATH = ROOT / "data" / "mapleland_reference.json"
MOBS_PATH = ROOT / "data" / "mapleland_mobs.json"

# 메팁 DB(matip.kr monster_detail) 의 출현 맵 — 우리 mob_spawns 에 없던 것만
SPAWN_FIX = {
    5220004: (251010102, "80년 된 약초밭"),
    8220009: (105090310, "드레이크의 영역"),
    8220007: (222010402, "도깨비집"),
    8150000: (200090010, "오르비스행"),
}
# 화이트리스트에 없던 필드보스 (메팁 DB 수록 · 메랜 출현 확인)
WHITELIST_ADD = [
    {"id": 8220009, "name_kr": "포장마차", "level": 85, "hp": 110000},
    {"id": 8220007, "name_kr": "블루 머쉬맘", "level": 90, "hp": 135000},
]

# 스폰 맵이 맵 화이트리스트 밖이라 몬스터 상세의 출현 맵에서 걸러지던 것 (배 안 · 도깨비집)
MAP_WHITELIST_ADD = [
    {"id": 200090010, "name_kr": "오르비스행"},
    {"id": 222010402, "name_kr": "히든스트리트: 도깨비집"},
]
MAPS_PATH = ROOT / "data" / "mapleland_maps.json"


def _extend_whitelist(path: Path, kind: str, additions: list[dict]) -> None:
    payload = json.loads(path.read_text(encoding="utf-8"))
    standalone = kind in payload
    records = payload[kind] if standalone else payload["entities"][kind]["records"]
    known = {int(r["id"]) for r in records}
    new = [r for r in additions if r["id"] not in known]
    if new:
        records.extend(new)
        if standalone:
            payload["total"] = len(records)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{path.name} {kind}: 화이트리스트 추가 {len(new)}건 (총 {len(records)})")


def main() -> None:
    conn = get_connection()
    try:
        result = enforce_field_boss_visibility(conn)
        print(f"필드보스 노출 보정: {result}")
        added = 0
        for mob_id, (map_id, map_name) in SPAWN_FIX.items():
            if not conn.execute("SELECT 1 FROM maps WHERE id=?", (map_id,)).fetchone():
                print(f"  맵 없음, 건너뜀: {mob_id} → {map_id}")
                continue
            added += conn.execute(
                "INSERT OR IGNORE INTO mob_spawns (mob_id, map_id, map_name, spawn_count) VALUES (?,?,?,NULL)",
                (mob_id, map_id, map_name),
            ).rowcount or 0
        conn.commit()
        print(f"mob_spawns 추가: {added}행")

        for path in (REF_PATH, MOBS_PATH):
            _extend_whitelist(path, "mobs", WHITELIST_ADD)
        for path in (REF_PATH, MAPS_PATH):
            _extend_whitelist(path, "maps", MAP_WHITELIST_ADD)

        apply_mapleland_reference_names(conn)
        rebuild_search_index(conn)
        conn.commit()

        rows = conn.execute(
            f"SELECT COUNT(*) FROM mobs WHERE id IN ({','.join('?'*len(FIELD_BOSS_IDS))}) "
            "AND COALESCE(is_hidden,0)=0 AND is_boss=1",
            tuple(FIELD_BOSS_IDS),
        ).fetchone()[0]
        print(f"노출 중인 필드보스 정본: {rows}/{len(FIELD_BOSS_IDS)}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
