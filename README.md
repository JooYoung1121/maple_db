# 메이플랜드 DB

[![GitHub](https://img.shields.io/badge/GitHub-JooYoung1121%2Fmaple__db-blue?logo=github)](https://github.com/JooYoung1121/maple_db)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue)](https://www.python.org/)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)

메이플랜드(MapleStory Pre-BigBang) 게임 데이터 통합 검색 플랫폼 + 계산기/커뮤니티/놀이터 모음입니다.
14,000개 이상의 아이템, 1,877개의 몬스터, 4,771개의 맵, 드롭 정보와 엔방컷·주문서·경험치 계산기를 한곳에서 사용하세요.

**[프로젝트 바로가기](https://github.com/JooYoung1121/maple_db)** · 현재 버전: **v2.0.0**

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
- **수수료 계산기** — 공대 분배 수수료, 거래 방식별 수수료, 최적 분할 단위

### 🎮 놀이터 (`/play`)
- **🎰 룰렛** — 공평/불공평 모드, SVG 파이 차트 10초 회전 애니메이션
- **🎲 주사위** — 참가자별 3D 주사위 굴리기, 최대 6개, 합산 순위 정렬
- **🎯 핀볼** — box2d-wasm 기반 고품질 물리 엔진 (lazygyu/roulette, MIT), 자동 순위 추출
- **🪜 사다리 타기** — Canvas 10행 사다리, 당첨/꽝 모드·순서 정하기 모드
- **📋 게임 기록** — 모든 게임 결과 서버 저장, 비밀번호 보호 삭제

### 🎲 로또 (`/lotto`)
- **로또 번호 생성기** — 1~45 중 6개 + 보너스 번호, 한국 로또 공식 색상 구슬 UI
- 1·3·5개 세트 동시 생성

### 👥 커뮤니티 (`/community`)
- **투표** — 질문 생성, 실시간 득표율 시각화, IP 기반 중복 방지

### 📰 공지 (`/news`)
- **메이플랜드 공식 공지 자동 수집** — 30분마다 신규 공지 크롤링
- 카테고리 필터 (업데이트/점검/안내/이벤트/제재), 키워드 검색

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| **크롤러** | Python 3.11+, httpx, BeautifulSoup4, Click CLI |
| **API 서버** | FastAPI, SQLite (FTS5 전문검색), uvicorn |
| **프론트엔드** | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| **배포** | Docker, docker-compose, Railway |
| **물리 엔진** | box2d-wasm (lazygyu/roulette, MIT) |

### 데이터 소스

- [mapledb.kr](https://mapledb.kr) — 아이템, 몬스터, 맵, NPC, 퀘스트
- [maplekibun.tistory.com](https://maplekibun.tistory.com) — 블로그 공략 및 드롭 정보
- [maplestory.io](https://maplestory.io) — Pre-BigBang (v92) 및 KMS 데이터
- [hidden-street.net](https://bbb.hidden-street.net) — 보스 정보
- [maple.land](https://maple.land) — 공식 공지 (30분 주기 크롤링)
- [lazygyu/roulette](https://github.com/lazygyu/roulette) (MIT) — 핀볼 물리 엔진

---

## 프로젝트 구조

```
maple_db/
├── crawler/                    # 데이터 크롤러
│   ├── config.py              # 크롤링 설정 (URL, rate limit)
│   ├── db.py                  # SQLite 스키마 및 FTS5 인덱싱
│   ├── client.py              # Rate-limited HTTP 클라이언트
│   ├── main.py                # CLI 엔트리포인트
│   ├── parsers/               # 사이트별 HTML/API 파서
│   └── requirements.txt
│
├── api/                        # FastAPI 백엔드
│   ├── main.py                # 앱 설정, CORS, 라우터, /roulette 정적 서빙
│   ├── routes/
│   │   ├── search.py
│   │   ├── items.py / mobs.py / maps.py / npcs.py / quests.py / skills.py
│   │   ├── community.py       # 투표 API
│   │   ├── game_results.py    # 게임 기록 API (룰렛·주사위·핀볼·사다리)
│   │   ├── maple_land.py      # 공지 크롤링 API
│   │   ├── bimae.py           # 비매박제 API
│   │   ├── scroll_rankings.py # 주문서 강화 랭킹
│   │   └── export.py          # Excel/CSV 내보내기
│   └── requirements.txt
│
├── web/                        # Next.js 15 프론트엔드
│   ├── app/
│   │   ├── page.tsx           # 홈
│   │   ├── play/page.tsx      # 놀이터 (룰렛·주사위·핀볼·사다리)
│   │   ├── lotto/page.tsx     # 로또 번호 생성기
│   │   ├── community/page.tsx # 투표
│   │   ├── news/page.tsx      # 공지사항
│   │   ├── nhit/page.tsx      # 엔방컷 계산기
│   │   ├── scroll/page.tsx    # 주문서 시뮬레이션
│   │   ├── exp/page.tsx       # 경험치 계산기
│   │   ├── fee/page.tsx       # 수수료 계산기
│   │   ├── version/page.tsx   # 버전 및 변경 이력
│   │   └── items/ mobs/ maps/ npcs/ quests/ skills/ bosses/ pq/
│   └── next.config.ts         # /api/* /roulette/* 리라이트
│
├── roulette_dist/              # lazygyu/roulette 빌드 (MIT, postMessage 패치)
│
├── scripts/
│   ├── setup.sh               # 의존성 설치 + DB 초기화
│   ├── dev.sh                 # API + 웹 동시 실행 (개발용)
│   └── start.sh               # Railway 배포 시작 스크립트
│
├── data/                      # SQLite DB + 캐시 (git 제외)
├── Dockerfile.railway         # Railway 배포 전용
├── railway.toml               # Railway 설정
└── README.md
```

---

## 빠른 시작

### 1️⃣ 사전 요구사항

- **Python 3.11+** ([다운로드](https://www.python.org/downloads/))
- **Node.js 18+** ([다운로드](https://nodejs.org/))

### 2️⃣ 설치 및 실행

```bash
git clone https://github.com/JooYoung1121/maple_db.git
cd maple_db

# 의존성 설치 + DB 초기화
./scripts/setup.sh

# 게임 데이터 크롤링 (최초 1회, 약 30분)
python -m crawler crawl --all

# 개발 서버 실행
./scripts/dev.sh
```

**실행 완료 후:**
- 웹: http://localhost:3000
- API: http://localhost:8000/api/health
- 핀볼: http://localhost:3000/roulette/

---

## 웹 페이지

| 경로 | 설명 |
|------|------|
| `/` | 홈 — 통합 검색 + 카테고리 카드 |
| `/play` | 놀이터 — 룰렛·주사위·핀볼·사다리 타기 + 게임 기록 |
| `/lotto` | 로또 번호 생성기 |
| `/community` | 커뮤니티 — 투표 |
| `/news` | 메이플랜드 공식 공지 (자동 수집) |
| `/nhit` | 엔방컷 계산기 + 사냥터 젠컷 정보 |
| `/scroll` | 주문서 시뮬레이션 |
| `/exp` | 경험치 계산기 |
| `/fee` | 수수료 계산기 |
| `/items` | 아이템 DB |
| `/mobs` | 몬스터 DB |
| `/bosses` | 보스 몬스터 전용 |
| `/maps` | 맵 DB |
| `/npcs` | NPC DB |
| `/quests` | 퀘스트 DB |
| `/skills` | 스킬 DB |
| `/pq` | 파티 퀘스트 가이드 |
| `/version` | 버전 및 변경 이력 |

---

## API 엔드포인트

### 핵심 API

```http
GET /api/search?q=비파&type=item        # 통합 검색
GET /api/items / /api/items/{id}        # 아이템
GET /api/mobs / /api/mobs/{id}          # 몬스터
GET /api/maps / /api/maps/{id}          # 맵
GET /api/npcs / /api/quests / /api/skills
GET /api/export?type=items&format=xlsx  # Excel/CSV 내보내기
GET /api/health                         # 헬스체크
```

### 게임 기록 API

```http
GET  /api/game-results?game_type=&page=&per_page=   # 목록
POST /api/game-results                               # 저장
     body: { game_type, participants, winner, result }
DELETE /api/game-results/{id}                        # 삭제
     header: X-Admin-Password: <비밀번호>
```

`game_type`: `roulette` | `dice` | `plinko` | `ladder`

### 커뮤니티 API

```http
GET    /api/polls                        # 투표 목록
POST   /api/polls                        # 투표 생성
POST   /api/polls/{id}/vote              # 투표 참여
DELETE /api/polls/{id}                   # 투표 삭제
```

---

## Railway 배포

### 환경변수

Railway 대시보드 → Variables:

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_API_URL` | (빈 값) — Railway 자동 라우팅 사용 |
| `GAME_ADMIN_PASSWORD` | 게임 기록 삭제 비밀번호 (기본값: `1004`) |

### 배포

```bash
git push origin main  # Railway 자동 빌드 트리거
```

---

## 로컬 개발

```bash
# API만
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

# 웹만
cd web && npm run dev

# 동시 실행
./scripts/dev.sh
```

---

## 오픈소스 사용

| 라이브러리 | 라이선스 | 용도 |
|-----------|---------|------|
| [lazygyu/roulette](https://github.com/lazygyu/roulette) | MIT | 핀볼 물리 엔진 (box2d-wasm) |

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

**마지막 업데이트:** 2026년 3월 28일 · v2.0.0
