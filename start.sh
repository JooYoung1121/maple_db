#!/bin/bash
set -e

PORT="${PORT:-3000}"
API_PORT="${API_PORT:-8000}"

VOLUME_DB="/data/maple.db"
APP_DB="/app/data/maple.db"

echo "=== DB Sync ==="

if [ -d "/data" ]; then
  if [ -f "$VOLUME_DB" ]; then
    echo "Volume DB exists. Syncing ONLY quests table..."

    # 퀘스트 테이블만 교체. 나머지 테이블은 절대 건드리지 않음.
    python -c "
import sqlite3

VOLUME = '$VOLUME_DB'
SEED = '$APP_DB'

try:
    vol = sqlite3.connect(VOLUME)

    # 마이그레이션: 새 컬럼 추가 (이미 있으면 무시)
    new_cols = [
        ('quests', 'difficulty', 'TEXT'),
        ('quests', 'start_location', 'TEXT'),
        ('quests', 'quest_conditions', 'TEXT'),
        ('quests', 'item_reward', 'TEXT'),
        ('quests', 'extra_reward', 'TEXT'),
        ('quests', 'note', 'TEXT'),
        ('quests', 'tip', 'TEXT'),
        ('quests', 'is_chain', 'INTEGER DEFAULT 0'),
        ('quests', 'chain_parent', 'TEXT'),
        ('quests', 'is_mapleland', 'INTEGER DEFAULT 1'),
    ]
    for table, col, coltype in new_cols:
        try:
            vol.execute(f'ALTER TABLE {table} ADD COLUMN {col} {coltype}')
        except:
            pass
    vol.commit()

    # 시드 DB에서 퀘스트 데이터만 가져오기
    vol.execute(f\"ATTACH '{SEED}' AS seed\")

    # quests 테이블만 교체
    vol.execute('DELETE FROM quests')
    vol.execute('INSERT INTO quests SELECT * FROM seed.quests')
    qcount = vol.execute('SELECT COUNT(*) FROM quests').fetchone()[0]
    print(f'Quests synced: {qcount}')

    vol.execute('DETACH seed')
    vol.commit()
    vol.close()
    print('Quest sync done. Other tables untouched.')

except Exception as e:
    print(f'Quest sync error: {e}')
    # 실패해도 볼륨 DB를 덮어쓰지 않음
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
