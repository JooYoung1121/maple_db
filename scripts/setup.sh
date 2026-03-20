#!/bin/bash
set -e

echo "=== 메이플랜드 데이터 시스템 설치 ==="

cd "$(dirname "$0")/.."
ROOT=$(pwd)

# 버전 체크
echo "환경 확인 중..."

if ! command -v python3 &>/dev/null; then
  echo "❌ python3가 설치되어 있지 않습니다. Python 3.11 이상을 설치해주세요."
  exit 1
fi

PYTHON_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
PYTHON_MAJOR=$(echo "$PYTHON_VER" | cut -d. -f1)
PYTHON_MINOR=$(echo "$PYTHON_VER" | cut -d. -f2)
if [ "$PYTHON_MAJOR" -lt 3 ] || { [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 11 ]; }; then
  echo "❌ Python 3.11 이상이 필요합니다. (현재: $PYTHON_VER)"
  exit 1
fi
echo "  Python $PYTHON_VER ✓"

if ! command -v node &>/dev/null; then
  echo "❌ Node.js가 설치되어 있지 않습니다. Node.js 18 이상을 설치해주세요."
  exit 1
fi

NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "❌ Node.js 18 이상이 필요합니다. (현재: $(node -v))"
  exit 1
fi
echo "  Node.js $(node -v) ✓"

echo ""

# Python 크롤러 의존성
echo "[1/3] Python 크롤러 의존성 설치..."
pip install -r crawler/requirements.txt

# API 서버 의존성
echo "[2/3] API 서버 의존성 설치..."
pip install -r api/requirements.txt

# Next.js 프론트엔드 의존성
echo "[3/3] Next.js 프론트엔드 의존성 설치..."
cd web && npm install && cd "$ROOT"

# 데이터 디렉토리 생성
mkdir -p data/cache

# DB 초기화
echo "DB 초기화..."
python -c "from crawler.db import init_db; init_db(); print('DB initialized')"

echo ""
echo "=== 설치 완료 ==="
echo "크롤링 시작: python -m crawler crawl --all"
echo "개발 서버:   ./scripts/dev.sh"
