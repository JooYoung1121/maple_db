#!/bin/bash
# FastAPI 백그라운드 시작
uvicorn api.main:app --host 0.0.0.0 --port 8000 &

# Next.js standalone 시작 (포그라운드)
cd web-standalone
HOSTNAME="0.0.0.0" PORT=3000 node server.js
