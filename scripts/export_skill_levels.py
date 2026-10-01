#!/usr/bin/env python3
"""sim_skills.level_properties → web/data/skillLevels.json (체경비 스킬 레벨 계산용).

web/lib/jobSkillData.ts 의 액티브 스킬(만렙 단일값 하드코딩)에 레벨별 수치를 입히기 위해
스킬 시뮬 DB(sim_skills, KMST 원본 크롤)에서 레벨별 damage%/타격 수/대상 수를 뽑아낸다.

매칭 규칙 (2026-10-01 전수 대조로 확정):
- 이름 공백 제거 완전일치. 괄호 변형("차지블로우 (파이어)")은 괄호를 떼고 매칭 —
  속성별 가이드 수치는 DB에 없어 네 변형이 같은 레벨 배열을 공유한다.
- 무기 접미 변형("애로우 봄 : 활")은 접미를 뗀 이름으로도 색인.
- 표기 차이는 ALIASES 로 명시 (슬래시블래스트↔슬래시 블러스트 등).
- 동명 스킬(모험가/시그너스)은 모험가(id < 10,000,000) 우선.
- 마법 스킬의 데미지%는 'damage' 가 아니라 'mad' 키에 있다.
- DB에 없는 스킬(4차 일부·해적 다수)은 JSON에서 빠지고, 프론트가 하드코딩
  만렙값 선형 보간으로 폴백한다 (web/lib/skillLevels.ts).

주의: 하드코딩 만렙값과 DB 만렙값이 다른 스킬이 있다(예: 차지 블로우 120%→DB 250%).
DB(KMST 크롤)를 정본으로 쓰며, 차이 목록은 실행 리포트로 출력한다.

사용: python3 scripts/export_skill_levels.py   (web/data/skillLevels.json 갱신)
tests/test_skill_levels_export.py 가 커밋본과의 동기화를 검사한다.
"""
from __future__ import annotations

import json
import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "maple.db"
TS_PATH = ROOT / "web" / "lib" / "jobSkillData.ts"
OUT_PATH = ROOT / "web" / "data" / "skillLevels.json"

# 하드코딩 표기 → sim_skills 표기
ALIASES = {
    "슬래시블래스트": "슬래시 블러스트",
    "썬더 볼트": "선더 볼트",
    "피어싱 애로우": "피어싱",
    "부메랑스텝": "부메랑 스탭",
}

# 괄호 제거 시 다른 직업 스킬과 충돌하는 것 — 매칭하지 않고 하드코딩 폴백 유지
# (신궁 '블리자드(석궁)'는 sim_skills에 없고, 괄호를 떼면 아크메이지 블리자드(600%)에 오매칭)
EXCLUDE = {"블리자드(석궁)"}

ACTIVE_RE = re.compile(
    r'\{ name: "(?P<name>[^"]+)", damage: (?P<damage>\d+), hits: (?P<hits>\d+)'
    r"(?:, mobs: (?P<mobs>\d+))?"
)
WEAPON_SUFFIX_RE = re.compile(r"^(.*?):(활|석궁|검|둔기)$")


def norm(s: str) -> str:
    return re.sub(r"\s+", "", s)


def build_index(conn) -> dict[str, list]:
    index: dict[str, list] = {}
    for r in conn.execute("SELECT id, name, master_level, level_properties FROM sim_skills"):
        n = norm(r["name"])
        index.setdefault(n, []).append(r)
        m = WEAPON_SUFFIX_RE.match(n)
        if m:
            index.setdefault(m.group(1), []).append(r)
    return index


def parse_levels(row, hard_hits: int, hard_mobs: int) -> list[dict] | None:
    try:
        props = json.loads(row["level_properties"] or "[]")
    except Exception:
        return None
    levels = []
    for p in props:
        raw = p.get("damage") or p.get("mad")
        try:
            damage = float(raw)
        except (TypeError, ValueError):
            damage = 0.0
        levels.append({
            "damage": damage,
            "hits": int(p.get("attackCount") or hard_hits),
            "mobs": int(p.get("mobCount") or hard_mobs),
        })
    if not levels or all(lv["damage"] <= 0 for lv in levels):
        return None
    return levels


def main() -> int:
    ts = TS_PATH.read_text(encoding="utf-8")
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    index = build_index(conn)

    out: dict[str, dict] = {}
    fallback: list[str] = []
    diffs: list[str] = []
    seen: set[str] = set()
    for m in ACTIVE_RE.finditer(ts):
        name = m.group("name")
        if name in seen:
            continue
        seen.add(name)
        if name in EXCLUDE:
            fallback.append(name)
            continue
        hard_damage = int(m.group("damage"))
        hard_hits = int(m.group("hits"))
        hard_mobs = int(m.group("mobs") or 1)

        base = re.sub(r"\s*\(.*\)$", "", name)
        key = norm(ALIASES.get(base, ALIASES.get(name, base)))
        cands = index.get(key)
        if not cands:
            fallback.append(name)
            continue
        row = sorted(cands, key=lambda r: (r["id"] >= 10_000_000, r["id"]))[0]
        levels = parse_levels(row, hard_hits, hard_mobs)
        if not levels:
            fallback.append(name)
            continue
        out[name] = {"sourceId": row["id"], "maxLevel": len(levels), "levels": levels}
        if abs(levels[-1]["damage"] - hard_damage) > 0.5:
            diffs.append(f"{name}: 하드코딩 {hard_damage}% → DB {levels[-1]['damage']:g}%")

    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{OUT_PATH.name}: {len(out)}개 스킬 레벨 곡선 내보냄 / 폴백 {len(fallback)}개")
    if fallback:
        print("  폴백(하드코딩 보간 사용):", ", ".join(fallback))
    if diffs:
        print("  만렙값 상이(DB 정본 채택):")
        for d in diffs:
            print("   -", d)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
