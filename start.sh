#!/bin/bash
set -e

# Railway는 PORT 환경변수를 주입함
PORT="${PORT:-3000}"
API_PORT="${API_PORT:-8000}"

# 영구 볼륨 경로 (Railway Volume mount point)
VOLUME_DB="/data/maple.db"
APP_DB="/app/data/maple.db"

# Volume이 마운트되어 있으면 영구 DB 사용
if [ -d "/data" ]; then
  echo "Volume detected at /data"
  if [ ! -f "$VOLUME_DB" ]; then
    echo "Initializing volume DB from app bundle..."
    cp "$APP_DB" "$VOLUME_DB"
  else
    echo "Using existing volume DB (preserving runtime data)"
  fi
  # 앱이 볼륨 DB를 사용하도록 심볼릭 링크
  ln -sf "$VOLUME_DB" "$APP_DB"
else
  echo "No volume mounted, using ephemeral DB"
fi

echo "Starting FastAPI on port $API_PORT..."
uvicorn api.main:app --host 0.0.0.0 --port "$API_PORT" &

echo "Waiting for API to start..."
sleep 3

echo "Starting Next.js on port $PORT..."
cd web-standalone
HOSTNAME="0.0.0.0" PORT="$PORT" NEXT_PUBLIC_API_URL="http://localhost:$API_PORT" node server.js
