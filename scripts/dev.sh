#!/bin/bash
set -e

# 사용법:
#   ./scripts/dev.sh          API(8000) + 웹(3000) 동시 실행
#   Ctrl+C                    두 서버 모두 종료
#
# 사전 조건:
#   ./scripts/setup.sh 를 먼저 실행하여 의존성을 설치하세요.
#   데이터가 필요하면: python -m crawler crawl --all

cd "$(dirname "$0")/.."
ROOT=$(pwd)

echo "=== 메이플랜드 개발 서버 시작 ==="

# API 서버 (백그라운드)
echo "API 서버 시작 (http://localhost:8000)..."
cd "$ROOT" && uvicorn api.main:app --reload --host 0.0.0.0 --port 8000 &
API_PID=$!

# Next.js 개발 서버
echo "웹 서버 시작 (http://localhost:3000)..."
cd "$ROOT/web" && npm run dev &
WEB_PID=$!

echo ""
echo "API: http://localhost:8000/api/health"
echo "웹:  http://localhost:3000"
echo ""
echo "종료: Ctrl+C"

trap "kill $API_PID $WEB_PID 2>/dev/null; exit" INT TERM
wait
