#!/bin/bash
# 로컬 개발 서버 실행 스크립트

cd "$(dirname "$0")"

# venv 없으면 생성
if [ ! -d ".venv" ]; then
  echo "venv 생성 중..."
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r api/requirements.txt
else
  source .venv/bin/activate
fi

# 백엔드 백그라운드 실행
echo "FastAPI 시작 (port 8000)..."
python3 -m uvicorn api.main:app --port 8000 &
BACKEND_PID=$!

# 프론트엔드 실행 (포그라운드)
echo "Next.js 시작 (port 3000)..."
cd web && npm run dev

# 종료 시 백엔드도 같이 종료
kill $BACKEND_PID 2>/dev/null
