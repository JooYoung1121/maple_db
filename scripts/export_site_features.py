#!/usr/bin/env python3
"""web/lib/siteFeatures.ts(사이트 기능 정본 카탈로그) → data/site_features.json 내보내기.

디스코드/카카오 챗봇의 사이트 링크 규칙이 siteFeatures.ts 와 따로 하드코딩돼
신규 페이지가 봇에 반영되지 않는 문제(2026-09-29 감사: 74개 중 42개 미연동)의 해소용.
챗봇은 이 JSON 을 로드해 링크 규칙을 자동 생성한다 (api/chatbot_service.py).

siteFeatures.ts 의 항목 오브젝트는 한 줄 리터럴 컨벤션이라 정규식으로 파싱한다.
파싱 수와 href: 출현 수가 다르면(컨벤션 이탈) 실패로 종료한다 —
tests/test_site_features_export.py 가 커밋된 JSON 과의 동기화를 검사한다.

사용: python3 scripts/export_site_features.py   (data/site_features.json 갱신)
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TS_PATH = ROOT / "web" / "lib" / "siteFeatures.ts"
OUT_PATH = ROOT / "data" / "site_features.json"

FEATURE_RE = re.compile(
    r'\{\s*href:\s*"(?P<href>[^"]+)"\s*,\s*label:\s*"(?P<label>[^"]+)"'
    r'(?:\s*,\s*homeLabel:\s*"(?P<home>[^"]+)")?'
    r'(?P<rest>[^}]*)\}'
)
KEYWORDS_RE = re.compile(r'keywords:\s*\[(?P<body>[^\]]*)\]')
DESC_RE = re.compile(r'description:\s*"(?P<desc>[^"]*)"')


def parse_features(text: str) -> list[dict]:
    features: list[dict] = []
    for m in FEATURE_RE.finditer(text):
        rest = m.group("rest")
        keywords: list[str] = []
        km = KEYWORDS_RE.search(rest)
        if km:
            keywords = [k.strip().strip('"') for k in km.group("body").split(",") if k.strip().strip('"')]
        dm = DESC_RE.search(rest)
        features.append({
            "href": m.group("href"),
            "label": m.group("label"),
            "homeLabel": m.group("home"),
            "description": dm.group("desc") if dm else None,
            "keywords": keywords,
        })
    return features


def main() -> int:
    text = TS_PATH.read_text(encoding="utf-8")
    features = parse_features(text)
    href_count = len(re.findall(r'\bhref:\s*"', text))
    if len(features) != href_count:
        print(
            f"파싱 불일치: href {href_count}개 중 {len(features)}개만 파싱됨 — "
            "siteFeatures.ts 항목이 한 줄 리터럴 컨벤션을 벗어났는지 확인하세요.",
            file=sys.stderr,
        )
        return 1
    OUT_PATH.write_text(
        json.dumps(features, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    print(f"{OUT_PATH.name}: {len(features)}개 기능 내보냄")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
