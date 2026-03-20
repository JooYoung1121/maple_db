FROM python:3.11-slim AS api

WORKDIR /app

# 시스템 의존성
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성
COPY crawler/requirements.txt crawler/requirements.txt
COPY api/requirements.txt api/requirements.txt
RUN pip install --no-cache-dir -r crawler/requirements.txt -r api/requirements.txt

# 소스 복사
COPY crawler/ crawler/
COPY api/ api/

# 데이터 디렉토리
RUN mkdir -p data/cache

# DB 초기화
RUN python -c "from crawler.db import init_db; init_db()"

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]

# --- Next.js 프론트엔드 ---
FROM node:18-alpine AS web-deps
WORKDIR /app
COPY web/package.json web/package-lock.json* ./
RUN npm ci || npm install

FROM node:18-alpine AS web-build
WORKDIR /app
COPY --from=web-deps /app/node_modules ./node_modules
COPY web/ ./
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build

FROM node:18-alpine AS web
WORKDIR /app
COPY --from=web-build /app/.next/standalone ./
COPY --from=web-build /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
