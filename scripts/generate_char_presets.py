#!/usr/bin/env python3
"""구인구직 카드 직업 프리셋 캐릭터 생성.

maplestory.io 캐릭터 렌더(GMS v92 — 코디 시뮬레이터와 동일 방식)로
직업별 상징 장비(자쿰 투구 + 타임리스 무기·한벌옷)를 입힌 스프라이트를
정적 자산(web/public/recruit-card/char-*.png)으로 굽는다.

카드 캐릭터 존(약 460×560)에 맞게 resize=5 로 크게 렌더한다.
사용: python3 scripts/generate_char_presets.py
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "recruit-card"

SKIN = 2000          # 기본 피부 (몸 2000 + 머리 12000)
FACE = 20000         # 기본 얼굴
HAIR = 30020         # 블랙 레벨컷 (삐죽머리)

ZAKUM_HELM = 1002357
GUILTIAN = 1002154   # 다크 길티언 (배메용)
# 타임리스 모자 (직업군별)
HAT = {"archer": 1002778, "thief": 1002779, "mage": 1002777, "pirate": 1002780}

# 타임리스 한벌옷
OVERALL = {"warrior": 1052155, "archer": 1052157, "thief": 1052158, "mage": 1052156, "pirate": 1052159}

# key → (라벨, [장비 ids], 포즈)
PRESETS: dict[str, tuple[str, list[int], str]] = {
    "hero":        ("히어로",       [ZAKUM_HELM, OVERALL["warrior"], 1402046], "stand2"),  # 타임리스 니플하임(두손검)
    "darkknight":  ("다크나이트",   [ZAKUM_HELM, OVERALL["warrior"], 1432047], "stand2"),  # 알슈피스(창)
    "paladin":     ("팔라딘",       [ZAKUM_HELM, OVERALL["warrior"], 1322060], "stand1"),  # 알라르간도(둔기)
    "bowmaster":   ("보우마스터",   [HAT["archer"], OVERALL["archer"], 1452057], "alert"),               # 엔가우(활)
    "marksman":    ("신궁",         [HAT["archer"], OVERALL["archer"], 1462050], "alert"),               # 블랙뷰티(석궁)
    "nightlord":   ("나이트로드",   [HAT["thief"], OVERALL["thief"], 1472068], "alert"),                # 람피온(클로)
    "shadower":    ("섀도어",       [HAT["thief"], OVERALL["thief"], 1332073], "stand1"),                # 페스카즈(단검)
    "archmage":    ("아크메이지",   [HAT["mage"], OVERALL["mage"], 1372044], "stand1"),                 # 엔릴 티어(완드)
    "bishop":      ("비숍",         [HAT["mage"], OVERALL["mage"], 1382057], "alert"),                 # 에아스 핸드(스태프)
    "viper":       ("바이퍼",       [HAT["pirate"], OVERALL["pirate"], 1482013], "alert"),               # 용아주조(너클)
    "captain":     ("캡틴",         [HAT["pirate"], OVERALL["pirate"], 1492013], "alert"),               # 드래곤 세인트(건)
    "battlemage":  ("배틀메이지",   [GUILTIAN, OVERALL["mage"], 1382057], "alert"),       # v92 대체 코디
}


def render_url(item_ids: list[int], pose: str) -> str:
    ids = [SKIN, SKIN + 10000, FACE, HAIR, *item_ids]
    entries = ",".join(
        urllib.parse.quote(json.dumps({"itemId": i, "region": "GMS", "version": "92"}))
        for i in ids
    )
    return f"https://maplestory.io/api/character/{entries}/{pose}/0?resize=5"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for key, (label, items, pose) in PRESETS.items():
        url = render_url(items, pose)
        path = OUT / f"char-{key}.png"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "maple-db-preset-baker"})
            with urllib.request.urlopen(req, timeout=30) as res:
                data = res.read()
            if len(data) < 500:
                print(f"! {label}: 응답이 비정상적으로 작음 ({len(data)}B) — 스킵")
                continue
            path.write_bytes(data)
            print(f"✓ {label} ({key}): {len(data):,}B")
        except Exception as e:
            print(f"! {label}: 실패 — {e}")
        time.sleep(0.5)


if __name__ == "__main__":
    main()
