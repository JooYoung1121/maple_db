# AGENTS.md — 메이플랜드 DB (memorymapledb)

코딩 에이전트(Codex 등)용 작업 규칙입니다. 상세한 도메인 지식은 `docs/handoff/knowledge.md`에 있고, 진행 상황은 `docs/handoff/status.md`에 있습니다.
**작업 전에 이 파일을 읽고, 관련 주제가 있으면 knowledge.md의 해당 절도 읽으세요.**

## 1. 사용자 소통
- 모든 응답은 **한국어**로 작성합니다. 코드·식별자·로그·명령어는 원문을 그대로 둡니다.
- 근거에는 출처를 붙입니다. 외부 자료는 URL, 코드는 `파일:라인`으로 표기합니다.
- 확인한 사실과 추론·추측은 구분해서 표기합니다.

## 2. 배포·릴리즈 절차 (중요)
- **main에 push하면 Railway가 즉시 배포합니다.** 주소는 https://memorymapledb.up.railway.app 입니다.
- main에 직접 push하지 않습니다. `origin/main` 기준으로 브랜치(`feat/…`, `fix/…`, `chore/…`, `docs/…`)를 만들어 커밋하고 PR을 올립니다.
- **머지는 사용자가 지시할 때만 합니다.**
- 사용자의 한 지시 흐름은 PR 1개, 버전 1개로 묶습니다. 같은 흐름의 후속 지시는 아직 머지되지 않은 그 PR에 추가합니다.
  - 그 전에 반드시 `gh pr view <n> --json state`로 머지 여부를 확인합니다. 이미 머지됐다면 새 브랜치를 만들고 패치 버전을 올립니다(2026-11-15 #249 누락 사고).
- 버전은 두 곳을 함께 고칩니다.
  - `web/lib/version.ts` (`APP_VERSION`)
  - `web/lib/changelog.ts` (맨 위 항목, `pages`에는 경로만)
  - 버전 번호는 머지 직전에 최신 main 기준으로 확정합니다. 새 기능은 minor, 수정은 patch입니다.
- 태그와 GitHub 릴리즈는 **머지 후** 머지 커밋에 만듭니다.
  - 예: `git tag vX.Y.Z <merge>` → `git push origin vX.Y.Z` → `gh release create vX.Y.Z --verify-tag`
- 로컬 main과 origin/main의 히스토리가 다릅니다(스쿼시 머지). 브랜치는 항상 `origin/main`에서 따고, rebase 대신 cherry-pick을 씁니다.
- 커밋 메시지는 `feat: vX.Y.Z — 요약`, `fix: …`, `chore: …` 형식입니다.

## 3. 절대 금지
- **유저 데이터 테이블을 삭제하거나 덮어쓰지 않습니다.** 대상: bimae_posts, scroll_rankings, game_results, community_polls(+votes), guild_posts, guild_members, boss_runs, boss_recruitments, fee_records, bot_settings, free_board_posts/comments, weekly_news_issues, boss_timer_rooms, event_guides, users 등.
  - 서버 DB를 갱신할 때는 게임 데이터 테이블만 DELETE+INSERT 합니다. DB 파일을 통째로 복사하거나 `DROP TABLE` 하지 않습니다(2026-04-07 사고).
- **`git add -A` / `git add .`을 쓰지 않습니다.** 파일을 하나씩 지정해서 stage 합니다. 메인 체크아웃에는 커밋하면 안 되는 로컬 변경(`data/maple.db`, `.gitignore`, `tools/`)이 남아 있습니다.
- 비밀값(관리자 비밀번호, 세션 시크릿, 토큰)을 코드·문서·`data/maple.db`에 커밋하지 않습니다. `bot_settings.session_secret`이 DB에 생기면 커밋 전에 지웁니다.
- mapledb 크롤러로 mobs/maps를 `--force` 재크롤 하지 않습니다. 파서가 깨져 있어서 이름과 레벨이 훼손됩니다. 안전한 건 blog-all뿐입니다.
- 커뮤니티 실측 드롭률(`source='community'`) 행은 덮어쓰지 않습니다.

## 4. 구조
- `api/`: FastAPI와 SQLite(`data/maple.db`, FTS5). 라우트는 `api/routes/*.py`, 등록은 `api/main.py`.
- `web/`: Next.js 15 / React 19 / Tailwind 4. 페이지는 `web/app/*`, API 클라이언트는 `web/lib/api.ts`.
- `crawler/`, `scripts/`: 데이터 수집과 일회성 패치 스크립트. 패치는 `scripts/patch_YYYYMMDD_*.py` 패턴으로 dry-run이 기본이고 `--apply`로 적용합니다.
- `data/maple.db`는 git으로 추적합니다(바이너리). 백업·zip·wz_data는 무시합니다.
- **배포 시드 동기화**
  - 레퍼런스 DB 테이블을 바꿨으면 `start.sh`의 `SEED_TABLES`에 들어 있는지 확인합니다.
  - API가 읽는 `data/*.json`을 새로 추가했으면 `Dockerfile.railway`에 COPY를 추가합니다.
- **사이트 노출 화이트리스트**는 `data/mapleland_reference.json`입니다. 메이플랜드 ID 공간 기준이고 maplestory.io ID가 아닙니다.
  - 메랜 전용 수치 보정은 `data/mapleland_overrides.json`, 장비 메모와 공개 여부는 `data/equipment_notes.json`(`publish: true`)에 둡니다.
- **관리자 API**: 핸들러가 `request: Request`를 받아 `_require_admin(request)`를 호출하고, 클라이언트는 `X-Admin-Password` 헤더(env `GAME_ADMIN_PASSWORD`)를 보냅니다. 백엔드와 프론트를 반드시 함께 수정합니다.
- **UI**: 픽셀 디자인 시스템을 씁니다.
  - 클래스는 `pixel-panel`, `pixel-card`, `pixel-btn`, 색은 `bg-surface`, `text-ink`, `text-dim`, `maple` 토큰을 씁니다. raw gray/orange 클래스는 쓰지 않습니다.
  - Enter 키 핸들러에는 `!e.nativeEvent.isComposing` 가드를 넣습니다(한글 조합 중 중복 실행 방지).

## 5. 검증
- 백엔드 테스트: `python -m pytest tests/` 또는 `python -m unittest discover -s tests`. venv는 `.venv`입니다(이 Mac에는 `python` 별칭이 없어서 `.venv/bin/python`을 씁니다).
  - `tests/test_site_features_export.py`는 main에서도 실패하는 기존 실패입니다.
- 프론트: `cd web && npx tsc --noEmit -p .`, 필요하면 `npm run build`.
- `next dev`가 `web/package.json`의 typescript 버전을 고정값으로 바꿀 수 있습니다. 바뀌면 커밋하지 말고 되돌립니다.
- 라이브 API에 테스트 데이터(보스 타이머 방 등)를 만들지 않습니다.

## 6. 데이터 원칙 (메이플랜드 = 빅뱅 전 KMST 기반)
- 우선순위는 **공식 공지(maple.land) > 유저 실측 > 원작 덤프(GMS 등, 참고값 표기)** 입니다. 원작 덤프는 대부분 빅뱅 이후 수치라 메랜과 다를 수 있습니다.
- 공개되지 않은 수치(경험치, 확률 가중치 등)는 지어내지 않습니다. "미공개" 또는 "실측 필요"로 표기하거나 노출을 보류합니다.
- 퀴즈류에서는 900만번대 특수 몹(id ≥ 9000000)을 제외합니다. 도감 노출 판단은 레퍼런스 화이트리스트로 합니다.

## 7. 정기 운영 업무
- **주간 메랜(신문)**: 매주 일요일 발행합니다.
  - 절차는 `.claude/commands/weekly-news.md`와 `scripts/weekly_news_generate.py`, knowledge.md의 `project_weekly_news` 절을 봅니다.
  - 디시 수집은 로컬에서만 돌립니다(서버 IP 차단).
  - 발행 후 `data/maple.db` 반영 커밋과 PR까지 해야 완료입니다.
  - 실명 저격이나 사적 분쟁 글은 제외합니다.
- **이벤트 정리**: 라이브 admin API(`/api/events`)로 관리합니다. 수정 전에 GET으로 백업합니다.
- **패치 대응**: 공지 확인 → `scripts/patch_*.py` → reference와 overrides 갱신 → 관련 가이드 페이지 수정 → 버전 올림 → PR.
- **OX 퀴즈 족보, 핑크빈 체크**: knowledge.md의 해당 절을 봅니다.

## 8. 외부 데이터 출처 주의
- 디시인사이드는 서버 IP가 차단돼 있어 로컬에서만 크롤합니다.
- matip.kr은 `/market` 시세 프록시(`api/routes/matip.py`)입니다.
- **itemchart.net(템차트)**
  - `/market`의 매물 검색과 비교(v4.25.0, `api/itemchart_service.py`)가 사용자 요청이 있을 때 공개 페이지를 조회합니다.
  - 템차트 robots.txt는 `/api/`를 모든 봇에 금지하고, AI 에이전트 UA는 사이트 전체를 금지합니다. 페이지 형식이 바뀌거나 차단되면 기능이 깨집니다.
  - 요청량 제한과 캐시를 줄이지 말고, 가능하면 운영자의 허락이나 제휴를 받는 쪽으로 진행합니다.
