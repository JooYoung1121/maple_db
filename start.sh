#!/bin/bash
set -e

PORT="${PORT:-3000}"
API_PORT="${API_PORT:-8000}"

VOLUME_DB="/data/maple.db"
APP_DB="/app/data/maple.db"

echo "=== DB Sync ==="

if [ -d "/data" ]; then
  if [ -f "$VOLUME_DB" ]; then
    echo "Volume DB exists. Replacing reference tables from seed..."

    # 레퍼런스 테이블만 시드 DB 기준으로 완전 교체 (DROP+CREATE)
    # 유저 데이터 테이블(bimae_posts, free_board_*, community_*, game_results 등)은 절대 건드리지 않음
    python -c "
import sqlite3

VOLUME = '$VOLUME_DB'
SEED = '$APP_DB'

# 시드에서 교체할 레퍼런스 테이블 화이트리스트 (유저 데이터 아님)
SEED_TABLES = ['quests', 'mob_drops', 'mob_spawns', 'sim_jobs', 'sim_skills', 'items', 'map_details', 'mapledb_quests']

try:
    vol = sqlite3.connect(VOLUME)
    vol.execute(f\"ATTACH '{SEED}' AS seed\")

    # 동기화 결과를 DB에 기록 — Railway 로그 없이 /api/admin/db-status로 원격 진단 가능
    vol.execute('CREATE TABLE IF NOT EXISTS seed_sync_log (ts TEXT, tbl TEXT, status TEXT, detail TEXT)')
    vol.execute('DELETE FROM seed_sync_log')
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    for tbl in SEED_TABLES:
        # 시드에 해당 테이블이 있을 때만 교체
        # 테이블 하나 실패해도 나머지는 계속 진행 (과거: map_details 실패 → 이후 전부 스킵되는 사고)
        try:
            exists = vol.execute(
                \"SELECT 1 FROM seed.sqlite_master WHERE type='table' AND name=?\", (tbl,)
            ).fetchone()
            if not exists:
                vol.execute('INSERT INTO seed_sync_log VALUES (?,?,?,?)', (now, tbl, 'missing_in_seed', ''))
                print(f'Seed table missing, skip: {tbl}')
                continue
            vol.execute(f'DROP TABLE IF EXISTS {tbl}')
            create_sql = vol.execute(
                \"SELECT sql FROM seed.sqlite_master WHERE type='table' AND name=?\", (tbl,)
            ).fetchone()[0]
            vol.execute(create_sql)
            vol.execute(f'INSERT INTO {tbl} SELECT * FROM seed.{tbl}')
            vol.commit()
            cnt = vol.execute(f'SELECT COUNT(*) FROM {tbl}').fetchone()[0]
            vol.execute('INSERT INTO seed_sync_log VALUES (?,?,?,?)', (now, tbl, 'ok', str(cnt)))
            print(f'Replaced {tbl}: {cnt} rows')
        except Exception as te:
            print(f'SEED SYNC FAIL [{tbl}]: {te!r}')
            try:
                vol.rollback()
            except Exception:
                pass
            try:
                vol.execute('INSERT INTO seed_sync_log VALUES (?,?,?,?)', (now, tbl, 'fail', repr(te)[:500]))
                vol.commit()
            except Exception:
                pass

    # entity_names_en은 관리자가 라이브에서 몹 한글명을 수정하므로 통째 교체 금지 —
    # 시드에만 있는 행을 추가만 한다 (기존 행은 INSERT OR IGNORE로 보존)
    try:
        added = vol.execute(
            'INSERT OR IGNORE INTO entity_names_en '
            '(entity_type, entity_id, name_en, source, source_url, last_crawled_at) '
            'SELECT entity_type, entity_id, name_en, source, source_url, last_crawled_at '
            'FROM seed.entity_names_en'
        ).rowcount
        print(f'entity_names_en: {added} rows added (additive only)')
    except Exception as ne:
        print(f'entity_names_en additive sync skip: {ne}')

    # mobs/maps는 관리자가 라이브에서 is_hidden 등을 수정할 수 있어 통째 교체 금지 —
    # 시드에만 있는 신규 행만 추가한다 (2026-09 에델슈타인 등 신규 지역 대응)
    for tbl in ['mobs', 'maps', 'npcs', 'skills']:
        try:
            cols = [r[1] for r in vol.execute(f'PRAGMA table_info({tbl})').fetchall()]
            col_list = ', '.join(cols)
            added = vol.execute(
                f'INSERT OR IGNORE INTO {tbl} ({col_list}) SELECT {col_list} FROM seed.{tbl}'
            ).rowcount
            print(f'{tbl}: {added} rows added (additive only)')
        except Exception as ne:
            print(f'{tbl} additive sync skip: {ne}')

    # 검증: 퀘스트 조건 데이터가 제대로 들어왔는지
    sample = vol.execute(\"SELECT name, quest_conditions FROM quests WHERE name='버섯 몬스터를 연구하는 이유'\").fetchone()
    if sample:
        print(f'Sample: {sample[0]} -> {sample[1][:50]}')

    vol.execute('DETACH seed')
    vol.commit()
    vol.close()
    print('Reference tables replaced. User tables untouched.')

except Exception as e:
    print(f'Seed sync error: {e}')
    import traceback
    traceback.print_exc()
" 2>&1

  else
    echo "No DB in volume, copying seed DB..."
    cp "$APP_DB" "$VOLUME_DB"
  fi

  rm -f "$APP_DB"
  ln -sf "$VOLUME_DB" "$APP_DB"
  echo "Symlink: $APP_DB -> $VOLUME_DB"
else
  echo "WARNING: No volume at /data"
fi

python -c "from crawler.db import init_db; init_db()" 2>/dev/null || true

# 정보공유 게시판 관리용 가이드 글 갱신 (--update: 시드 글만 최신본으로, 유저 글은 미접촉)
python scripts/seed_info_board_quest_guide.py --update 2>&1 || true
python scripts/seed_info_board_leafre_skyquest.py --update 2>&1 || true

if [ -f "/app/data/local_news_summaries.json" ]; then
  python -c "
import json
import sqlite3

DB = '$APP_DB'
SUMMARY_FILE = '/app/data/local_news_summaries.json'

try:
    with open(SUMMARY_FILE, encoding='utf-8') as f:
        payload = json.load(f)
    summaries = payload.get('summaries', [])
    conn = sqlite3.connect(DB)
    changed = 0
    for item in summaries:
        post_id = item.get('post_id')
        summary = item.get('summary')
        if not post_id or not summary:
            continue
        cur = conn.execute(
            \"\"\"UPDATE maple_land_posts
               SET summary = ?
               WHERE post_id = ?
                 AND (summary IS NULL OR summary = '')\"\"\",
            (summary, post_id),
        )
        changed += cur.rowcount
    conn.commit()
    conn.close()
    print(f'Local news summaries applied: {changed} rows')
except Exception as e:
    print(f'Local news summary sync error: {e}')
" 2>&1
fi

python -c "
import sqlite3
conn = sqlite3.connect('$APP_DB')
q = conn.execute('SELECT COUNT(*) FROM quests').fetchone()[0]
try:
    b = conn.execute('SELECT COUNT(*) FROM bimae_posts').fetchone()[0]
except:
    b = 'N/A'
print(f'=== Quests: {q} | Bimae: {b} ===')
conn.close()
" 2>/dev/null || echo "DB check failed"

echo "=== DB Sync Done ==="

echo "Starting FastAPI on port $API_PORT..."
uvicorn api.main:app --host 0.0.0.0 --port "$API_PORT" &
sleep 3

echo "Starting Next.js on port $PORT..."
cd web-standalone
HOSTNAME="0.0.0.0" PORT="$PORT" NEXT_PUBLIC_API_URL="http://localhost:$API_PORT" node server.js
