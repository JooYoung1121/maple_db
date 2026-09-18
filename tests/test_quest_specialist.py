"""퀘스트 스페셜리스트 가이드 엔드포인트 — 격리 DB 계약 테스트."""
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routes import quests


def _quest(quest_id, name, requirements, prereq=None, nxt=None, min_level=0, exp=0):
    return (
        quest_id, name, 0, min_level, None, 0, None,
        None, None, None, None, exp, 0, 0,
        json.dumps(prereq or []), json.dumps(nxt or []),
        json.dumps(requirements), "[]", None,
    )


class QuestSpecialistGuideTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "test.db"
        conn = self.connection()
        conn.executescript(
            """
            CREATE TABLE mapledb_quests (
                quest_id INTEGER PRIMARY KEY, name TEXT NOT NULL,
                repeatable INTEGER DEFAULT 0, min_level INTEGER DEFAULT 0, max_level INTEGER,
                req_meso INTEGER DEFAULT 0, jobs TEXT,
                start_npc_id INTEGER, start_npc TEXT, end_npc_id INTEGER, end_npc TEXT,
                exp INTEGER DEFAULT 0, meso INTEGER DEFAULT 0, fame INTEGER DEFAULT 0,
                prereq_json TEXT, next_json TEXT, requirements_json TEXT, rewards_json TEXT,
                crawled_at TEXT
            );
            """
        )
        conn.executemany(
            "INSERT INTO mapledb_quests VALUES (" + ",".join(["?"] * 19) + ")",
            [
                # 전달형: 몹 드랍 아이템만 요구 → deliver_only 포함
                _quest(1, "전달형", [
                    {"type": "item", "id": 4000015, "name": "뿔버섯의 갓", "raw": "뿔버섯의 갓 120개 전달"},
                ]),
                # 퀘스트 전용 아이템(4031xxx) → deliver_only 제외
                _quest(2, "퀘템 전달", [
                    {"type": "item", "id": 4031000, "name": "마리아의 편지", "raw": "마리아의 편지 1개 전달"},
                ]),
                # 수량 0 파싱 아티팩트 → deliver_only 제외
                _quest(3, "수량 0", [
                    {"type": "item", "id": 2010007, "name": "로저의 사과", "raw": "로저의 사과 0개 전달"},
                ]),
                # 체인 3개: 4 → 5 → 6, 아이템 총량 합산 + 몹 처치 포함
                _quest(4, "체인 시작", [
                    {"type": "item", "id": 4000020, "name": "송곳니", "raw": "송곳니 100개 전달"},
                ], nxt=[[5, "체인 중간"]], min_level=30, exp=100),
                _quest(5, "체인 중간", [
                    {"type": "item", "id": 4000020, "name": "송곳니", "raw": "송곳니 50개 전달"},
                    {"type": "mob", "id": 2230100, "name": "이블아이", "raw": "이블아이 50마리 처치"},
                ], prereq=[[4, "체인 시작"]], nxt=[[6, "체인 끝"]], min_level=40, exp=200),
                _quest(6, "체인 끝", [
                    {"type": "mob", "id": 2230100, "name": "이블아이", "raw": "이블아이 30마리 처치"},
                ], prereq=[[5, "체인 중간"]], min_level=45, exp=300),
                # 몹 시너지: 6번과 같은 몹을 요구하는 독립 퀘스트
                _quest(7, "이블아이 의뢰", [
                    {"type": "mob", "id": 2230100, "name": "이블아이", "raw": "이블아이 10마리 처치"},
                ], min_level=35),
            ],
        )
        conn.commit()
        conn.close()

        app = FastAPI()
        app.include_router(quests.router, prefix="/api")
        self.patcher = patch("api.routes.quests.get_connection", self.connection)
        self.patcher.start()
        self.client = TestClient(app)

    def tearDown(self):
        self.patcher.stop()
        self.temp.cleanup()

    def connection(self):
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    def guide(self):
        res = self.client.get("/api/quests/specialist/guide")
        self.assertEqual(res.status_code, 200)
        return res.json()

    def test_deliver_only_excludes_quest_items_and_zero_counts(self):
        names = [q["name"] for q in self.guide()["deliver_only"]]
        self.assertIn("전달형", names)
        self.assertNotIn("퀘템 전달", names)   # 4031xxx 퀘스트 전용 대역
        self.assertNotIn("수량 0", names)      # 수량 파싱 아티팩트
        self.assertNotIn("체인 중간", names)   # 몹 처치 요구 포함
        entry = next(q for q in self.guide()["deliver_only"] if q["name"] == "전달형")
        self.assertEqual(entry["items"], [{"id": 4000015, "name": "뿔버섯의 갓", "count": 120}])

    def test_chain_aggregates_prep_items_and_kills(self):
        chains = self.guide()["chains"]
        self.assertEqual(len(chains), 1)
        chain = chains[0]
        self.assertEqual(chain["quest_count"], 3)
        self.assertEqual(chain["title"], "체인 시작 → 체인 끝")
        self.assertEqual(chain["min_level"], 30)
        self.assertEqual(chain["total_exp"], 600)
        self.assertEqual(chain["prep_items"], [{"id": 4000020, "name": "송곳니", "count": 150}])
        self.assertEqual(chain["mob_kills"], [{"id": 2230100, "name": "이블아이", "count": 80}])

    def test_mob_synergy_groups_shared_mobs(self):
        synergy = self.guide()["mob_synergy"]
        self.assertEqual(len(synergy), 1)
        self.assertEqual(synergy[0]["id"], 2230100)
        self.assertEqual(
            [q["name"] for q in synergy[0]["quests"]],
            ["이블아이 의뢰", "체인 중간", "체인 끝"],  # min_level 순 정렬
        )


if __name__ == "__main__":
    unittest.main()
