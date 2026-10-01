"""sim_skills ↔ web/data/skillLevels.json 동기화 검사.

sim_skills(스킬 시뮬 DB)나 jobSkillData.ts 액티브 목록이 바뀌었는데 export 를
재실행하지 않으면 체경비 스킬 레벨 수치가 낡은 채로 남는다.
불일치 시: python3 scripts/export_skill_levels.py 재실행 후 JSON 커밋.
"""
import importlib.util
import json
import unittest
from pathlib import Path
from unittest.mock import patch

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
        out = ROOT / "web" / "data" / "skillLevels.json"
        committed = json.loads(out.read_text(encoding="utf-8"))
        with patch.object(module, "OUT_PATH", Path("/dev/null")) as _:
            # main()은 파일을 쓰므로 /dev/null 로 돌리고, 결과는 다시 생성해 비교
            pass
        # 간단·안전하게: 파서 로직을 직접 돌려 fresh 결과 생성
        import re
        import sqlite3

        ts = (ROOT / "web" / "lib" / "jobSkillData.ts").read_text(encoding="utf-8")
        conn = sqlite3.connect(f"file:{ROOT / 'data' / 'maple.db'}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        index = module.build_index(conn)
        fresh: dict = {}
        seen: set = set()
        for m in module.ACTIVE_RE.finditer(ts):
            name = m.group("name")
            if name in seen:
                continue
            seen.add(name)
            if name in module.EXCLUDE:
                continue
            base = re.sub(r"\s*\(.*\)$", "", name)
            key = module.norm(module.ALIASES.get(base, module.ALIASES.get(name, base)))
            cands = index.get(key)
            if not cands:
                continue
            row = sorted(cands, key=lambda r: (r["id"] >= 10_000_000, r["id"]))[0]
            levels = module.parse_levels(
                row, int(m.group("hits")), int(m.group("mobs") or 1)
            )
            if not levels:
                continue
            fresh[name] = {
                "sourceId": row["id"], "maxLevel": len(levels), "levels": levels,
            }
        conn.close()
        self.assertEqual(
            fresh, committed,
            "sim_skills 또는 jobSkillData.ts 가 변경됐습니다 — "
            "python3 scripts/export_skill_levels.py 재실행 후 web/data/skillLevels.json 을 커밋하세요.",
        )


if __name__ == "__main__":
    unittest.main()
