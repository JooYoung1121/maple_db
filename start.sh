#!/bin/bash
set -e

PORT="${PORT:-3000}"
API_PORT="${API_PORT:-8000}"

VOLUME_DB="/data/maple.db"
APP_DB="/app/data/maple.db"

echo "=== DB Sync ==="

if [ -d "/data" ]; then
  if [ -f "$VOLUME_DB" ]; then
    echo "Volume DB exists. Replacing quests table from seed..."

    # 퀘스트 테이블을 시드 DB 기준으로 완전 교체 (DROP+CREATE)
    # 다른 테이블은 절대 건드리지 않음
    python -c "
import sqlite3

VOLUME = '$VOLUME_DB'
SEED = '$APP_DB'

try:
    vol = sqlite3.connect(VOLUME)
    vol.execute(f\"ATTACH '{SEED}' AS seed\")

    # quests 테이블 완전 교체 (스키마 차이 문제 해결)
    vol.execute('DROP TABLE IF EXISTS quests')
    vol.execute('CREATE TABLE quests AS SELECT * FROM seed.quests')
    qcount = vol.execute('SELECT COUNT(*) FROM quests').fetchone()[0]

    # 검증: 조건 데이터가 제대로 들어왔는지
    sample = vol.execute(\"SELECT name, quest_conditions FROM quests WHERE name='버섯 몬스터를 연구하는 이유'\").fetchone()
    if sample:
        print(f'Sample: {sample[0]} -> {sample[1][:50]}')

    vol.execute('DETACH seed')
    vol.commit()
    vol.close()
    print(f'Quests replaced: {qcount} rows. Other tables untouched.')

except Exception as e:
    print(f'Quest sync error: {e}')
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
