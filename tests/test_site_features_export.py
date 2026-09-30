"""siteFeatures.ts ↔ data/site_features.json 동기화 검사.

siteFeatures.ts(사이트 기능 정본 카탈로그)를 고치고 export 를 재실행하지 않으면
챗봇 링크 규칙이 낡은 채로 남는다 — 이 테스트가 그 드리프트를 잡는다.
불일치 시: python3 scripts/export_site_features.py 재실행 후 JSON 커밋.
"""
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load_export_module():
    spec = importlib.util.spec_from_file_location(
        "export_site_features", ROOT / "scripts" / "export_site_features.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class SiteFeaturesExportSyncTest(unittest.TestCase):
    def test_committed_json_matches_ts_catalog(self):
        module = _load_export_module()
        ts_text = (ROOT / "web" / "lib" / "siteFeatures.ts").read_text(encoding="utf-8")
        fresh = module.parse_features(ts_text)

        href_count = ts_text.count('href: "')
        self.assertEqual(
            len(fresh), href_count,
            "siteFeatures.ts 항목이 한 줄 리터럴 컨벤션을 벗어나 파싱에서 빠졌습니다 — "
            "scripts/export_site_features.py 의 FEATURE_RE 를 확인하세요.",
        )

        committed = json.loads(
            (ROOT / "data" / "site_features.json").read_text(encoding="utf-8")
        )
        self.assertEqual(
            fresh, committed,
            "siteFeatures.ts 가 변경됐습니다 — python3 scripts/export_site_features.py "
            "를 재실행하고 data/site_features.json 을 함께 커밋하세요.",
        )


if __name__ == "__main__":
    unittest.main()
