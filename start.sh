#!/bin/bash
set -e

# Railway는 PORT 환경변수를 주입함
PORT="${PORT:-3000}"
API_PORT="${API_PORT:-8000}"

echo "Starting FastAPI on port $API_PORT..."
uvicorn api.main:app --host 0.0.0.0 --port "$API_PORT" &

echo "Waiting for API to start..."
sleep 3

echo "Starting Next.js on port $PORT..."
cd web-standalone
HOSTNAME="0.0.0.0" PORT="$PORT" NEXT_PUBLIC_API_URL="http://localhost:$API_PORT" node server.js
