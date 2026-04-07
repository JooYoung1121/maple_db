#!/bin/bash
set -e

PORT="${PORT:-3000}"
API_PORT="${API_PORT:-8000}"

VOLUME_DB="/data/maple.db"
APP_DB="/app/data/maple.db"
BACKUP_DB="/data/maple_backup.db"

echo "=== DB Sync ==="

if [ -d "/data" ]; then
  if [ -f "$VOLUME_DB" ]; then
    echo "Volume DB exists. Preserving user data, replacing with seed DB..."

    # 1) 유저 데이터를 시드 DB에 복원 (볼륨 → 시드)
    python -c "
import sqlite3, traceback

VOLUME = '$VOLUME_DB'
SEED = '$APP_DB'

USER_TABLES = [
    'bimae_posts', 'scroll_rankings', 'game_results',
    'community_polls', 'community_poll_votes',
    'guild_posts', 'guild_members', 'boss_runs', 'boss_recruitments',
    'fee_records', 'bot_settings', 'maple_land_posts',
    'free_board_posts', 'free_board_comments',
]

try:
    seed = sqlite3.connect(SEED)
    seed.execute(f\"ATTACH '{VOLUME}' AS vol\")

    for table in USER_TABLES:
        try:
            count = seed.execute(f'SELECT COUNT(*) FROM vol.{table}').fetchone()[0]
            if count > 0:
                # 시드에 테이블이 있으면 비우고 볼륨에서 복사
                seed.execute(f'DELETE FROM {table}')
                seed.execute(f'INSERT INTO {table} SELECT * FROM vol.{table}')
                print(f'  {table}: {count} rows preserved')
        except Exception as e:
            print(f'  {table}: skip ({e})')

    seed.execute('DETACH vol')
    seed.commit()
    seed.close()
    print('User data preserved in seed DB')
except Exception as e:
    print(f'User data preservation failed: {e}')
    traceback.print_exc()
" 2>&1

    # 2) 시드 DB를 볼륨에 복사 (깨끗한 DB로 교체)
    cp "$APP_DB" "$VOLUME_DB"
    echo "Seed DB copied to volume (clean replace)"

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

# init_db
python -c "from crawler.db import init_db; init_db()" 2>/dev/null || true

# 최종 확인
python -c "
import sqlite3
conn = sqlite3.connect('$APP_DB')
q = conn.execute('SELECT COUNT(*) FROM quests').fetchone()[0]
print(f'=== Quests: {q} ===')
conn.close()
" 2>/dev/null || echo "DB check failed"

echo "=== DB Sync Done ==="

echo "Starting FastAPI on port $API_PORT..."
uvicorn api.main:app --host 0.0.0.0 --port "$API_PORT" &
sleep 3

echo "Starting Next.js on port $PORT..."
cd web-standalone
HOSTNAME="0.0.0.0" PORT="$PORT" NEXT_PUBLIC_API_URL="http://localhost:$API_PORT" node server.js
