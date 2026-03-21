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
    # 볼륨 DB 존재 — 절대 덮어쓰지 않음
    VSIZE=$(stat -c%s "$VOLUME_DB" 2>/dev/null || stat -f%z "$VOLUME_DB" 2>/dev/null || echo "unknown")
    echo "Volume DB exists ($VSIZE bytes)"
    # bimae_posts 개수 확인 (sqlite3 없으면 스킵)
    if command -v sqlite3 &>/dev/null; then
      BCOUNT=$(sqlite3 "$VOLUME_DB" 'SELECT COUNT(*) FROM bimae_posts' 2>/dev/null || echo "table missing")
      echo "Bimae posts in volume DB: $BCOUNT"
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
