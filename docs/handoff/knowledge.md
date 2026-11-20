# 프로젝트 지식 베이스 (Claude Code 메모리 이관본)

> 2026-11-20 Claude Code의 세션 간 메모리(30건)를 그대로 옮긴 문서. 각 항목은 작성 시점 기준이라 코드·파일명은 사용 전에 실제로 존재하는지 확인할 것.
> 비밀값(관리자 비밀번호 등)은 제거했다. 실제 값은 로컬 `.env`·Railway 환경변수에서 확인.

## 목차

- [feedback_version](#feedback-version) — 릴리즈 절차 — 브랜치+PR로 작업, 매 변경 즉시 main 배포 금지 (2026-07-31 개정)
- [feedback_never_touch_user_data](#feedback-never-touch-user-data) — 서버 DB 동기화 시 유저 생성 테이블(bimae_posts, guild 등)을 절대 삭제/덮어쓰기 하지 않을 것
- [project_deploy_seed_sync](#project-deploy-seed-sync) — 레퍼런스 DB 데이터 변경은 start.sh의 SEED_TABLES에 테이블을 추가해야 라이브에 반영됨
- [project_edelstein_provenance](#project-edelstein-provenance) — 에델슈타인/레지스탕스 데이터 시점 함정 — 메랜은 빅뱅 전 KMST 기준인데 추출 가능한 원작 데이터는 전부 빅뱅 후 GMS뿐
- [project_mapleland_id_space](#project-mapleland-id-space) — 몹 드롭/출현맵은 메이플랜드 레퍼런스 ID에 붙어야 사이트에 노출됨 (maplestory.io ID 아님)
- [project_repo_hygiene](#project-repo-hygiene) — 저장소 커밋 위생 — 배포 시드 DB는 추적, 백업/아카이브는 무시
- [project_admin_auth](#project-admin-auth) — 관리자 API 인증 패턴 — _require_admin(request) + X-Admin-Password 헤더
- [project_discord_auth](#project-discord-auth) — 디스코드 로그인 인프라 (v3.62.0) — 세션·개인화 저장 구조와 활성화 env, 확장 시 규칙
- [project_pixel_design_system](#project-pixel-design-system) — 웹 프론트 픽셀 어드벤처 디자인 시스템 — 새 UI는 이 토큰/컴포넌트로
- [project_mapleland_2_0](#project-mapleland-2-0) — 메이플랜드 2.0 전환 — 사이트 대응 현황과 남은 작업
- [project_mapledb_parser_broken](#project-mapledb-parser-broken) — mapledb.kr 크롤 파서 깨짐 — mobs/maps --force 금지
- [project_quiz_special_mobs](#project-quiz-special-mobs) — 900만번대 몹 ID는 퀘스트/이벤트 특수몹 — 퀴즈 등 유저 대면 기능에서 제외해야 함
- [project_weekly_news](#project-weekly-news) — 주간 메랜(주간 뉴스) 발행 파이프라인 — 디시 수집은 로컬 crawl 필수(서버 IP 차단으로 서버 자동 수집은 항상 0건), 호 생성·발행은 로컬 claude -p
- [project_v3_29_features](#project-v3-29-features) — v3.29.0 신기능(스킬시뮬/채널가이드/오늘의몬스터)의 데이터 소스와 운영 규칙
- [project_ime_enter_guard](#project-ime-enter-guard) — Enter 키 핸들러에는 반드시 !e.nativeEvent.isComposing 가드 필요 (한글 IME 중복 실행 버그)
- [project_map_details](#project-map-details) — map_details 테이블 — maplestory.io GMS v92 기반 맵 구조도·스폰 위치 데이터 (v3.43.0)
- [project_2_0_backlog](#project-2-0-backlog) — 2.0 대응 백로그 — 퀘스트 재크롤 주기, 월드컵 사진 업로드, 카드 드롭률 낡음, 코디 시뮬 후속
- [project_git_history_divergence](#project-git-history-divergence) — 로컬 main과 origin/main 히스토리가 다름(스쿼시 머지) — 브랜치는 origin/main 기준으로, rebase 대신 cherry-pick
- [project_pinkbean_check](#project-pinkbean-check) — 핑크빈(시간의 신전 원정대 보스) 정기 실측 체크 — 9/18 오픈, 클리어 가능성(맥뎀)·드롭·원정대 스펙 추적
- [project_drop_rate_provenance](#project-drop-rate-provenance) — 드랍률 출처 체계 — community(실측) > mapledb(메랜DB) > maplekibun(옛메 블로그 참고값), 동기화는 sync_drop_rates_from_mapledb.py
- [project_recruit_card](#project-recruit-card) — 구인구직 카드 메이커(/recruit-card) 운영 — 아트 추가 절차(파일만 얹으면 자동 노출), AI 변환은 디스코드 로그인 월 2회, Gemini 이미지 무료 티어 쿼터 이슈
- [project_malaysia_20261008](#project-malaysia-20261008) — 10/8 말레이시아·혼줌 패치 반영(PR #228) — 머지 후 --live 보스 플래그 필요, 히비스커스 길목 3 보류
- [project_chaos_scroll_rules](#project-chaos-scroll-rules) — 메이플랜드 혼돈의 주문서(혼줌) 사용 규칙 — 악세서리 한정, 귀고리는 불가, 세부 확률 미공개
- [project_maple_items_3rd_anniv](#project-maple-items-3rd-anniv) — 메이플 무기류 메랜 노출 현황과 메이플 건 3종 \"데이터만 준비·미노출\" 결정 (v4.18.4, 2026-10-16)
- [project_event_guides](#project-event-guides) — 이벤트 정리(event_guides)는 라이브 admin API로 관리, 종료는 ISO로 저장(날짜만=그날 포함), 기한은 content.deadlines (v4.19.0)
- [project_ox_quiz](#project-ox-quiz) — 3주년 토요일 21시 OX퀴즈 족보(/ox, 봇 !ox) — 원작 OXQuiz.img 1~9세트 기반, 메랜은 다르게 출제하므로 실제 출제분은 basis=observed로 누적
- [project_neo_tokyo](#project-neo-tokyo) — 네오도쿄(KMS 미출시) 데이터 출처 — 로컬 wz_data_v62(대만판) Mob_info가 디시 '테섭 기준' 수치와 일치, CMS/148은 빅뱅 후 수치
- [project_monster_carnival2](#project-monster-carnival2) — 몬스터 카니발 2(11/13 출시) 반영 상태 — 슈혼목 업횟 1(원작 3), 소환몹 미등록 이유, 출처 이미지
- [feedback_check_pr_merged](#feedback-check-pr-merged) — 열린 PR에 후속 커밋을 push하기 전 gh pr view로 머지 여부 확인 — 이미 머지됐으면 새 브랜치·새 패치 버전

---

## feedback_version

*분류: memory · 릴리즈 절차 — 브랜치+PR로 작업, 매 변경 즉시 main 배포 금지 (2026-07-31 개정)*

**2026-07-31 개정**: 사용자 지시 — "매번 작업하고 푸시해서 버전 올려 배포하지 말고, 브랜치 따서 기능 추가하고 버전도 같이 관리해라. 잦은 배포는 별로다."

**Why:** main 푸시 = Railway 즉시 배포라서, 잦은 소규모 릴리즈가 부담. 코덱스도 PR 워크플로우 사용 중(PR #171~).

**How to apply:**
1. 작업은 **브랜치**에서: `git checkout -b feat/... | fix/...` → 커밋 → `git push -u origin <branch>` → `gh pr create`
2. **머지는 기본적으로 사용자 판단** — PR 만들고 보고. 단, 사용자가 "머지까지 해줘"라고 하면 `gh pr merge` 후 태그·릴리즈까지 진행. 하나의 지시 흐름에서 나온 작업들은 **한 브랜치·한 PR·한 버전으로 묶는다** (2026-07-31: PR을 잘게 쪼갰다가 "왜 따로냐, 묶어라" 피드백 받음)
2-0. **같은 세션의 후속 지시도, 앞 PR이 아직 머지 전이면 그 PR에 합쳐 한 버전으로** (2026-09-04: 스택 PR #202/#203로 나눴다가 "한 PR에 한 버전으로 싹 몰아서" 피드백 — ff-merge로 합치고 체인지로그 엔트리 병합, 뒤 PR은 닫음). 스택 PR 만들지 말 것.
2-1. **버전 번호는 머지 직전 최신 origin/main 기준으로 확정** — 코덱스가 병행으로 PR을 머지하므로, 내 PR이 낡은 버전을 달고 있으면 머지 전에 리베이스 + 버전 재지정 (예: main이 3.74.0이 되면 내 PR은 3.74.1로). 리베이스 시 작업 트리의 코덱스 미커밋 WIP는 `git stash push -- <파일들>`로 보호 후 복원
3. 버전 관리는 PR 안에 포함 (머지 = 배포가 자체 완결되도록):
   - `web/lib/version.ts` APP_VERSION (버전 단일 소스 — 푸터·버전 페이지 공유)
   - `web/lib/changelog.ts` CHANGELOG 맨 위 엔트리 (버전 페이지·홈 최근 업데이트 위젯 공유)
   - 새 페이지면 `web/lib/newFeatures.ts` href+날짜 (14일 N 배지)
   - 새 기능 = minor / 버그 수정 = patch
4. `git tag` + `gh release create`는 **머지 후** (배포된 것만 릴리즈로) — 머지를 내가 하게 되면 그때 함께
5. 주의: 브랜치 작업 시 코덱스의 미커밋 변경(예: api/routes/info_board.py WIP)을 커밋에 포함하지 말 것 — 파일 단위로만 staging

배포: main 푸시 → Railway 자동 빌드. 주소 `https://memorymapledb.up.railway.app`, 관리자 비번 env `GAME_ADMIN_PASSWORD`.

---

## feedback_never_touch_user_data

*분류: feedback · 서버 DB 동기화 시 유저 생성 테이블(bimae_posts, guild 등)을 절대 삭제/덮어쓰기 하지 않을 것*

서버 DB 동기화 시 유저 데이터(bimae_posts, guild_members, game_results, community_polls 등)를 절대 건드리면 안 됨.

**Why:** start.sh에서 시드 DB를 볼륨에 통째로 cp하면서 비매 게시판 등 유저가 서버에서 생성한 데이터가 전부 삭제되는 사고 발생 (2026-04-07).

**How to apply:** 서버 DB 업데이트가 필요할 때는 반드시 **특정 게임 데이터 테이블만 DELETE+INSERT**로 교체. 절대 DB 파일 자체를 cp하거나 DROP TABLE하지 않기. 유저 테이블 목록: bimae_posts, scroll_rankings, game_results, community_polls, community_poll_votes, guild_posts, guild_members, boss_runs, boss_recruitments, fee_records, bot_settings, free_board_posts, free_board_comments.

---

## project_deploy_seed_sync

*분류: memory · 레퍼런스 DB 데이터 변경은 start.sh의 SEED_TABLES에 테이블을 추가해야 라이브에 반영됨*

운영(Railway)은 영구 볼륨 `/data/maple.db`를 사용하고, 배포 시 `start.sh`는 **화이트리스트(`SEED_TABLES`)에 든 레퍼런스 테이블만** 시드 DB에서 DROP+CREATE로 교체한다. 나머지(특히 유저 데이터 테이블)는 보존하기 위해 일부러 손대지 않는다 (2026-04-07 사고 대응).

**How to apply:** `data/maple.db`의 레퍼런스 테이블(예: mobs/items/maps/mob_drops/mob_spawns 등)을 갱신하면, 커밋만으로는 라이브에 안 나온다. `start.sh`의 `SEED_TABLES` 리스트에 해당 테이블을 추가해야 볼륨 DB로 동기화된다. 현재 등록: `quests`, `mob_drops`, `mob_spawns`, `sim_jobs`, `sim_skills`, `items` (v3.33.3 기준).

**특례:** `entity_names_en`(한글명)은 관리자가 라이브에서 몹 이름을 수정하는 테이블이라 통째 교체 금지 — start.sh가 INSERT OR IGNORE로 **없는 행만 추가** 동기화한다(v3.33.3). `mobs` 테이블도 관리자 is_hidden/is_boss 수정이 있어 SEED_TABLES 금지.

**Why:** 볼륨 DB가 한 번 생성되면 시드는 화이트리스트 테이블만 덮어쓰므로, 신규 테이블/데이터는 명시적으로 추가하지 않는 한 옛 버전이 그대로 서빙된다.

유저 데이터 테이블은 절대 SEED_TABLES에 넣지 말 것 — `feedback_never_touch_user_data`.

**data/*.json 파일도 화이트리스트:** `Dockerfile.railway`는 `data/` 파일을 개별 `COPY`로만 이미지에 넣는다. API가 읽는 새 JSON(예: `data/ox_quiz.json`)을 추가하면 COPY 줄도 같이 추가해야 한다 — 빠지면 라우트는 뜨지만 500 (2026-10-31 OX 족보 v4.21.0 누락, v4.21.1에서 수정).

---

## project_edelstein_provenance

*분류: memory · 에델슈타인/레지스탕스 데이터 시점 함정 — 메랜은 빅뱅 전 KMST 기준인데 추출 가능한 원작 데이터는 전부 빅뱅 후 GMS뿐*

에델슈타인·레지스탕스(배틀메이지)는 빅뱅 이전 KMST(2010-05-25)~KMS 1.2.105(2010-07-22)에 존재했던 콘텐츠이고, 메이플랜드도 공지에서 "빅뱅 이전 KMST 공개 데이터 기준"이라고 명시했다. 그러나 **추출 가능한 클라이언트 덤프(maplestory.io)는 전부 빅뱅 이후 버전(GMS v93~95, KMS는 v284+만 호스팅)** 이라 이 지역의 원작 참고값은 시점이 어긋난다.

**Why:** 실제 사고 사례 — GMS 기준으로 넣은 몹 레벨 7종이 9/7 공지 확정값과 불일치(라칸 82→83 등, v3.97.0에서 교정), EXP는 실측이 GMS의 약 2.3배(버닝 1.5배 감안해도 상이), 광석 이터 HP도 67,000(GMS)→57,000(몬스터북 실측). 빅뱅 후 KMS 드롭표(유튜브 등)도 메랜과 다름이 실측으로 확인됨(광석 이터 배메 마북 삭제).

**How to apply:**
- 에델 지역 데이터 우선순위: ① 메랜 공식 공지 ② 커뮤니티 실측(몬스터북·툴팁 스샷) ③ GMS v95 참고값(최후순위, 표기 필수)
- GMS 데이터로 에델 항목을 채울 땐 반드시 "참고값" 표기 + 실측으로 교체 대상임을 기록
- 사이트 표기: canonDiffs "edelstein.data-provenance"(맵 상세) + entityCanonDiffs EDELSTEIN_MOB_DIFFS(몹 상세 25종) + /battle-mage 판본 안내에 등록돼 있음 (v4.0.1)
- 미검증 잔여: 광석길=큰 바위베어먹기 vs 바위길=아기 순서(공지 맵 순서와 GMS 배치가 반대 — 실측 필요), 스폰 마릿수, 몹 HP 대부분

관련: `project-mapleland-id-space`, `project-2-0-backlog`

---

## project_mapleland_id_space

*분류: memory · 몹 드롭/출현맵은 메이플랜드 레퍼런스 ID에 붙어야 사이트에 노출됨 (maplestory.io ID 아님)*

사이트는 몹을 **메이플랜드 레퍼런스**(`data/mapleland_reference.json`, `name_kr` 기반) ID 집합으로만 노출한다. `api/routes/items.py`·`mobs.py` 등이 `id_filter_sql(..., "mobs")`로 이 ID 화이트리스트를 적용한다. 반면 `mobs`/`entity_names_en` 테이블에는 maplestory.io GMS92 기준 1877몹이 있고, 같은 몬스터가 여러 ID(필드/소환/[★]보스/이벤트 변종)로 중복 존재한다.

**핵심 함정:** 블로그(maplekibun) 드롭을 KMS 이름으로 매칭하면 maplestory.io ID(예: 바이킹 9300324)에 붙는데, 메이플랜드 레퍼런스의 같은 몹은 다른 ID(바이킹 8141000 `[★]`)다. 어긋나면 드롭이 사이트에서 안 보인다.

**How to apply:** 드롭/출현맵을 새로 매칭·삽입할 때는 메이플랜드 레퍼런스 ID(`name_kr`+레벨 매칭)를 대상으로 해야 한다. 사후 교정 도구: `scripts/remap_drops_to_mapleland.py`(maplestory.io→ML ID 재매핑), `scripts/supplement_mapleland_reference.py`(레퍼런스에 빠진 몹 추가 — 멱등). 레퍼런스는 `sync_mapleland_reference.js`가 재생성하므로 재싱크 후 supplement 재실행 필요.

레퍼런스는 불완전(crawl 누락)해서 한때 혼테일·핑크빈·시간의 신전·쇼와타운이 빠져 있었음(v3.14.0에서 70몹 보강, 819몹). 관련: `project_deploy_seed_sync` (mob_drops/mob_spawns는 볼륨 동기화 대상).

---

## project_repo_hygiene

*분류: memory · 저장소 커밋 위생 — 배포 시드 DB는 추적, 백업/아카이브는 무시*

`data/maple.db`는 **배포용 시드라 git 추적을 유지**해야 한다 (`.gitignore:5` 주석). 반면 `data/*.db.bak*`, `data/maple_canonical.db`, `*.zip`, `wz_data/`, `62//83/` 등 백업·대용량 아카이브는 `.gitignore`로 제외(2026-06-23 추가).

작업 디렉토리에 untracked 대용량 파일(수백 MB~수 GB)이 상시 떠 있으므로 `git add -A` 금지. 커밋 시 **변경한 파일만 명시적으로 add**할 것. 관련: `feedback_never_touch_user_data`

---

## project_admin_auth

*분류: memory · 관리자 API 인증 패턴 — _require_admin(request) + X-Admin-Password 헤더*

관리자 보호 엔드포인트는 핸들러에 `request: Request` 인자를 받고 `_require_admin(request)`를 호출해야 한다 (`api/routes/admin.py`). 비번은 `X-Admin-Password` 헤더로 전달, 기본값 `GAME_ADMIN_PASSWORD`(미설정 시 "<레거시 기본값>", 운영에선 환경변수 필수).

프론트는 `web/lib/api.ts`의 admin 함수에 비밀번호를 첫 인자로 넘겨 헤더로 실어보낸다. 새 admin 엔드포인트 추가 시 백엔드 인증 + 프론트 헤더 전달을 **함께** 해야 깨지지 않음 (2026-06-23 admin/mobs GET·PATCH·DELETE 인증 누락분 보강 사례).

---

## project_discord_auth

*분류: memory · 디스코드 로그인 인프라 (v3.62.0) — 세션·개인화 저장 구조와 활성화 env, 확장 시 규칙*

v3.62.0(2026-07-27)에 디스코드 OAuth 로그인 도입. 자체 회원가입 없음(비밀번호 미저장 원칙).

**Why:** 이후 기능들이 이 인프라를 재사용해야 하고, 활성화 env는 Railway에만 있어 잊기 쉬움.

**How to apply:**
- 구조: `api/routes/auth.py` — OAuth(identify만) → `users` 테이블, HMAC 세션 쿠키 `ml_session`(30일). 길드 멤버십·별명·역할은 `DISCORD_BOT_TOKEN` + `DISCORD_GUILD_ID`로 봇이 조회 (`_fetch_guild_profile`)
- 활성화 env (Railway): `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_GUILD_ID` + Developer Portal에 redirect `https://memorymapledb.up.railway.app/api/auth/discord/callback` 등록. 미설정이면 로그인 버튼 자동 숨김(`/api/auth/config`)
- 세션 시크릿: env `SESSION_SECRET` 우선, 없으면 bot_settings key='session_secret' 1회 생성 영속. 로컬 data/maple.db에 이 값 커밋 금지 (커밋 전 삭제)
- 개인화 저장: `PUT/GET /api/me/settings/{key}` — 키는 auth.py `SETTINGS_KEYS` 화이트리스트(brain_char, my_maple, favorites)에 추가해야 사용 가능, 값 16KB 제한
- 서버 라우트에서 로그인 유저 얻기: `from api.routes.auth import current_user_id` (Request → int|None)
- `users`/`user_settings`는 유저 데이터 — `feedback-never-touch-user-data` SEED_TABLES 금지
- 길드원 전용 기능 게이트: users.guild_member=1 확인 (로그인 시점 스냅샷 — 최신성 필요하면 재조회)

---

## project_pixel_design_system

*분류: memory · 웹 프론트 픽셀 어드벤처 디자인 시스템 — 새 UI는 이 토큰/컴포넌트로*

web/ 프론트는 v3.18.0(2026-06-23)부터 "픽셀 어드벤처" 디자인 시스템 사용. 새 페이지/컴포넌트는 회색/흰색/주황 raw Tailwind 대신 이 토큰을 써야 일관됨. 정의처: `web/app/globals.css`.

**시맨틱 토큰**(Tailwind v4 @theme, 라이트=낮의 필드/다크=동굴 던전 자동 전환):
- 배경 `bg-bg`(페이지)·`bg-surface`(카드/패널)·`bg-surface2`(보조면/입력)
- 글자 `text-ink`(본문/제목)·`text-dim`(보조)
- 액센트 `text-maple`/`bg-maple`(주황 브랜드)·`text-slime`(성공)·`text-mush`(위험)·`text-skill`(정보)·`border-edge`

**컴포넌트 클래스**: `.pixel-panel`(정적 박스, 베벨), `.pixel-card`(클릭 카드, 호버), `.pixel-btn`(주요 버튼), `.pixel-input`(input/select/textarea), `.pixel-badge`(칩), `.font-pixel`(갈무리 — 제목·네비·뱃지·통계라벨에만; 긴 본문/표는 Pretendard로 가독성 유지).

주의: pixel-panel/card는 `background:var(--c-surface)`를 강제하므로 maple 틴트 박스가 필요하면 패널 대신 `border-2 border-maple` + `bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)]` 사용. 난이도/카테고리/위험·성공 등 의미색은 보존. 폰트는 갈무리·Pretendard CDN(layout.tsx의 jsdelivr <link>). 관련: `feedback_version`

---

## project_mapleland_2_0

*분류: memory · 메이플랜드 2.0 전환 — 사이트 대응 현황과 남은 작업*

메이플랜드가 2.0으로 재탄생 중. 핵심 일정(공식 공지 기준): 점검·데이터 이관 2026.6.19~6.30, **6/30 2.0 정식 오픈**. 빅토리아 월드 → "Mapleland" 본 월드로 개명, 나머지 5개 월드 종료. **버닝 월드**(기간한정 이벤트 월드, 2.0 콘텐츠 즉시 적용) 6.19~9.11, 월드 리프(본 월드 이전) ~9.25. **테스피아**는 2.0 이후에도 테스트 서버로 존속.

2.0 변경점: 거래소+모든 거래 수수료 5% 통일 / 미니던전 / 창고·캐시보관함 / 몬스터북 / 메이커 정식 / 카오스자쿰 / 멀티펫 / 모험가의 귀환(KMS 1.2.89) 밸런스 / 신규클래스 해적·시그너스 / 신규지역 시간의신전. 여름 로드맵: 7/16 핑크빈·발록·원정대, 7/24 무릉도장, 8/14 파티찾기·결혼.

**사이트 대응 현황** (v3.19.0, 2026-06-23): 네이밍(2.0)·news 탭 재정의·버닝월드 배너·/fee 5% 정률 완료.
**추가 대응** (2026-07-16, v3.43.0~v3.44.0): 맵 정보 리빌딩(`project-map-details`) / 7/16 패치(마왕 발록·카오스 자쿰·원정대) 레퍼런스 반영 / **2.0 스폰 정합화 완료** — 2.0은 몬스터 배치가 원작(GMS v92) 복원임이 7/16 패치노트 개발자 코멘트로 확정, `scripts/sync_spawns_from_map_details.py`로 mob_spawns 218건 보강. 단 ML이 일부 인기 사냥터(블와둥 등 5곳, 7/16)는 1.0 배치로 되돌리는 중 — 스폰 데이터는 원작 기준 + '원작 미출현' 배지 체계.
**남은 작업(미완)**: 마왕발록 퀘스트 11종 미수록 / 8830000 '마왕 발록' 개명이 라이브 entity_names_en(additive 동기화)에 자동 반영 안 됨 — 관리자 몹명 수정 1회 필요 / 예정: 7/24 무릉도장, 8/14 파티찾기·결혼 (7/16 예고였던 핑크빈은 미출시). 참고 `project_mapleland_id_space` `project_deploy_seed_sync`.

---

## project_mapledb_parser_broken

*분류: memory · mapledb.kr 크롤 파서 깨짐 — mobs/maps --force 금지*

**2026-07-13 업데이트: mapledb.kr 사이트 자체가 접속 불가**(https/http 모두 타임아웃). 유저와 합의: mapledb 크롤은 완전 중단. 필요 데이터는 이미 로컬 보유 — 레퍼런스 목록은 data/mapleland_reference.json(6/5 스냅샷+수동 보강), 게임 데이터 본체는 maplestory.io 수집분+로컬 v83 WZ(83/). 레퍼런스 누락 발견 시 supplement/직접 편집으로 보강(세라핌즈·다크카티나스 사례). 드롭이 변형 ID에 붙은 문제는 scripts/remap_drop_items_to_mapleland.py(아이템 축)·remap_drops_to_mapleland.py(몹 축)로 해결.

2026-06-24 기준 **mapledb.kr 상세 파서가 깨져 있다.** `crawler/main.py`의 `_crawl_entity_type`(mobs/maps/items/npcs/quests, 소스 mapledb.kr)을 `--force`로 돌리면 상세 페이지에서 이름을 사이트 제목 **"메이플랜드데이터베이스"**로, level을 **0**으로 파싱해 기존 데이터를 전부 덮어쓴다(몹 749·맵 1082 전멸 사례). mapledb.kr HTML이 바뀐 것으로 추정.

따라서 파서를 고치기 전까지 `crawl --type mobs|maps|items|npcs|quests --force` **실행 금지.** 안전한 재수집은 `blog-all`(로컬 blog_posts 파싱 → mob_spawns/mob_drops/skills, 외부요청 없음)뿐. maple-land 공지 크롤러는 별개로 정상.

**maplestory.io 경로도 위험**(2026-06-24 확인): `crawl --type maplestory-io`(crawl_gms_data)는 bulk mob 응답이 `{id,name,level,isBoss}`만 주고 스탯이 없는데 `_save_mob_gms`가 INSERT OR REPLACE라 hp/exp=0으로 전멸 위험. 스탯0이면 스킵하는 가드를 넣어뒀지만(커밋 6d05f90), 그래서 bulk mob 갱신은 사실상 no-op. 제대로 쓰려면 detail 엔드포인트(`detail-mobs`)로 meta 받아 병합하도록 고쳐야 함. **데이터는 빅뱅 전 정적 = 2.0 기반과 동일이라 재수집 실익 거의 없음 → 현재는 재수집 자체를 권장 안 함.**

**젠 수(spawn_count) 데이터 출처 주의**(2026-06-26): 맵별 몹 젠 수는 `scripts/crawl_spawn_counts.py`로 maplestory.io GMS/62 `map/{id}` 의 `mobs`(스폰 지점) 개수에서 수집(mob_spawns.spawn_count, 930행). **그런데 이건 원작(KMS) 기준값**이고 메이플랜드 자체 젠/버닝 버프와 다를 수 있음. **mapledb.kr도 동일 gms/62를 프록시**해서 같은 숫자가 나옴 → 공개된 "메랜 전용 젠표"는 존재하지 않음(maplewidget=현행 메이플, 메랜쩔=몹목록만). 그래서 사이트엔 "원작 기준 참고값"으로 표기함. 진짜 메랜/버닝 젠은 인게임 측정뿐.

재수집 시 반드시 먼저 `cp data/maple.db data/maple.db.bak_...` 백업하고, 끝나면 유저테이블(guild_members 등) + 이름깨짐(`name='메이플랜드데이터베이스'`) + visible_mobs 수를 백업과 비교 검증할 것. 메이플랜드 2.0은 빅뱅 이전 기반이라 기존 정적 데이터로 충분 → 무리한 재크롤 실익 적음. 관련 `project_mapleland_2-0` `feedback_never_touch_user_data`

---

## project_quiz_special_mobs

*분류: memory · 900만번대 몹 ID는 퀘스트/이벤트 특수몹 — 퀴즈 등 유저 대면 기능에서 제외해야 함*

몹 ID 9,000,000 이상(93xxxxx/94xxxxx/95xxxxx)은 튜토리얼·퀘스트·이벤트용 특수몹으로, 일반몹 스프라이트를 재사용하는 변종이 많다 (예: 9300084 "죽음의 공포" = 플라이아이 외형, "보스 몬스터 퇴치 체크용 투명 몬스터" 등). `/api/mobs` mapleland 필터를 통과하는 628마리 중 260마리가 이 대역.

**Why:** 퀴즈에서 플라이아이 그림에 정답이 "죽음의 공포"로 나오는 등 유저 혼란 유발 (2026-07-03 길드원 제보).

**How to apply:** 유저 대면 기능(퀴즈 등)에서 몹 풀을 쓸 때 `id < 9000000` 필터 적용. 퀴즈는 v3.26.0에서 적용됨 (web/app/quiz/page.tsx 데이터 로드부).

**⚠️ 중대한 반례 (2026-09-29 데이터 감사에서 확인):** 이 룰은 퀴즈처럼 스프라이트 재사용으로 정답이 모호해지는 기능에만 한정할 것. 레퍼런스 화이트리스트 등재 노출 몹 939마리 중 421마리(45%)가 900만번대이고 여기 드랍 1,684행이 붙어 있음 — 닌자성(하급/중급/상급닌자, 갑주무사), 지하 감옥(수하/간부/두목) 등 정상 메이플랜드 콘텐츠. 드랍·체경비·검색 등 카탈로그 데이터의 게이트는 `id < 9000000`이 아니라 `project-mapleland-id-space` 레퍼런스 화이트리스트(data/mapleland_reference.json, api/routes/mapleland_reference.py id_filter_sql())여야 함. 데이터 정리/삭제에 이 ID 필터를 쓰면 노출 몹 45%가 날아감.

추가 발견 (v3.26.1): entity_names_en(kms, v284 크롤)에는 현대 KMS 오염이 더 있음 —
- `[★]` 접두어 22종 (스타포스 필드 표기, 버푼·소울테디·타나토스 등 — 몹 자체는 빅뱅 전 정통 몹)
- NPC 한국어명 결측 플레이스홀더 `'스트링 없음'` 18종 (maplestory.io가 문자열 없을 때 반환)
퀴즈는 cleanKmsName()으로 `[...]` 접두어 제거 + 결측 NPC 제외. 다른 화면(몹 목록/상세/검색)에는 [★]가 여전히 표시됨 — 전역 정리하려면 entity_names_en 데이터 정정 + SEED_TABLES 추가 필요.

---

## project_weekly_news

*분류: memory · 주간 메랜(주간 뉴스) 발행 파이프라인 — 디시 수집은 로컬 crawl 필수(서버 IP 차단으로 서버 자동 수집은 항상 0건), 호 생성·발행은 로컬 claude -p*

주간 메랜(/weekly, v3.27.0)은 2단 파이프라인: ① 서버가 디시 메이플랜드 갤러리를 `COMMUNITY_CRAWL_INTERVAL_MINUTES`(기본 360분) 주기로 `community_posts`에 수집(발췌 300자+링크만, 저작권 정책) ② 주 1회 로컬에서 `scripts/weekly_news_generate.py` collect→generate(claude -p, 프롬프트 `.claude/commands/weekly-news.md`)→publish.

**Why:** 사용자가 LLM 생성을 서버 API 키가 아닌 로컬 Claude Code 실행으로 결정(2026-07-08). 발행은 admin API(X-Admin-Password) 경유라 재배포 불필요.

**디시는 Railway IP를 차단**(200/빈 응답, 데스크톱·모바일 모두 — 2026-07-08 프로브로 확인): 서버 커뮤니티 크롤러는 항상 0건. 주간 `all`이 로컬에서 공홈+디시를 크롤(crawl 서브커맨드)한 뒤 `collect --local`로 진행(v3.28.4). 진단: `POST /api/weekly-news/crawl-community` (admin).

이미지(v3.28.0): 생성 AI 대신 **Claude 연출 JSON → Pillow 스프라이트 콜라주** (scripts/weekly_news_render.py, 표지+카드 2~4장, `weekly_news_images` 테이블 + /images/{slot} 서빙). 파이프라인은 collect→generate→render→publish. Galmuri 폰트·스프라이트는 첫 실행 시 자동 다운로드(data/fonts, gitignore).

자동화는 launchd가 아니라 **디스코드 리마인더**(사용자 선택): **매주 일요일 오전 8시 KST 정시**(v3.28.5, 전용 스케줄러+재시작 캐치업, `WEEKLY_REMINDER_HOUR`)에 리마인더 채널 `weekly_reminder_channel_id`(=추억길드테스트 1524308987720368169, v3.27.4)로 전송. 발행 완료 알림은 길드 공지 채널(channel_id)로 분리. `notify_weekly_news` 토글, `weekly_news_reminder_sent_week`로 주간 중복 방지. 테스트: `POST /api/discord/weekly-reminder-test`.

**How to apply:** 라이브 도메인 = https://memorymapledb.up.railway.app, 관리자 비번 = Railway 미설정이라 기본값(코드 하드코딩 레거시 값). 로컬 루트 `.env`에 WEEKLY_API_BASE·GAME_ADMIN_PASSWORD 저장돼 있고 발행 스크립트가 자동 로딩(v3.27.3) — 리마인더 명령은 `.venv/bin/python scripts/weekly_news_generate.py all`(이 Mac엔 `python` 별칭 없음, v3.44.2에서 리마인더 문구 수정). `all`은 publish 전 검토 대기로 멈추는 게 정상 — 내용 검토 후 `publish --week-start <월요일> --yes`. "[collect] WEEKLY_API_BASE 미설정" 로그는 all 모드의 의도된 로컬 수집 문구지 오류 아님. 공식 소식 크롤은 maple.land 단일 소스(테스피아 도메인 사망으로 v3.44.3에서 제거, 사용자 지시 2026-07-19 — 디시 수집은 유지). 제9호(2026-08-24주, 2026-08-31 발행)까지 발행 완료 — 8호(8/28)·9호(8/31) 모두 정기일(일요일)을 놓쳐 늦은 발행(로컬 crawl로 소급 수집, 개념글은 1주 뒤에도 소급 수집 가능함을 확인). 결호 대신 늦은 발행이 사용자 선택. **편집 원칙(9호, 2026-08-31)**: 실명 저격·미확인 사생활 폭로 글(BJ 학폭 폭로 등)은 화제성이 커도 기사에서 제외 — 명예훼손 리스크. claude -p 생성물이 실명을 포함할 수 있으니 발행 전 검수에서 확인. 주의: 2026-08-13 크롤이 "385건 저장" 보고에도 신규 행 미삽입된 이상 사례 1회 있었음(8/16 재크롤은 정상 315건) — 발행 전 `community_posts` first_seen 최신성 확인 습관화. 창간호는 2026-07-08 라이브 발행 완료. `weekly_news_issues`는 `project-deploy-seed-sync`의 SEED_TABLES에 넣지 말 것 — 라이브 볼륨에서 유지되는 유저 데이터류. **발행 후 저장소 반영까지가 파이프라인 완료 조건**: publish 후 `data/maple.db`에 해당 호(issues+images)를 넣는 "발행 데이터 반영" 커밋+PR까지 해야 끝 — 10호(9/8 발행)가 이 커밋 누락으로 라이브에만 존재하다 2026-09-17 라이브 API(`GET /api/weekly-news/{n}`, `/images/{slot}`)로 백필함(PR #211). 반영 커밋이 밀리면 main의 DB와 바이너리 충돌 나므로 발행 직후 바로 커밋할 것. 인벤 게시판(www.inven.co.kr/board/maple/6156, 주간 BEST 제공)은 2차 소스로 미구현. 스프라이트는 `project-quiz-special-mobs` 규칙대로 mob id<9000000만.

**16호(2026-10-12주, 10/18 발행, PR #236):** origin/main 기준 worktree에서 crawl→collect --local→(세션 내 직접 작성, `_meta.generator=claude-code-session`, validate_issue 통과)→render→publish→DB 반영 PR 순서로 진행했다. 로컬 작업 브랜치 DB가 낡았을 수 있으니 worktree 방식이 안전하다. 렌더러는 큰 NPC(예: 오르비스 메이플TV)를 scale과 무관하게 크게 그려 제목을 가리므로, 카드 스프라이트는 작은 몹을 쓴다.

**17호(2026-10-19주, 10/25 발행, PR #239):** maple.land 신규 공지 0건 주 — 공식 섹션은 "공지 없음"을 사실대로 + 커뮤니티 건의(친추 거절) 출처로 구성(validate_issue는 출처가 원자재 URL이어야 함). **자동화(2026-10-25 사용자 요청):** 디스코드 리마인더 대신 **Orca**(stablyai/orca 데스크톱 앱, `/usr/local/bin/orca`, Automations=cron 지원)로 매주 일요일 08:00 KST 무인 실행 — `--repo path:maple_db --base-branch origin/main`(실행마다 새 worktree), precheck로 이번 주 호 기발행 시 스킵, 프롬프트가 crawl→collect→generate→편집검수→render→audit→publish→DB PR까지(머지 금지). Orca의 claude 기본 인자가 `--dangerously-skip-permissions`라 무인 가능. 등록 명령은 자동 모드 분류기가 차단 → 사용자가 직접 실행. worktree엔 .venv/.env/fonts/sprite_cache가 없어 심링크·복사 필요.

**18호(2026-10-26주, 11/2 늦은 발행, PR #244):** 11/1 일요일 자동 발행이 안 됨 — `orca automations list`가 "No automations found"(10/25 등록 명령 미실행 추정). 수동 진행 시 maplestory.io가 대형 보스 스프라이트(핑크빈 8820011·카오스 자쿰 8800100)에 503/타임아웃을 내 render·audit 실패 → 작은 몹으로 교체. 커뮤니티 원자재에 "공식 사과문"처럼 보이는 패러디(보상 '고순 5,000개')가 섞일 수 있으니 공지 인용은 maple.land 원문으로만.

**20호(2026-11-09주, 11/15 발행, PR #248):** 크롤러는 개념글 위주라 금요일 신규 콘텐츠(몬카2) 반응이 원자재에 0건이었다 → 디시 제목+내용 검색(`s_type=search_subject_memo`)으로 보충 후 material에 추가·해시 재계산. 큰 패치가 있는 주엔 키워드 검색 보충을 기본으로 할 것. data/weekly_news/는 gitignore라 PR엔 data/maple.db만 들어간다. 사적 분쟁(공대 지각·알버프)은 당사자·공대명 없이 '논쟁 주제'로만 다뤘다.

---

## project_v3_29_features

*분류: memory · v3.29.0 신기능(스킬시뮬/채널가이드/오늘의몬스터)의 데이터 소스와 운영 규칙*

v3.29.0 (2026-07-10) 신기능 운영 메모:

- **스킬 시뮬레이터**: `sim_jobs`/`sim_skills`는 레퍼런스 테이블(SEED_TABLES 등록됨, `project-deploy-seed-sync`). 재적재는 `python3 scripts/import_skill_sim.py` — mapleland.st 청크에서 한글 스킬 데이터+아이콘(web/public/skill-icons/) 추출, 로컬 `83/` WZ(GMS v83)와 교차검증. 노비스/노블레스(0차) 스킬은 소스에 없어 미포함. **주의: 배포에서 시드 동기화가 sim 테이블을 누락한 사례 있음(v3.29.0)** → API가 이미지 내 `data/skill_sim_data.json` 번들로 자가 복구(스크립트 재실행 시 JSON도 함께 재생성·커밋 필요, Dockerfile.railway COPY 목록에 포함됨).
- **community_channels는 유저 데이터 테이블** — SEED_TABLES에 넣으면 관리자 큐레이션이 배포마다 날아감(`feedback-never-touch-user-data`). 빈 테이블일 때만 기본 시드 + `bot_settings.community_channels_seed_version` 키 기반 1회 마이그레이션(v2: 본서버 유튜버→메랜 전문 괴임·난동군·썬더70·밥뒤 교체, URL이 그대로인 시드만 교체해 관리자 수정분 보존). 시드 개편 시 이 버전을 올리고 마이그레이션 추가. LIVE 배지는 stream 채널에 channel_key(치지직 채널ID/SOOP ID)를 관리자 UI로 등록해야 켜짐. 유튜브 채널은 @핸들 URL만 넣으면 RSS 수집 시 UC 채널ID 자동 해석(externalId 정규식).
- **오늘의 몬스터** 정답은 KST 날짜 sha256 시드로 서버에서만 결정(EPOCH 2026-07-10=#1). 풀은 id<9000000+is_hidden=0+kms 한글명 존재(≈352마리). daily_mob_results도 유저 데이터.
- **event_guides(이벤트 정리, /events)도 유저 데이터 테이블** — 관리자가 라이브에서 content_json 편집(⚙ 버튼). 새 이벤트 정리는 admin POST /api/events 또는 코드 DEFAULT_GUIDES(빈 테이블 시드용)에 추가. 디스코드 공홈 알림은 PUBLIC_SITE_URL(기본 memorymapledb.up.railway.app) 기반 /news?post={id} 딥링크 병기.
- **Railway 배포는 헬스체크 통과까지 구/신 컨테이너 응답이 8~10분가량 섞임** — 배포 직후 검증은 연속 N회 200 확인으로.

**Why:** 세 기능 모두 데이터 소스와 시드/유저 테이블 구분이 코드만 봐서는 헷갈리기 쉬움.
**How to apply:** 스킬 데이터 갱신은 import 스크립트 재실행 후 data/maple.db 커밋. 채널 테이블은 절대 시드 교체 금지.

---

## project_ime_enter_guard

*분류: memory · Enter 키 핸들러에는 반드시 !e.nativeEvent.isComposing 가드 필요 (한글 IME 중복 실행 버그)*

한글 IME 조합 중 Enter를 치면 keydown이 두 번 발생(조합 확정 + 실제 엔터)해서, `e.key === "Enter" && fn()` 패턴이 fn을 두 번 실행한다. 목록 추가류에서는 마지막 조합 글자가 중복 등록됨 (예: "슈슈" → "슈슈"+"슈", 2026-07-16 놀이터 룰렛 버그).

**Why:** 이 사이트는 한글 입력이 기본이라 모든 텍스트 입력창에 해당.

**How to apply:** 새 입력창의 Enter 핸들러는 반드시 `e.key === "Enter" && !e.nativeEvent.isComposing && fn()` 형태로 작성. v3.42.1에서 기존 34곳 일괄 적용 완료. (div 접근성 핸들러처럼 텍스트 입력이 아닌 곳은 불필요 — QuestCard.tsx 참고)

---

## project_map_details

*분류: memory · map_details 테이블 — maplestory.io GMS v92 기반 맵 구조도·스폰 위치 데이터 (v3.43.0)*

2026-07-16 맵 정보 리빌딩(v3.43.0)에서 `map_details` 테이블 신설. maplestory.io GMS v92 `/map/{id}` JSON에서 스폰 위치(`mob_id,x,y`)·발판·로프·미니맵(base64)·vrBounds·BGM을 수집. 레퍼런스 1,121/1,123개 맵 보유 (누락 2개는 JMS 전용 일본 맵 802000100/802000101).

**Why:** 맵 상세 페이지의 스폰 구조도·정확한 젠 수·실사 맵의 데이터 소스. `project-deploy-seed-sync` 규칙에 따라 SEED_TABLES에 등록됨.

**How to apply:**
- 재수집: `python3 crawler/fetch_map_details.py` (미수집분만, `--force`로 전체) — 기존 maps 테이블은 안 건드림 (`project-mapledb-parser-broken` 회피)
- 실사 맵 이미지는 저장 안 함 — 프론트에서 `https://maplestory.io/api/gms/92/map/{id}/render` 핫링크 (맵당 1~2MB)
- 렌더 이미지는 vrBounds와 크기가 달라 좌표 오버레이 불가 → 스폰 점은 footholds 기반 SVG 구조도에만 그림
- 미니맵 좌표 변환: `px = (x + centerX) × canvasW / width`
- 젠 수·스폰 위치는 원작(GMS v92) 참고값 — 메이플랜드 실서버와 다를 수 있음 (페이지에 고지 문구 있음)

---

## project_2_0_backlog

*분류: memory · 2.0 대응 백로그 — 퀘스트 재크롤 주기, 월드컵 사진 업로드, 카드 드롭률 낡음, 코디 시뮬 후속*

2026-07-22 대규모 배치 이후 남은 작업. (2026-09-11 대청소: 완료분 정리)

**Why:** 사용자가 요청한 로드맵 중 구현 보류분과 데이터 갱신 트리거를 잊지 않기 위해.

**How to apply:**
- **퀘스트 재크롤**: `.venv/bin/python crawler/fetch_mapledb_quests.py` (미수집분만) — mapledb.kr에 신규 패치 퀘스트(에델슈타인 등)가 등재되면 실행. 로드맵 데이터 소스는 `mapledb_quests`(SEED_TABLES), 기존 quests 수기 데이터는 불변 보존
- **월드컵 3단계 잔여**: 길드원 사진 "업로드형" — 현재는 정적 자산 16명으로 운영 중(guild 모드 완성). 업로드 저장소·삭제 정책(관리자) 설계가 필요해 보류. 2단계(대결 카드 스탯·시세 비교)는 v4.0.0에서 완료
- **놀이터 후보** (리서치 완료, 미구현): 시세 맞추기 Higher/Lower(이제 /market 시세 소스 재사용 가능), 드롭 퀴즈, 루팅 주사위(/roll), 공용 빙고판
- **코디 시뮬 후속**: ① 헤어별 마을 매핑(자료가 이미지뿐 — mapledb NPC 스크립트 or OCR) ② 렌즈 시술 위치 ③ 헤어 한글명 보강 ④ 월드컵 통계 연동 인기 코디 랭킹
- 이상형 월드컵 결과는 `game_results` (game_type='worldcup_*') — 유저 데이터, 시드 금지
- **메랜 브레인 v2**: ① 포탈 그래프(fetch_map_details.py에 portals_json 추가 → 길찾기) ② 경험치 효율 커뮤니티 보정 ③ /leveling 연동 ④ 차원의 거울·배 노선 수동 엣지
- ~~페이지 사용 가이드 2단계~~ **완료** (v4.8.0, PR #224): 총 22페이지, 정본은 web/data/pageGuides.json(프론트 PageGuide + 챗봇 "어떻게 써?" 인텐트 공유). /brain은 자체 온보딩이라 제외 유지
- ~~체경비 v2 스킬 레벨~~ **완료** (v4.8.0): sim_skills→web/data/skillLevels.json 35스킬(export_skill_levels.py, 마법은 mad=기본 공격력, DB 부재 9스킬 보간 폴백) + 다수기 동시 타격(맵 효율만)
- **nhit 스킬 수치 후속**: v4.8.0에서 체경비는 KMST DB 수치 채택(차지 블로우 250%·블래스트 580% 등 15건 정정)했으나 /nhit 간이표(jobSkillData 하드코딩)는 미수정 — 페이지 간 수치 불일치 존재. nhit도 skillLevels.json 기반으로 전환 필요
- **몬스터 카드 드롭률 낡음** (7/31 메랜 재조정, 새 수치 비공개): DB 원작 수치 331건 불일치 — 상세 페이지 안내 문구로 대응 중. 시간의 신전 원석류 드롭률 상향도 동일
- **해적 마북 등 레퍼런스 누락 잔여** (9/2 점검): 몬스터 카드 317종·기타 드랍 49종 미등록(카드는 메랜에 존재 — 추가 여부 결정 필요). 아란 계열 마북은 메랜에 없을 수 있어 선별 요망. 수정 패턴: scripts/patch_20260724_reference.py
- **NLC/마스테리아: 메랜 미구현 확정** (9/11, 8/18 공지 근거 — NLC 귀환 주문서는 아모리아 이동용일 뿐): 레퍼런스 제외 유지가 올바른 상태. 재수집 과제 아님
- ~~월드컵 2단계 (코디템 스탯·시세 비교)~~ **완료** (v4.0.0)
- ~~무릉도장 훈장 갱신~~ **완료**: 소공의 후계자 9/11 획득 종료 표기 (v4.0.0)
- ~~카쿰 파츠별 패턴 섹션~~ **완료**: post 5 라이브 PATCH (2026-09-11)
- ~~/market 시세 개방~~ **완료** (v4.0.0): matip 프록시 기반, 일/주/월봉 차트

---

## project_git_history_divergence

*분류: memory · 로컬 main과 origin/main 히스토리가 다름(스쿼시 머지) — 브랜치는 origin/main 기준으로, rebase 대신 cherry-pick*

로컬 main의 커밋(예: 5f294a8 등)은 origin/main 히스토리에 없다 — PR이 스쿼시/머지 커밋으로 반영돼 로컬 개발 커밋과 원격 히스토리가 갈라져 있다 (2026-08-20 확인). **2026-09-15 해소 확인**: 로컬 main이 origin/main에 0 ahead(순수 behind)여서 ff로 일치시킴 — 이후 divergence 재발 없으면 로컬 main은 `git merge --ff-only origin/main`으로 유지하면 된다. 아래 브랜치 규칙(origin/main 기준 시작)은 계속 유효.

**Why:** 로컬 main 기반 브랜치를 `git rebase origin/main` 하면 옛 로컬 커밋 수십 개를 재적용하려다 changelog/version.ts에서 연쇄 충돌이 난다.

**How to apply:** 새 작업 브랜치는 `git fetch origin && git checkout -b <branch> origin/main`으로 시작. 이미 로컬 main에서 딴 브랜치를 최신화할 땐 rebase 금지 — origin/main에서 새 브랜치를 만들고 내 커밋만 cherry-pick. 버전 확정 전 origin/main의 web/lib/version.ts 최신값을 반드시 확인(`feedback-version` 릴리즈 절차와 연계).

---

## project_pinkbean_check

*분류: memory · 핑크빈(시간의 신전 원정대 보스) 정기 실측 체크 — 9/18 오픈, 클리어 가능성(맥뎀)·드롭·원정대 스펙 추적*

핑크빈은 2026-09-18(금) 점검에서 메이플랜드 정식 등장(완료). 시간의 신전 최심부 원정대 보스. 사용자가 `project-edelstein-provenance`의 에델 정기체크처럼 **핑크빈도 정기 실측 추적**을 지시(2026-09-18).

**9/18 패치노트 확정치(메랜 본섭, 원본과 다름)**: 입장 140레벨 이상 · 카오스의 구슬로 '잊혀진 황혼'(맵 270050000) 입장 · 잊혀진 신전관리인 NPC · **원정대 3인 이상**(원본 최대 30인과 큰 차이, 문턱 대폭 완화) · **첫 입장부터 7일간 최대 2회**(7일 후 초기화). 밸런스 완화: 상단 발판 길이↑·위치 조정, 중하단 발판 위치 조정, 마법 구체 가로 판정 10%↓. 신규 지역 '시간의 신전 폐허 너머'. 신규 몹=미니빈/솔로몬/렉스/휘긴/무닌/아리엘/핑크빈(전부 이미 DB 8820xxx). 직업: 어드밴스드 오라(블루/옐로/다크) 필요레벨 툴팁 일치+SP반환(게임 내부 수정, 우리 데이터 반영 불필요), 시그너스 '거리 청소하기'·레지스탕스 '잃어버린 추억' 퀘 버그 수정. → /pinkbean 페이지 PR #214에 전부 반영 완료(85b7cd7).

**아직 미확정(실측 추적 대상)**: 실제 클리어 여부·클리어 보상·드롭 구성(리버스 생드랍+시간의돌로 타임리스 제작 유력), 본체 반사/투명파워업의 메랜 유지 여부, 전투맵 스폰 실제 위치.

**9/18 첫 트라이 실측(v4.3.1, PR #216 반영)**: 레고77 30인 공대(최상위 스펙) 아리엘(5페)에서 실패, 본체 미도달. 1석상 실측 3분30초 vs 필요컷 90초~2분20초 → 딜 ~2배 부족 평가. 발판 밸패 해석 = 발판 위는 공반·단체유혹 범위 밖 + 석상 타격 가능(근딜 동선 핵심, 첫 공대 미활용). 조합 여론: 나로 주딜 + 팔라딘 1~2(휘긴 얼음/무닌 불 약점) + 전사 소수(본체 우측 몰이), 히어로 비추(본체 물리 반감, 나로의 66%), 오크통 본체 무효. 이후 트라이(발판 동선 적용 공대)·첫 클리어·드롭 인증이 다음 갱신 트리거.

**Why:** 오픈 시점의 핵심 미확정치(맥뎀 적용 여부=클리어 가능성, 실제 드롭률, 원정대 인원/제한시간/레벨, 본체 페이즈 수·반사 주기)를 실측이 쌓이는 대로 확정 수치로 갱신해야 함. 커뮤니티(디시 메랜갤)가 실시간으로 이 논점을 다룸.

**How to apply:**
- 대상 페이지: `/pinkbean`(web/app/pinkbean/, v4.2.0 신설, PR #214). ⚠️ 표기된 항목들이 검증 대상 = 본체 페이즈/반사 주기/드롭률/원정대 스펙/과거의 길 요구 마릿수.
- 체크 소스: ① maple.land 공지(9/18 패치노트) ② 디시 메랜갤 실측(`scratchpad/dc_kw.py <cutoff> 핑크빈 시조 원정대`) ③ 클리어 인증글/영상.
- 데이터 근거 현황: mobs 8820000~8820027(KMS v62 계열, 본체 8820014에 드롭 87건), 레퍼런스 화이트리스트에 8820002~7·14·19 등록됨(사이트 노출 가능). 시간의 신전 맵 270000000~, map_details 41건.
- 판본: `project-edelstein-provenance`와 동일하게 **빅뱅 전 KMST 기준**. 빅뱅 후 카오스 핑크빈 자료와 섞지 말 것. 페이지에 판본 주의 명시됨.
- 핵심 변수 = 맥뎀(데미지 상한). 빅뱅 전 원본은 맥뎀+20초 반사로 한국서버 ~2년 미격파. 메랜이 맥뎀 원본 유지면 사실상 클리어 불가, 상향/직업버프면 가능 — 오픈 후 실측으로 확정.
- 유튜브 자막 파싱(성공 방법, 2026-09-18 확립): 익명 접근은 IP 봇 차단(LOGIN_REQUIRED)으로 전부 실패(curl·yt-dlp 익명·youtube-transcript-api·Invidious). **우회 = 로컬 Chrome 로그인 쿠키**: `scratchpad/venv/bin/yt-dlp --cookies-from-browser chrome --ignore-no-formats-error --skip-download --write-auto-subs --sub-langs ko-orig --sub-format vtt -o out <URL>`. 포인트 3개 — ① `--cookies-from-browser chrome`(사파리는 macOS 권한거부, brave/edge 미설치), ② `--ignore-no-formats-error`(영상 포맷 차단이 자막까지 막는 것 우회, 이거 없으면 "Requested format is not available"), ③ 자동자막 원본 언어코드는 `ko-orig`(Korean Original), 번역본은 `xx-ko`. VTT는 `<타임태그>` 제거+중복행 제거로 클린업. 메타데이터만 필요하면 oEmbed(`youtube.com/oembed?url=...&format=json`).
- 메이플홀릭 영상(BHNzK7xrLDk) 실측 반영 완료(PR #214, b6f1de5): 입장 140렙·15채널·카오스구슬·30인, 16마리 처치순서, 본체 투명 파워업(석상 공버프 시간경과 강화, 디스펠로 잠깐 해제), 반사 20초+40초, 클리어 원인=맥뎀 아닌 캐시물량 강제(일본 첫격파 원정대 비숍 없음), 오크통 본체엔 무의미, 드롭=리버스 생드랍+시간의돌로 타임리스 제작.
- 반영 시 릴리즈 규칙(`feedback-version`): 브랜치+PR, origin/main 기준 버전 확정.

---

## project_drop_rate_provenance

*분류: memory · 드랍률 출처 체계 — community(실측) > mapledb(메랜DB) > maplekibun(옛메 블로그 참고값), 동기화는 sync_drop_rates_from_mapledb.py*

사이트 드랍률(mob_drops.drop_rate)은 원래 전부 옛메 블로그(maplekibun.tistory.com/892, 2020) 파싱값이었고 메랜디비 등 외부 사이트와 상이했다(예: 달팽이 껍질 80% vs 40%). 넥슨은 빅뱅 전 드롭률을 공개한 적이 없어 **시중의 모든 드롭률 표는 비공식**(에뮬 덤프/실측/상호 복제)이다. 2026-09-23(v4.4.0, PR #218)에 mapledb.kr 기준으로 전면 동기화하고 행 단위 출처 컬럼을 도입했다.

**Why:** 사용자 지시 — "실측 검증 결과·외부 사이트들을 통해 제대로 반영". 출처가 섞이면 신뢰도 판단이 불가능해 에델슈타인 판본 원칙(`project-edelstein-provenance`)을 드랍률에도 적용.

**How to apply:**
- `mob_drops.drop_rate_source`: **community(실측 확률) > mapledb(메랜DB) > maplekibun(옛메 참고)**. drop_rate_source='community' 행(실측 확률)은 어떤 동기화도 덮어쓰지 말 것.
- **목록 검증과 확률 실측 분리 (2026-09-30)**: `mob_drops.list_source='community'` = 드랍 *목록*이 몬스터북·툴팁 스크린샷으로 검증됨(확률 실측 아님). 과거 이걸 drop_rate_source='community'로 표기해 에델 36행의 확률 백필이 영구 차단됐던 것을 해소 — 목록 검증 행도 rate가 비면 mapledb 확률을 받는다. 몹/아이템 상세 API는 COALESCE(drop_rate_source, list_source)로 배지 유지.
- 재동기화: `python3 scripts/sync_drop_rates_from_mapledb.py --apply` (dry-run 기본, 레퍼런스 몹 939종 크롤 ~15분, robots 허용 확인됨). 읽기 전용 신규 파서라 `project-mapledb-parser-broken`의 몹 이름·레벨 훼손 문제와 무관.
- 신규 실측 반영 시(에델 패치 방식) drop_rate_source='community'를 반드시 설정해야 이후 동기화에서 보존됨.
- 프론트 표기: `web/components/DropRateBadge.tsx` — 실측/메랜DB/참고 배지. API는 mobs·items 상세에서 drop_rate_source 반환.
- 메랜DB 미등록 몹(sitemap 749종 전수 확인, 2026-09-23): **혼테일 파츠(8810xxx)·핑크빈 계열(8820xxx)·카오스 자쿰(8800100)·시간의 신전 몹(8200xxx)·에델 몹·변형몹 190종** — blog 참고값 유지 중, 등록되면 재동기화.
- **보스 파츠 주의**: 메랜DB는 자쿰 드랍을 8800000(Zakum1)에 싣지만 사이트 대표는 8800002(Zakum3) — 동기화 후 `scripts/patch_20260923_zakum_canon_rates.py`식 병합 필요(v4.4.1에서 처리). 피아누스(8510000/8520000)는 좌우 개체 드랍이 실제 상이(샤프 아이즈 확률 등)라 분리 유지가 정답. 파풀은 8500002 일치.
- 시간의 조각 드랍률: 2026-09-21~ 커뮤니티 너프 논쟁 있었으나 표본 실측 부재로 미반영 — 통계 표본 글이 나오면 community 반영 검토.
- 커버리지 공백(2026-09-23 감사): 드랍 0건 노출몹 138종(에델 미확인 17종 포함), 참고값뿐인 몹 116종(보스·파퀘·신전 집중), 확률 미상 976건. 상세는 당시 감사 산출물 참고.

---

## project_recruit_card

*분류: memory · 구인구직 카드 메이커(/recruit-card) 운영 — 아트 추가 절차(파일만 얹으면 자동 노출), AI 변환은 디스코드 로그인 월 2회, Gemini 이미지 무료 티어 쿼터 이슈*

구인구직 카드 메이커(v4.5.0, PR #220, 2026-09-26 배포). 카드 합성은 전부 브라우저 캔버스(업로드 이미지 서버 미전송) — **서버 비용이 드는 지점은 "AI 치비 변환" 버튼의 Gemini 호출 하나뿐**.

**Why:** 길드원들이 수작업으로 만들던 구직/모집 홍보 이미지를 사이트에서 생성. 아트 자산(배경 9종·직업 일러 13종)은 사용자가 직접 생성해 전달한 것을 정적 파일로 탑재 — 런타임 비용 0.

**How to apply:**
- **아트 추가 절차**: `web/public/recruit-card/`에 파일만 커밋하면 페이지 선택지에 자동 노출(코드 수정 불필요). 배경=`tpl-<key>.jpg`(1080², 새 key는 page.tsx TEMPLATES에 추가), 직업 일러=`char-ai-<key>.png`(투명, ~720px·256색 양자화로 압축), 게임 스프라이트 재생성=`scripts/generate_char_presets.py`(자쿰 투구+리버스 무기, 활/석궁/건/스태프/클로/너클은 alert 포즈 필수).
- **AI 변환 한도**: 디스코드 로그인 필수(`ml_session` 쿠키, api/routes/auth.py current_user_id) + 유저당 월 2회 + 전역 월 60회 + 쿨다운 30초. 테이블 recruit_card_rate_limit(유저 데이터, SEED 제외, subject="user:<discord_id>", 월 "YYYY-MM" 키).
- **Gemini 이미지 모델 이슈(2026-09-26 실측)**: 기본 `gemini-2.5-flash-image`가 무료 티어에서 **429 quota exceeded**(쿼터 0 또는 미제공 추정) — 텍스트 모델(fortune/nhit)과 별도 쿼터. 해결: Railway env `GEMINI_IMAGE_MODEL`로 모델 교체(코드 수정 불필요, 후보: gemini-2.0-flash-preview-image-generation) 또는 결제 연결(이미지당 약 $0.04). 검증은 admin API `POST /api/recruit-card/template-art`(X-Admin-Password, 유저 쿼터와 분리)로 1회 호출.
- 빅뱅 전 직업명 주의: 활 4차=보우마스터, 석궁 4차=신궁 (한 번 반대로 잘못 붙였던 이력).

---

## project_malaysia_20261008

*분류: memory · 10/8 말레이시아·혼줌 패치 반영(PR #228) — 머지 후 --live 보스 플래그 필요, 히비스커스 길목 3 보류*

2026-10-08 메랜 패치(말레이시아·혼돈의 주문서) 반영 — PR #228(v4.10.0, 머지·배포·--live 보스 플래그까지 완료), 후속 PR #229(v4.10.1 — 공식 배지 노출 버그·푸터 버전).

v4.10.0·v4.10.1 모두 머지·태그·릴리즈·배포 검증 완료 (2026-10-08).

**미완/후속:**
- ⚠️ 교훈: 버전 올릴 때 web/lib/version.ts(APP_VERSION)도 함께 — 4.10.0 때 누락했음
- 혼줌 빈 확률 11행은 기분안기모띠 블로그에도 수치 없음(옛메에 없던 메랜 신규 드랍) — 커뮤니티 실측만이 채울 소스
- '히비스커스 길목 3'은 GMS/SEA 원본에 없는 메랜 커스텀 맵 — ID 실측 확보 시 맵 등록
- 말레이시아 몹 일반 드랍 테이블 미수집 (혼줌만 공식 연결) — `mapledb-파서-깨짐` 때문에 재크롤 금지, 실측/커뮤니티 수집 대기
- 타르가&스칼리온 메랜 실측(패턴·스펙컷·드랍) 수집 대기 — 원작은 3페이즈(6천만→9천만→1.5억), 투구(스칼/타르가 모자) 드랍으로 유명
- 혼줌 드랍률 전부 미공개 — 실측 모이면 community 출처로 갱신 (`드랍률-출처-체계`)

**유용한 사실:** maplestory.io GMS/92(빅뱅 전)에 MSEA 수입 콘텐츠(말레이시아 9420527~9420549, 맵 55xxxxxxx)가 통째로 들어 있고 몹 레벨이 메랜 공지와 전부 일치 — 신규 MSEA 지역 나오면 같은 경로로 수집하면 됨. 보스 드랍은 자쿰=8800002, 카쿰=8800100에 붙는 관례.

---

## project_chaos_scroll_rules

*분류: memory · 메이플랜드 혼돈의 주문서(혼줌) 사용 규칙 — 악세서리 한정, 귀고리는 불가, 세부 확률 미공개*

메이플랜드 혼돈의 주문서(혼줌, 2049100) 규칙 (2026-10 기준):
- 10/8 패치로 등장, 인게임 드랍 전용 (공지 확정 33종 — 확률 미공개)
- **악세서리에만 사용 가능** (원작 GMS는 전 장비) — 단 **귀고리에는 사용 불가** (유저 실측 확인, 2026-10-12)
- 검은색 허리띠(무릉도장 12,000점, 올스탯5·줄 7개)가 기대값 최고 대상으로 통용
- 성공률 60%·변동 ±5는 원작 통용값이지만 변동폭 가중치는 공식 미공개 → /chaos 시뮬은 조정 가능한 균등 가정 (실측 쌓이면 기본값 교체)
- 금이 간 안경(1022081, 차원의 균열 20회 보상)·얼음결정 페이스페인트 등 메랜 커스텀 옵션 아이템은 DB에 스탯 미등록 — 실측값 확보 시 items에 등록하면 /chaos 선택기에 자동 노출

**Why:** 혼줌 관련 기능(시뮬·드랍 가이드·시세)에서 반복적으로 필요한 인게임 룰인데 공지에 없음 (유저 전달 + 실측 기반).
**How to apply:** /chaos 선택기는 category=Accessory에서 Earrings 제외·업횟>0·옵션 매핑 가능만 노출. 새 악세서리 혼줌 가능 여부가 애매하면 유저에게 실측 확인. `edelstein-provenance`처럼 공지·실측 우선 원칙.

---

## project_maple_items_3rd_anniv

*분류: memory · 메이플 무기류 메랜 노출 현황과 메이플 건 3종 \"데이터만 준비·미노출\" 결정 (v4.18.4, 2026-10-16)*

3주년(2026-10) 대비로 메이플 장비를 점검했다. 35·43·64제 메이플 무기, 메이플 실드·망토·이어링·모자는 화이트리스트에 있어 이미 노출된다.

**메이플 건 3종(1492020~22)은 메랜 미출시로 판단**했다. mapledb.kr 2024 스냅샷과 로그지지 main/custom에 없고, matip·로그지지 ext(KMS 대량 수집)에만 있다. v4.18.4(PR #234)에서 items 수치만 채우고 노출하지 않았다.
- **사용자 결정:** "데이터만 준비". 출시가 확인되면 `data/equipment_notes.json`에 publish 항목만 추가하면 된다.

**Why:** matip는 KMS 전체(빅뱅 이후 포함 9천 건)라 메랜 존재 근거가 아니다. 메랜 근거는 mapledb 스냅샷과 로그지지 main/custom(note에 "자동 수집분"이 아닌 행)이다.

**How to apply:** 메랜에 없는 아이템 후보들도 같은 방식으로 다룬다. 공지로 출시가 확인될 때만 공개한다.
- 30/38/59제 메이플 무기 재출시판(1302124 계열)
- 77제 메이플 파이롭 무기
- 5주년 장신구: 스카프, 마음 목걸이 (가네샤는 2주년 보상 확인으로 v4.20.2에서 공개)
- 견장(호랑이 발톱)
- 화이트리스트에 없는 허리띠

**분석 함정:** 로컬 작업 브랜치의 data/maple.db·reference가 origin/main보다 낡았을 수 있다. 현황 집계는 origin/main 기준(worktree)으로 해야 한다. 관련: `project-mapleland-id-space`, `project_edelstein_provenance`

**주년 이벤트 패턴 (공식 공지, 2026-10-23 정리):**
- 1주년: 2024-10-25(금) ~ 11/13 23:59
- 2주년: 2025-10-31(금) ~ 11/28 0시
- 두 번 모두 단풍잎으로 메이플 무기(35·43·64제)·모자·이어링을 교환했고, 황금 단풍잎은 가가 상점에서 썼다.
- 신캐 지원 퀘스트는 이벤트 2~4주 전 날짜 이후에 생성한 캐릭터만 대상이었다.
- 전년도 단풍잎은 다음 해 이벤트에 쓸 수 없었다.
- 메이플 건은 두 번 모두 보상 목록에 없었다. 미노출 결정과 일치한다.
- 라이브 정리본: `/events/mapleland-3rd-anniversary-preview-2026`(공식 공지가 나오면 실제 이벤트 정리로 교체 또는 종료 처리), 1·2주년 아카이브.

**후기 메이플 장비 준비 (v4.20.3, PR #238, 2026-10-23):** 사용자 요청으로 77제 파이롭 무기 17·파이롭 펜던트 2·메이플 펜던트 1·79제 이올렛 24, 총 44종의 items 행을 미리 만들었다. 사이트에는 노출하지 않는다.
- 공개 명령: `python3 scripts/patch_20261023_anniversary_items_prep.py publish <pyrope|pendant|iolet> --acquisition '<공지 획득처>' --source-url <공지 URL> --apply` → equipment_notes publish 항목 추가 → 버전 PR
- 메이플 건 3종(1492020~22)은 이 스크립트 대상이 아니다. 공개하려면 equipment_notes에 직접 추가한다.
- 78제 메이플 무기는 어느 출처에도 없다.


**3주년 실제 반영 (2026-10-27, PR #239 v4.20.4):** 3주년은 10/27(화) 시작 ~ 12/1 0시. 메이플 운영자 교환으로 77제 파이롭 무기·파이롭 매직/파워 펜던트 출시 확인 → publish (파이롭 블레이드 1342028은 듀블 무기라 제외). 77제 메이플 펜던트(1122074)·이올렛·메이플 건은 여전히 미노출. 공지에 "기존 메이플 무기 스탯 제한 일부 완화"(예: 35제 메이플 스태프 LUK 33→23)가 있으나 전체 수치 미확보라 items 미수정. 교환 개수는 공지에 없고 디시 유저 정리글(#4055326·#4055592)에서만 확인됨.

**10/28 요구 스탯:** 메랜 메이플 무기는 옛 ID(1382009 등 33종, mapleland_reference)이고 출처 3곳 모두 REQ 0으로 수집돼 있음(실제와 다름). 확정치는 35제 스태프 LUK 23만 override, 나머지는 equipment_notes에 "완화된 요구 스탯 미확인" 메모. 파이롭 무기는 공지 툴팁상 요구 스탯 0. 실측 나오면 override에 reqXXX로 추가.

**11/8 반영 (PR #247, v4.23.0):**
- 메이플 건 3종(1492020~22)을 공개했다. 근거는 11/6 패치노트의 주년 이펙트 수정 대상에 메이플 건, 스톰 피스톨, 캐논 슈터가 들어 있었던 것이다.
- 주문서 시뮬레이터(`web/lib/scrollData.ts`)에 `MAPLE_EQUIPS`(전용 주문서)와 65% 주문서를 넣었다.
- 전용 주문서 수치의 출처:
  - 이어링 +1: 메랜유틸 2046300~2046303
  - 무기 70% 공격력/마력 +2·주스탯 +1, 모자 올스탯·명중·회피 +1, 가네샤 공격력·명중·회피 +1: mapleland-setting-v2 `src/data/scrolls.json`(유저 데이터)
  - 공식 수치는 없다.
- 미해결: 메이플 모자는 기본~4단계(5종)인데 DB에는 Lv.0/8/30/70 4종뿐이다. 이어링은 2단계가 끝이다.

---

## project_event_guides

*분류: memory · 이벤트 정리(event_guides)는 라이브 admin API로 관리, 종료는 ISO로 저장(날짜만=그날 포함), 기한은 content.deadlines (v4.19.0)*

`event_guides`는 라이브에서 관리하는 큐레이션 테이블이다. 시드 동기화 대상이 아니고, 저장소 DB에는 1행뿐이다. 추가·수정은 `POST/PUT /api/events[/slug]` + `X-Admin-Password`(로컬 `.env`의 GAME_ADMIN_PASSWORD)로 한다. 수정 전에 GET으로 백업한다.

**규칙 (v4.19.0, 2026-10-16):**
- 공식 공지의 "N일 0시까지"는 `period_end`에 `YYYY-MM-DDT00:00:00+09:00`로 저장한다.
- 날짜만 쓰면 백엔드 `effective_event`와 프론트 `eventDeadline`이 그날을 포함해 다음날 0시로 해석해서 하루 늦어진다. 배틀메이지 이벤트에서 실제로 하루 늦게 표시된 적이 있다.
- 보상 상자·훈장·쿠폰 기한은 `content.deadlines: [{label, at?, note?}]`에 적는다. 획득 후 N일 같은 상대 기한은 `note`에 적는다.
- `links` 항목은 `url` 키로 저장한다. 프론트는 `href`도 받지만 표준은 `url`이다.
- 카톡봇·홈 위젯은 status 컬럼 대신 `effective_event`로 진행 여부를 판정한다.

**How to apply:** 패치나 이벤트가 나오면 공식 이벤트 게시판(maple.land/board/events)에서 기간·보상·기한을 확인한 뒤 위 형식으로 등록한다. 관련: `project_admin_auth`, `feedback-version`

**3주년(2026-10-27) 등록:** `mapleland-3rd-anniversary-2026`·`monster-park-returns-2026`·`maple-first-step-2026` 라이브 등록, 미리보기는 status=ended. 빌더 스크립트 패턴: 공지 본문은 maple_land_posts, 교환표는 공지 이미지(cdn.content.maple.land)와 디시 정리글 NPC 스크린샷(data-original 속성에 실제 이미지)로 교차 확인. 10/28 2차 보강: 몬파 클리어 경험치 = 버닝값 ÷ 1.5(버닝 월드는 Lv.120 미만 몬스터 경험치 1.5배, 공지 zrt6bke4vgf5ufb2lbqi8lyr; 자경구 2,898,000 실측 일치), 주문서 조각 = 무기 60% + 조각 1 + 30만 메소 → 65%, 가가 재입고 매주 화요일(난동군 영상 1Yih9Kv87vI). 영상 자막은 scratch venv의 yt-dlp --write-auto-subs로 받음. 주말 이벤트는 공식 21시(영상의 20시는 오기).

---

## project_ox_quiz

*분류: memory · 3주년 토요일 21시 OX퀴즈 족보(/ox, 봇 !ox) — 원작 OXQuiz.img 1~9세트 기반, 메랜은 다르게 출제하므로 실제 출제분은 basis=observed로 누적*

`data/ox_quiz.json` (v4.22.0, 517문항) = 원작 클라이언트 `Etc.wz/OXQuiz.img` 1~9세트 + 메랜 실제 출제(basis=observed, seen 날짜). 사이트 `/ox`, 카톡·디스코드 봇 `!ox`가 공용 `api/routes/ox_quiz.py` 사용.

- 메랜 문제 출처 = 원작 OXQuiz.img. 로컬 덤프 `wz_data_v62/Etc_OXQuiz.json`은 8·9세트만 한국어, 1~7세트는 중국어/영문 → 역번역해 basis=translated, `set: "1-7"` 형식으로 원작 번호 기록. KMS 한국어 원문은 공개된 게 없음(메랜유틸 570문제는 비공개 메일 제보, 디시 #4065960).
- 원작 데이터 1세트는 정답 값이 해설과 반대인 경우가 많음. 그류핀(1-8)은 데이터 X·해설 '얼음 속성'·메랜 실제 O → 모순 문항은 해설 기준 정답 + alt로 원작 값 표시.

**Why:** 2026-10-31 1회차에서 메랜은 원작 9세트 밖(1~7세트) 문제와 원작과 정답이 다른 문제를 냈다.

**How to apply:** 매주 토요일 이벤트 후 디시에서 정답이 확인된 문항만 observed로 추가하고, 같은 원작 문항이 있으면 별도 항목 대신 observed 항목에 set·note로 병합. 디시는 연속 요청 시 빈 응답으로 막으니 천천히 요청. 새 data/*.json은 Dockerfile.railway COPY 필수 — `project-deploy-seed-sync`.

**2026-11-06 패치 이후:** 공식 패치노트에 "OX퀴즈가 원작 기준에서 Mapleland 환경에 맞는 문제들로 일괄 변경"이 들어갔다. 11/7 2회차는 메랜 전용 문제로 출제됐다(예: 엘리니아 하얀 포션 310메소 구매 가능 여부). 그래서 원작 517문항은 참고용이 됐고, observed 문항 수집이 핵심 작업이 됐다. 19호 지면에도 "본지 족보는 참고용"이라고 안내했다.

---

## project_neo_tokyo

*분류: memory · 네오도쿄(KMS 미출시) 데이터 출처 — 로컬 wz_data_v62(대만판) Mob_info가 디시 '테섭 기준' 수치와 일치, CMS/148은 빅뱅 후 수치*

2026-11-06 메랜 패치에서 네오도쿄 맵이 일부 노출됐다. 네오도쿄는 KMS에 나온 적 없는 해외판(JMS/TMS/GMS/CMS) 콘텐츠라서, 한글 명칭은 메랜이 자체 번역하게 된다.

- 맵 ID는 802000xxx, 몬스터는 9400253~9400289(일반), 보스는 9400263~273·289다.
- `wz_data_v62/Mob_info.json`(대만판 덤프)의 수치가 디시 #4075541의 '테섭 기준' 수치(Lv135 HP 26만 EXP 10200 등)와 일치한다. 메랜 기준값에 가장 가까운 자료다.
- maplestory.io `CMS/148`은 맵 배치·NPC 확인에만 쓴다(User-Agent 헤더 필요). 몬스터 수치는 빅뱅 후 값이고, 나무위키 '개편 전' 표도 이 값이다.
- 덤프에 네오도쿄 퀘스트는 없고, 드롭 테이블은 원래 클라이언트에 없다.

**How to apply:** 사이트에 반영할 때 수치는 v62 덤프를 '참고값'으로 쓰고, 출시 후 실측으로 덮어쓴다. 관련 규칙은 `project-edelstein-provenance`, 노출 범위는 `project-mapleland-id-space`를 따른다.

---

## project_monster_carnival2

*분류: project · 몬스터 카니발 2(11/13 출시) 반영 상태 — 슈혼목 업횟 1(원작 3), 소환몹 미등록 이유, 출처 이미지*

2026-11-13 메랜 패치로 몬스터 카니발 2(Lv.51~70, 필드1·2 2~4명·필드3 3~6명, 필드별 일 6회)가 출시됐다. 2026-11-15 PR #249(v4.24.0)로 /pq 가이드, 맵 17개(980030000~980033400), 반짝이는 메이플 코인(4001254), 슈피겔만의 혼돈 목걸이(1122058)를 반영했다.

- 슈혼목은 메랜 툴팁(공지 이미지) 기준 **업그레이드 1회**다. 원작 v83은 3회라 `items.upgrade_slots`와 `mapleland_overrides.json`을 둘 다 고쳤다. 교환가는 반짝이는 메이플 코인 150개다.
- 카니발2 소환 몬스터 9300315~9300324는 등록을 보류했다. 공지는 "정상 경험치로 수정"이라고만 했고, 원작 EXP(1~10)가 노출되면 오해를 부른다.
- 미확인 항목: 판당 코인 수, 랭크별 보상 경험치, 무기 교환가, 혼돈 목걸이에 혼줌을 쓸 수 있는지에 대한 공식 근거.

**How to apply:** 실측이나 공지가 나오면 /pq의 carnival2 항목과 equipment_notes 1122058을 갱신한다. 소환 몬스터는 메랜 경험치가 확인된 뒤 overrides에 exp를 넣고 등록한다. 패치 반영 방식은 `project-mapleland-id-space`를 따른다.

---

## feedback_check_pr_merged

*분류: memory · 열린 PR에 후속 커밋을 push하기 전 gh pr view로 머지 여부 확인 — 이미 머지됐으면 새 브랜치·새 패치 버전*

같은 세션 후속 지시를 "아직 안 머지된 PR"에 넣기 전에 반드시 `gh pr view <n> --json state`로 상태를 확인한다.

**Why:** 2026-11-15 PR #249가 이미 머지된 뒤 같은 브랜치에 보스 전환 커밋을 push해 main에서 누락됨 → #250(v4.24.1)으로 재발행. 사용자가 "이미 머지되있는데?"라고 지적.

**How to apply:** 머지됐으면 origin/main 기준 새 브랜치 + cherry-pick + 패치 버전 올림. 관련: `feedback_version`
