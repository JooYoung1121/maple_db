"""sim_skills ↔ web/data/skillLevels.json 동기화 검사.

sim_skills(스킬 시뮬 DB)나 jobSkillData.ts 액티브 목록이 바뀌었는데 export 를
재실행하지 않으면 체경비/엔방컷 스킬 레벨 수치가 낡은 채로 남는다.
불일치 시: python3 scripts/export_skill_levels.py 재실행 후 JSON 커밋.
"""
import importlib.util
import json
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load_module():
    spec = importlib.util.spec_from_file_location(
        "export_skill_levels", ROOT / "scripts" / "export_skill_levels.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class SkillLevelsExportSyncTest(unittest.TestCase):
    def test_committed_json_matches_db(self):
        module = _load_module()
        ts = (ROOT / "web" / "lib" / "jobSkillData.ts").read_text(encoding="utf-8")
        conn = sqlite3.connect(f"file:{ROOT / 'data' / 'maple.db'}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        fresh, _fallback, _diffs = module.build_output(ts, conn)
        conn.close()

        committed = json.loads(
            (ROOT / "web" / "data" / "skillLevels.json").read_text(encoding="utf-8")
        )
        self.assertEqual(
            fresh, committed,
            "sim_skills 또는 jobSkillData.ts 가 변경됐습니다 — "
            "python3 scripts/export_skill_levels.py 재실행 후 web/data/skillLevels.json 을 커밋하세요.",
        )

    def test_pinned_ids_exist_and_are_cygnus_rows(self):
        module = _load_module()
        conn = sqlite3.connect(f"file:{ROOT / 'data' / 'maple.db'}?mode=ro", uri=True)
        for name, sid in module.PINNED.items():
            row = conn.execute(
                "SELECT id FROM sim_skills WHERE id=?", (sid,)
            ).fetchone()
            self.assertIsNotNone(row, f"PINNED {name} → {sid} 행이 sim_skills에 없습니다")
            self.assertGreaterEqual(sid, 10_000_000, f"{name}: 시그너스 대역 ID가 아닙니다")
        conn.close()


if __name__ == "__main__":
    unittest.main()
