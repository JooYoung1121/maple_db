# 메이플랜드 DB

[![GitHub](https://img.shields.io/badge/GitHub-JooYoung1121%2Fmaple__db-blue?logo=github)](https://github.com/JooYoung1121/maple_db)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue)](https://www.python.org/)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)

메이플랜드(MapleStory Pre-BigBang) 게임 데이터 통합 검색 플랫폼 + 계산기 모음입니다.
14,000개 이상의 아이템, 1,877개의 몬스터, 4,771개의 맵, 드롭 정보와 엔방컷·주문서·경험치 계산기를 한곳에서 사용하세요.

**[프로젝트 바로가기](https://github.com/JooYoung1121/maple_db)** · 현재 버전: **v1.2.0**

---

## 주요 기능

### 📊 데이터베이스
- **14,146개 아이템** — 직업별 필터, 카테고리 검색, 드롭 몬스터 정보
- **1,877개 몬스터** — 레벨/보스 필터, 드롭 아이템, 출현 맵 조회
- **4,771개 맵** — 지역별 검색, 출현 몬스터 및 NPC 정보
- **1,598개 NPC** — 위치, 상점 정보 확인
- **3,215개 퀘스트** — 레벨 필터, 상세 조건 조회
- **보스 몬스터 전용 페이지** — 젠타임, 스폰맵, 드롭 정보
- **직업별 스킬 데이터** — 레벨별 스킬 상세 정보
- **한국어/영어 통합 검색** — FTS5 전문검색으로 빠른 결과

### 🧮 계산기 / 도구
- **엔방컷 계산기** — 직업·스킬·스탯 기반 몬스터 N방컷 계산, 몬테카를로 확률 분포
- **사냥터 젠컷 정보** — 11개 주요 사냥터별 직업별 방컷 조건 참조표 (커뮤니티 검증 데이터 포함)
- **주문서 시뮬레이션** — 확률별 성공 시뮬레이터, 스탯 참고표, 강화 랭킹
- **경험치 계산기** — 레벨별 경험치표, 목표 레벨 달성 시간 계산

### 👥 커뮤니티
- **투표** — 질문 생성, 실시간 득표율 시각화, 중복 방지
- **룰렛** — 공평/불공평 모드, SVG 파이 차트 애니메이션

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| **크롤러** | Python 3.11+, httpx, BeautifulSoup4, Click CLI |
| **API 서버** | FastAPI, SQLite (FTS5 전문검색), uvicorn |
| **프론트엔드** | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| **배포** | Docker, docker-compose, Railway |

### 데이터 소스

- [mapledb.kr](https://mapledb.kr) — 아이템, 몬스터, 맵, NPC, 퀘스트
- [maplekibun.tistory.com](https://maplekibun.tistory.com) — 블로그 공략 및 드롭 정보
- [maplestory.io](https://maplestory.io) — Pre-BigBang (v92) 및 KMS 데이터
- [hidden-street.net](https://bbb.hidden-street.net) — 보스 정보

---

## 프로젝트 구조

```
maple/
├── crawler/                    # 데이터 크롤러
│   ├── config.py              # 크롤링 설정 (URL, rate limit)
│   ├── db.py                  # SQLite 스키마 및 FTS5 인덱싱
│   ├── client.py              # Rate-limited HTTP 클라이언트
│   ├── main.py                # CLI 엔트리포인트
│   ├── parsers/               # 사이트별 HTML/API 파서
│   └── requirements.txt
│
├── api/                        # FastAPI 백엔드
│   ├── main.py                # 앱 설정, CORS, 라우터
│   ├── routes/
│   │   ├── search.py          # 통합 검색
│   │   ├── items.py
│   │   ├── mobs.py
│   │   ├── maps.py
│   │   ├── npcs.py
│   │   ├── quests.py
│   │   ├── skills.py
│   │   └── export.py          # Excel/CSV 내보내기
│   └── requirements.txt
│
├── web/                        # Next.js 15 프론트엔드
│   ├── app/                   # App Router 페이지
│   │   ├── page.tsx           # 홈 (검색 + 카테고리)
│   │   ├── items/
│   │   ├── mobs/
│   │   ├── maps/
│   │   ├── npcs/
│   │   ├── quests/
│   │   ├── bosses/            # 보스 전용 페이지
│   │   ├── skills/
│   │   └── layout.tsx
│   ├── components/            # 공통 컴포넌트
│   ├── lib/                   # API 클라이언트, 타입 정의
│   ├── package.json
│   └── tailwind.config.js
│
├── scripts/
│   ├── setup.sh               # 의존성 설치 + DB 초기화
│   ├── dev.sh                 # API + 웹 동시 실행 (개발용)
│   └── start.sh               # Railway 배포 시작 스크립트
│
├── data/                      # SQLite DB + 캐시 (git 제외)
├── Dockerfile                 # 개발/배포용
├── Dockerfile.railway         # Railway 배포 전용
├── docker-compose.yml         # 로컬 Docker 환경
├── railway.toml               # Railway 설정
├── .env.example
├── .gitignore
└── README.md
```

---

## 빠른 시작

### 1️⃣ 사전 요구사항

- **Python 3.11+** ([다운로드](https://www.python.org/downloads/))
- **Node.js 18+** ([다운로드](https://nodejs.org/))
- **npm 9+** (Node.js 설치 시 함께 설치됨)

### 2️⃣ 설치 및 실행

```bash
# 저장소 클론
git clone https://github.com/JooYoung1121/maple_db.git
cd maple_db

# 1단계: 의존성 설치 + DB 초기화
./scripts/setup.sh

# 2단계: 게임 데이터 크롤링 (최초 1회, 약 30분 소요)
python -m crawler crawl --all

# 3단계: 개발 서버 실행
./scripts/dev.sh
```

**실행 완료 후:**
- 웹: http://localhost:3000
- API: http://localhost:8000/api/health
- API 문서: http://localhost:8000/docs (Swagger UI)

> **💡 팁:** `dev.sh`를 실행하면 API(8000)와 웹(3000)이 동시에 실행됩니다. Ctrl+C로 모두 종료됩니다.

---

## CLI 명령어

### 전체 크롤링

```bash
# 모든 데이터 크롤링 (약 30분)
python -m crawler crawl --all

# 강제 재크롤링 (캐시 무시, 최근 데이터도 갱신)
python -m crawler crawl --all --force
```

### 특정 데이터만 크롤링

```bash
# 기본 엔티티 (mapledb.kr 출처)
python -m crawler crawl --type items
python -m crawler crawl --type mobs
python -m crawler crawl --type maps
python -m crawler crawl --type npcs
python -m crawler crawl --type quests

# 보조 데이터 (블로그, API 등)
python -m crawler crawl --type tistory           # 블로그 공략
python -m crawler crawl --type maplestory-io     # Pre-BigBang 데이터
python -m crawler crawl --type maplestory-io-kms # KMS 한국어 매칭
python -m crawler crawl --type blog-drops        # 블로그 드롭 정보
python -m crawler crawl --type blog-skills       # 블로그 스킬 정보

# 상세 정보
python -m crawler crawl --type detail-items
python -m crawler crawl --type detail-mobs
python -m crawler crawl --type detail-maps
python -m crawler crawl --type detail-npcs
python -m crawler crawl --type detail-quests
```

### 인덱스 및 통계

```bash
# 전문검색 인덱스 재구축
python -m crawler reindex

# DB 통계 확인 (총 행 수 등)
python -m crawler stats

# 데이터 일관성 검사
python -m crawler cross-check
```

---

## API 엔드포인트

### 🔍 통합 검색

```http
GET /api/search?q=비파&type=item&page=1&per_page=20
```

**쿼리 파라미터:**
- `q` (필수) — 검색어 (한국어/영어 지원)
- `type` — 엔티티 타입: `item`, `mob`, `map`, `npc`, `quest`, `skill`
- `page` — 페이지 번호 (기본값: 1)
- `per_page` — 페이지당 항목 수 (기본값: 20)

### 📦 아이템

```http
GET /api/items                          # 목록
GET /api/items/{id}                     # 상세
```

**필터:**
- `category` — 아이템 카테고리
- `level_min`, `level_max` — 레벨 범위
- `job` — 직업 (warrior, magician, bowman, thief, pirate)
- `q` — 검색어

### 👹 몬스터

```http
GET /api/mobs                           # 목록
GET /api/mobs/{id}                      # 상세
```

**필터:**
- `level_min`, `level_max` — 레벨 범위
- `is_boss` — 보스 여부 (true/false)
- `q` — 검색어

**응답 포함 정보:**
- 드롭 아이템
- 출현 맵
- 보스 젠 정보 (보스 몬스터)

### 🗺️ 맵

```http
GET /api/maps                           # 목록
GET /api/maps/{id}                      # 상세
```

**필터:**
- `area` — 지역 필터
- `q` — 검색어

**응답 포함 정보:**
- 출현 몬스터
- NPC
- 접속 방법

### 👤 NPC

```http
GET /api/npcs                           # 목록
GET /api/npcs/{id}                      # 상세
```

### ⚔️ 퀘스트

```http
GET /api/quests                         # 목록
GET /api/quests/{id}                    # 상세
```

**필터:**
- `level_min`, `level_max` — 레벨 범위
- `q` — 검색어

### 💼 스킬

```http
GET /api/skills                         # 목록
GET /api/skills/{id}                    # 상세
```

### 📊 데이터 내보내기

```http
GET /api/export?type=items&format=xlsx
```

**파라미터:**
- `type` — `items`, `mobs`, `maps`, `npcs`, `quests`, `blog`
- `format` — `xlsx` (Excel), `csv`

### 🏥 헬스체크

```http
GET /api/health                         # { "status": "ok" }
```

---

## 웹 프론트엔드 페이지

| 경로 | 설명 |
|------|------|
| `/` | 홈 — 통합 검색 + 카테고리 카드 |
| `/items` | 아이템 목록 (이름, 레벨, 직업, 카테고리 필터) |
| `/items/[id]` | 아이템 상세 (드롭 몬스터) |
| `/mobs` | 몬스터 목록 (레벨, 보스 여부 필터) |
| `/mobs/[id]` | 몬스터 상세 (드롭, 출현 맵) |
| `/bosses` | 보스 몬스터 전용 (젠타임, 스폰맵) |
| `/maps` | 맵 목록 (지역 필터) |
| `/maps/[id]` | 맵 상세 (출현 몬스터, NPC) |
| `/npcs` | NPC 목록 |
| `/npcs/[id]` | NPC 상세 |
| `/quests` | 퀘스트 목록 (레벨 필터) |
| `/quests/[id]` | 퀘스트 상세 |
| `/skills` | 스킬 목록 (직업별 필터) |
| `/skills/[id]` | 스킬 상세 |
| `/nhit` | 엔방컷 계산기 + 사냥터 젠컷 정보 (직업·스킬·스탯 기반) |
| `/scroll` | 주문서 시뮬레이션 (확률 계산, 시뮬레이터, 스탯표) |
| `/exp` | 경험치 계산기 (레벨별 경험치표, 목표 달성 시간) |
| `/community` | 커뮤니티 — 투표 생성/참여, 룰렛 |
| `/pq` | 파티 퀘스트 정보 |
| `/fee` | 수수료 계산기 |
| `/version` | 버전 및 변경 이력 (changelog) |

---

## 로컬 개발

### API만 실행

```bash
# API 서버만 시작 (포트 8000)
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

### 웹만 실행

```bash
cd web
npm run dev  # 포트 3000
```

### API + 웹 동시 실행

```bash
./scripts/dev.sh
```

---

## Docker 배포

### docker-compose 사용 (로컬 환경)

```bash
# 전체 스택 빌드 및 실행
docker-compose up -d --build

# 로그 확인
docker-compose logs -f

# 종료
docker-compose down
```

**컨테이너 구성:**
- **api** (`:8000`) — FastAPI + SQLite (크롤링 데이터 볼륨 마운트)
- **web** (`:3000`) — Next.js 프로덕션 빌드

### Docker 내부에서 크롤링

```bash
# 컨테이너 접근
docker-compose exec api bash

# 크롤링 실행
python -m crawler crawl --all
```

### 단일 Dockerfile (Railway 배포)

```bash
docker build -f Dockerfile.railway -t maple:latest .
docker run -p 3000:3000 maple:latest
```

---

## Railway 배포

### 빠른 배포

1. **Railway 계정 생성** — https://railway.app
2. **GitHub 연결** — Railway와 GitHub 통합
3. **프로젝트 생성** — 이 저장소 선택
4. **배포** — 자동으로 빌드 및 배포 시작

### 수동 배포

```bash
# Railway CLI 설치 (필요시)
npm i -g @railway/cli

# 로그인
railway login

# 링크 및 배포
railway link                    # 프로젝트 선택
railway up                      # 배포 시작
```

### Railway 환경변수 설정

Railway 대시보드에서 환경변수 추가:

| 변수 | 값 | 설명 |
|------|-----|------|
| `NEXT_PUBLIC_API_URL` | (빈 값) | 프론트에서 API 호출 시 base URL. Railway 배포 시 자동 라우팅 |
| `API_HOST` | `0.0.0.0` | API 서버 바인드 주소 |
| `API_PORT` | `3000` | API 서버 포트 (Railway는 포트 3000 사용) |

**railway.toml 설정:**
```toml
[build]
dockerfilePath = "Dockerfile.railway"

[deploy]
startCommand = "./start.sh"
healthcheckPath = "/api/health"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

### 배포 후 데이터 크롤링

Railway 대시보드의 **Terminal** 탭에서:

```bash
python -m crawler crawl --all
```

또는 SSH 접근:

```bash
railway run python -m crawler crawl --all
```

---

## 환경변수

`.env.example`을 `.env`로 복사하여 설정합니다:

```bash
cp .env.example .env
```

**주요 변수:**

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `NEXT_PUBLIC_API_URL` | (빈 값) | 프론트에서 API 호출 시 base URL. 로컬 개발 시 빈 값 (rewrite 사용) |
| `API_HOST` | `0.0.0.0` | API 서버 바인드 주소 |
| `API_PORT` | `8000` | API 서버 포트 |

**크롤러 설정:**

크롤러 설정(rate limit, stale days 등)은 `crawler/config.py`에서 직접 수정합니다:

```python
RATE_LIMIT = {
    "mapledb.kr": 1.0,           # 초당 1요청
    "tistory.com": 2.0,          # 초당 0.5요청
    "maplestory.io": 2.0,        # 초당 0.5요청
    "bbb.hidden-street.net": 3.0,# 초당 ~0.33요청
}

CRAWL_STALE_DAYS = 7  # 이 기간 내 크롤링된 데이터는 스킵
```

---

## 성능 최적화

### FTS5 전문검색

SQLite의 FTS5 확장을 사용하여 한국어/영어 통합 검색을 빠르게 처리합니다.

```bash
# 인덱스 재구축 (필요시)
python -m crawler reindex
```

### 크롤링 속도 제어

- **Rate Limiting** — 각 사이트별 요청 간격 제어 (config.py)
- **캐싱** — 7일 내 크롤링 데이터 재사용 (스킵)
- **병렬화** — 여러 사이트 동시 크롤링

### 대역폭 절감

```bash
# CSV 또는 Excel로 데이터 내보내기
curl "http://localhost:8000/api/export?type=items&format=csv" > items.csv
```

---

## 개발 가이드

### 새로운 API 엔드포인트 추가

`api/routes/` 디렉토리에 새 파일 생성:

```python
# api/routes/my_route.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/my-endpoint")
async def my_endpoint():
    return {"data": "example"}
```

`api/main.py`에 라우터 등록:

```python
from api.routes import my_route
app.include_router(my_route.router, prefix="/api")
```

### 크롤러에 새 데이터 소스 추가

1. `crawler/parsers/` 에 파서 클래스 작성
2. `crawler/main.py` 에 타입 및 파서 등록
3. `python -m crawler crawl --type <new-type>`

### 프론트엔드 페이지 추가

`web/app/` 에 새 디렉토리 생성 (Next.js App Router):

```
web/app/
├── my-page/
│   └── page.tsx    # /my-page 자동 라우팅
└── my-page/
    └── [id]/
        └── page.tsx  # /my-page/[id] 동적 라우팅
```

---

## 트러블슈팅

### 문제: Python 의존성 설치 실패

**해결:**
```bash
# pip 업그레이드
pip install --upgrade pip

# 재설치
pip install -r crawler/requirements.txt -r api/requirements.txt
```

### 문제: 데이터베이스 오류

**해결:**
```bash
# DB 재초기화
rm -f data/maple.db
python -c "from crawler.db import init_db; init_db()"

# 크롤링 재실행
python -m crawler crawl --all --force
```

### 문제: 포트 이미 사용 중

**해결:**
```bash
# API 포트 변경
uvicorn api.main:app --port 8080

# 웹 포트 변경
cd web && PORT=3001 npm run dev
```

### 문제: Next.js 빌드 실패

**해결:**
```bash
# node_modules 초기화
cd web
rm -rf node_modules package-lock.json
npm install

# 재빌드
npm run build
```

### 문제: 크롤링이 너무 느림

**확인:**
- 인터넷 연결 상태 확인
- `crawler/config.py` 의 rate limit 조정
- 특정 타입만 크롤링하기: `python -m crawler crawl --type items`

---

## 면책조항

이 프로젝트는 **학습 및 개인 사용 목적**으로 제작되었습니다.

- 크롤링 대상 사이트의 **이용약관을 준수**합니다
- 수집된 데이터의 저작권은 **원 저작자에게** 있습니다
- **상업적 용도로 사용하지 마세요**

**메이플스토리는 넥슨(NEXON)의 등록 상표입니다.**

---

## 라이선스

MIT License — [LICENSE](LICENSE) 파일 참고

---

## 기여

이슈 및 풀 리퀘스트는 언제든지 환영합니다!

1. 이 저장소를 Fork
2. Feature 브랜치 생성 (`git checkout -b feature/amazing-feature`)
3. 변경 사항 커밋 (`git commit -m 'Add amazing feature'`)
4. 브랜치 푸시 (`git push origin feature/amazing-feature`)
5. Pull Request 열기

---

## 연락처

- **GitHub** — [JooYoung1121/maple_db](https://github.com/JooYoung1121/maple_db)
- **Issues** — [Issues 탭](https://github.com/JooYoung1121/maple_db/issues)

---

**마지막 업데이트:** 2026년 3월 24일 · v1.2.0
