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

    # 유저 생성 데이터(bimae, guild, game_results 등)를 보존하면서 시드 DB 업데이트
    if command -v sqlite3 &>/dev/null; then
      BCOUNT=$(sqlite3 "$VOLUME_DB" 'SELECT COUNT(*) FROM bimae_posts' 2>/dev/null || echo "0")
      HAS_AREA=$(sqlite3 "$VOLUME_DB" "SELECT COUNT(*) FROM quests WHERE area IS NOT NULL AND area != ''" 2>/dev/null || echo "0")
      echo "Bimae posts: $BCOUNT | Quests with area: $HAS_AREA"

      # 퀘스트 데이터가 비어있으면 시드 DB에서 퀘스트 관련 데이터만 갱신
      if [ "$HAS_AREA" = "0" ] || [ "$HAS_AREA" = "table missing" ]; then
        echo "Quest data outdated — merging from seed DB..."
        # 마이그레이션 먼저 실행
        python -c "from crawler.db import init_db; init_db()" 2>/dev/null || true

        # 시드 DB에서 퀘스트 테이블 전체를 복사 (유저 데이터 안 건드림)
        sqlite3 "$VOLUME_DB" "ATTACH '$APP_DB' AS seed;" \
          "DELETE FROM quests;" \
          "INSERT INTO quests SELECT * FROM seed.quests;" \
          "DELETE FROM entity_names_en WHERE entity_type='quest';" \
          "INSERT OR IGNORE INTO entity_names_en SELECT * FROM seed.entity_names_en WHERE entity_type='quest';" \
          "DETACH seed;" 2>/dev/null && echo "Quest data merged!" || echo "Quest merge failed (will use seed DB)"
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
