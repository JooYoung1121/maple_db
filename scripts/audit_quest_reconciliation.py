#!/usr/bin/env python3
"""Read-only quest reconciliation. Same name is a candidate, never auto-merge.

Print a JSON report for archived-name placeholders and suspicious imports.
Usage: .venv/bin/python scripts/audit_quest_reconciliation.py
"""
import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from crawler.config import DB_PATH


def inspect(conn):
    conn.row_factory = sqlite3.Row
    candidates = {}
    for r in conn.execute('SELECT quest_id, name, min_level, start_npc, requirements_json, rewards_json FROM mapledb_quests'):
        candidates.setdefault(''.join(r['name'].split()), []).append(dict(r))
    rows = []
    for raw in conn.execute('SELECT * FROM quests ORDER BY id'):
        q = dict(raw)
        reasons = []
        if '[배틀메이지 9/7 리서치]' in (q.get('note') or '') or q['area'] == '아모리아':
            reasons.append('신규 퀘스트 세부 조건·보상 대조 대상')
        if '드롭 아이템' in (q.get('quest_conditions') or ''):
            reasons.append('재료명 소실 (표시 시 격리; 마야는 별도 근거 복구)')
        if q.get('meso_reward') and 1 <= q['meso_reward'] <= 5:
            reasons.append('소액 메소 원문 대조 대기')
        if reasons:
            matches = candidates.get(''.join(q['name'].split()), [])
            rows.append({'id': q['id'], 'name': q['name'], 'reasons': reasons,
                         'canonical_candidates': matches, 'safe_to_auto_merge': False})
    return {'policy': '이름 일치는 후보일 뿐. NPC·레벨·선행·판본이 일치하고 메랜 원문 확인 전에는 자동 병합하지 않음.',
            'review_count': len(rows), 'with_name_candidates': sum(bool(r['canonical_candidates']) for r in rows), 'quests': rows}


if __name__ == '__main__':
    with sqlite3.connect(f'file:{DB_PATH}?mode=ro', uri=True) as conn:
        print(json.dumps(inspect(conn), ensure_ascii=False, indent=2))
