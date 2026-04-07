#!/bin/bash
set -e

PORT="${PORT:-3000}"
API_PORT="${API_PORT:-8000}"

VOLUME_DB="/data/maple.db"
APP_DB="/app/data/maple.db"

echo "=== DB Persistence Check ==="
echo "App DB: $(ls -la "$APP_DB" 2>/dev/null || echo 'NOT FOUND')"

if [ -d "/data" ]; then
  echo "Volume detected at /data"

  if [ -f "$VOLUME_DB" ]; then
    echo "Volume DB exists. Running sync via Python..."

    # Python으로 게임 데이터 동기화 (sqlite3 CLI 없어도 동작)
    python -c "
import sqlite3, os, sys
sys.path.insert(0, '/app')

VOLUME_DB = '$VOLUME_DB'
APP_DB = '$APP_DB'

try:
    # 마이그레이션 실행
    from crawler.db import init_db, migrate_db
    vol = sqlite3.connect(VOLUME_DB)
    vol.row_factory = sqlite3.Row
    migrate_db(vol)
    vol.commit()
    print('Migration done')

    # 유저 데이터 카운트
    try:
        bcount = vol.execute('SELECT COUNT(*) FROM bimae_posts').fetchone()[0]
        print(f'Bimae posts (preserved): {bcount}')
    except:
        print('Bimae posts: table missing')

    # 시드 DB 연결하여 게임 데이터 동기화
    vol.execute(f\"ATTACH '{APP_DB}' AS seed\")

    # 퀘스트 테이블 교체
    vol.execute('DROP TABLE IF EXISTS quests')
    vol.execute('CREATE TABLE quests AS SELECT * FROM seed.quests')
    qcount = vol.execute('SELECT COUNT(*) FROM quests').fetchone()[0]
    print(f'Quests synced: {qcount}')

    # 아이템/몬스터/맵/NPC 등 게임 데이터 교체
    for table in ['items', 'mobs', 'maps', 'npcs', 'mob_drops', 'mob_spawns', 'skills']:
        try:
            vol.execute(f'DELETE FROM {table}')
            vol.execute(f'INSERT INTO {table} SELECT * FROM seed.{table}')
            cnt = vol.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
            print(f'{table}: {cnt} rows synced')
        except Exception as e:
            print(f'{table}: sync skipped ({e})')

    # entity_names_en 교체
    try:
        vol.execute('DELETE FROM entity_names_en')
        vol.execute('INSERT INTO entity_names_en SELECT * FROM seed.entity_names_en')
        cnt = vol.execute('SELECT COUNT(*) FROM entity_names_en').fetchone()[0]
        print(f'entity_names_en: {cnt} rows synced')
    except Exception as e:
        print(f'entity_names_en: sync skipped ({e})')

    vol.execute('DETACH seed')
    vol.commit()
    vol.close()
    print('Game data sync complete!')

except Exception as e:
    print(f'Sync error: {e}')
    print('Falling back to seed DB copy...')
    import shutil
    shutil.copy2(APP_DB, VOLUME_DB)
    print('Seed DB copied to volume')
" 2>&1

  else
    echo "No DB in volume, copying seed DB..."
    cp "$APP_DB" "$VOLUME_DB"
    echo "Seed DB copied to volume"
  fi

  rm -f "$APP_DB"
  ln -sf "$VOLUME_DB" "$APP_DB"
  echo "Symlink: $(ls -la "$APP_DB")"
else
  echo "WARNING: No volume at /data — data will be LOST on redeploy!"
fi

echo "=== DB Check Done ==="

# init_db로 FTS 인덱스 등 초기화
python -c "from crawler.db import init_db; init_db()" 2>/dev/null || true

echo "Starting FastAPI on port $API_PORT..."
uvicorn api.main:app --host 0.0.0.0 --port "$API_PORT" &

echo "Waiting for API..."
sleep 3

echo "Starting Next.js on port $PORT..."
cd web-standalone
HOSTNAME="0.0.0.0" PORT="$PORT" NEXT_PUBLIC_API_URL="http://localhost:$API_PORT" node server.js
