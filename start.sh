#!/bin/bash
set -e

# Railway는 PORT 환경변수를 주입함
PORT="${PORT:-3000}"
API_PORT="${API_PORT:-8000}"

# 영구 볼륨 경로 (Railway Volume mount point)
VOLUME_DB="/data/maple.db"
APP_DB="/app/data/maple.db"

echo "=== DB Persistence Check ==="
echo "App DB: $(ls -la "$APP_DB" 2>/dev/null || echo 'NOT FOUND')"

# Volume이 마운트되어 있으면 영구 DB 사용
if [ -d "/data" ]; then
  echo "Volume detected at /data"
  echo "Volume contents: $(ls -la /data/ 2>/dev/null || echo 'empty')"

  if [ -f "$VOLUME_DB" ]; then
    VSIZE=$(stat -c%s "$VOLUME_DB" 2>/dev/null || stat -f%z "$VOLUME_DB" 2>/dev/null || echo "unknown")
    ASIZE=$(stat -c%s "$APP_DB" 2>/dev/null || stat -f%z "$APP_DB" 2>/dev/null || echo "unknown")
    echo "Volume DB: $VSIZE bytes | App DB: $ASIZE bytes"

    # 마이그레이션 실행 (새 컬럼 추가)
    python -c "
import sqlite3, sys
sys.path.insert(0, '.')
from crawler.db import migrate_db
conn = sqlite3.connect('$VOLUME_DB')
migrate_db(conn)
conn.close()
print('Migration done')
" 2>/dev/null || echo "Migration skipped"

    # 퀘스트/아이템/몬스터/맵/NPC 등 게임 데이터는 매 배포마다 시드 DB에서 강제 동기화
    # (유저 생성 데이터: bimae_posts, guild_*, game_results, community_*, scroll_rankings 등은 보존)
    if command -v sqlite3 &>/dev/null; then
      BCOUNT=$(sqlite3 "$VOLUME_DB" 'SELECT COUNT(*) FROM bimae_posts' 2>/dev/null || echo "0")
      echo "Bimae posts (preserved): $BCOUNT"

      echo "Syncing game data from seed DB..."
      sqlite3 "$VOLUME_DB" "ATTACH '$APP_DB' AS seed;
        -- 퀘스트 테이블 전체 교체
        DELETE FROM quests;
        INSERT INTO quests SELECT * FROM seed.quests;
        -- 퀘스트 이름 매핑 교체
        DELETE FROM entity_names_en WHERE entity_type='quest';
        INSERT OR IGNORE INTO entity_names_en SELECT * FROM seed.entity_names_en WHERE entity_type='quest';
        -- 아이템/몬스터/맵/NPC도 시드에서 동기화 (더 최신 데이터)
        DELETE FROM items;
        INSERT INTO items SELECT * FROM seed.items;
        DELETE FROM mobs;
        INSERT INTO mobs SELECT * FROM seed.mobs;
        DELETE FROM maps;
        INSERT INTO maps SELECT * FROM seed.maps;
        DELETE FROM npcs;
        INSERT INTO npcs SELECT * FROM seed.npcs;
        DELETE FROM mob_drops;
        INSERT INTO mob_drops SELECT * FROM seed.mob_drops;
        DELETE FROM mob_spawns;
        INSERT INTO mob_spawns SELECT * FROM seed.mob_spawns;
        DELETE FROM skills;
        INSERT INTO skills SELECT * FROM seed.skills;
        -- entity_names_en 나머지도 동기화
        DELETE FROM entity_names_en WHERE entity_type!='quest';
        INSERT OR IGNORE INTO entity_names_en SELECT * FROM seed.entity_names_en WHERE entity_type!='quest';
        DETACH seed;" 2>/dev/null && echo "Game data synced!" || echo "Sync failed — using seed DB as fallback"

      # 동기화 실패 시 시드 DB로 교체 (유저 데이터 손실 감수)
      QCOUNT=$(sqlite3 "$VOLUME_DB" "SELECT COUNT(*) FROM quests WHERE is_mapleland=1" 2>/dev/null || echo "0")
      echo "Mapleland quests after sync: $QCOUNT"
      if [ "$QCOUNT" = "0" ]; then
        echo "WARN: Sync failed, replacing volume DB with seed DB..."
        cp "$APP_DB" "$VOLUME_DB"
      fi
    fi
  else
    echo "No DB in volume, copying seed DB..."
    cp "$APP_DB" "$VOLUME_DB"
    echo "Seed DB copied to volume"
  fi

  # 앱 DB → 볼륨 심볼릭 링크 (기존 파일 제거 후 링크)
  rm -f "$APP_DB"
  ln -sf "$VOLUME_DB" "$APP_DB"
  echo "Symlink created: $(ls -la "$APP_DB")"
else
  echo "WARNING: No volume mounted at /data — data will be LOST on redeploy!"
fi

echo "=== DB Persistence Check Done ==="

echo "Starting FastAPI on port $API_PORT..."
uvicorn api.main:app --host 0.0.0.0 --port "$API_PORT" &

echo "Waiting for API to start..."
sleep 3

echo "Starting Next.js on port $PORT..."
cd web-standalone
HOSTNAME="0.0.0.0" PORT="$PORT" NEXT_PUBLIC_API_URL="http://localhost:$API_PORT" node server.js
