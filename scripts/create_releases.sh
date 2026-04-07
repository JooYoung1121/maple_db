#!/bin/bash
# GitHub 릴리즈 노트 일괄 생성 스크립트
# 실행 전: gh auth login

GH=/opt/homebrew/bin/gh

$GH release create v1.5.0 \
  --title "v1.5.0 — 핀볼(Plinko) + 게임 기록 저장" \
  --notes "## 🎯 핀볼 (Plinko)
- Canvas 기반 물리 시뮬레이션, 공이 핀을 튕기며 낙하
- 참가자 최대 10명 슬롯 등분, 공이 당첨 슬롯으로 자연스럽게 수렴
- 8행 삼각 핀 배열, 중력·반사·마찰 물리 파라미터 적용

## 📋 게임 기록 저장
- 룰렛·주사위·핀볼 결과를 서버에 자동 저장
- 놀이터 하단 '최근 기록' 섹션 (접기/펼치기)
- 비밀번호 보호 삭제 (환경변수 \`GAME_ADMIN_PASSWORD\`)"

$GH release create v1.6.0 \
  --title "v1.6.0 — 사다리 타기 추가" \
  --notes "## 🪜 사다리 타기
- Canvas 기반 사다리 그래픽, 참가자 최대 8명
- 당첨자 뽑기 모드 (당첨/꽝) / 순서 정하기 모드 (1등~N등)
- 사다리 미리보기 후 시작 → 2.4초 애니메이션으로 경로 표시
- '새 사다리' 버튼으로 사다리 재생성
- 전체 결과 테이블 + 게임 기록 자동 저장"

$GH release create v1.7.0 \
  --title "v1.7.0 — 공뽑기 높이 3배 + 공경주 추가" \
  --notes "## 변경 — 공뽑기 (구 핀볼)
- 캔버스 높이 3배 (520 → 1560px), 페그 24행으로 확장
- 낙하 중 공을 따라 자동 스크롤

## 신규 — 공경주 (멀티볼 레이스)
- 참가자별 공이 동시에 낙하, 먼저 FINISH 라인에 닿는 순서로 순위 결정
- 공끼리 충돌 물리 적용, 실시간 순위 현황 표시 (🥇🥈🥉)"

$GH release create v1.8.0 \
  --title "v1.8.0 — 핀볼 box2d-wasm 물리 엔진으로 교체" \
  --notes "## 🎯 핀볼 — box2d-wasm 자체 호스팅
- lazygyu/roulette (MIT) iframe 임베드
- 업계 최고 수준 2D 강체 물리 엔진 적용
- 멀티볼, 스킬(밀쳐내기), 다양한 맵 등 풍부한 기능
- 게임 내 직접 참가자 입력 (이름/가중치, 이름*중복 문법)

## 법적 검토
- lazygyu/roulette: MIT 라이선스, 상업적 사용 허용
- 출처 표기: 페이지 내 lazygyu/roulette (MIT) 링크 표시"

$GH release create v1.9.0 \
  --title "v1.9.0 — 핀볼 이름 복구 + 공경주 제거" \
  --notes "## 변경
- 공뽑기 → 핀볼으로 이름 복구 (🎯 핀볼)
- 공경주 탭 제거
- MIT 라이선스 출처 표기 추가"

$GH release create v1.9.1 \
  --title "v1.9.1 — 핀볼 전체화면 + 결과 수동 저장" \
  --notes "## 핀볼
- 전체화면 버튼 추가 (⛶) — iframe 전체화면 토글
- 결과 저장 폼 추가 — 우승자 이름 직접 입력 후 기록 저장"

$GH release create v1.9.2 \
  --title "v1.9.2 — 게임 기록 수동 저장 + 서울 타임존" \
  --notes "## 게임 기록
- 룰렛·주사위·사다리: 게임 종료 후 '📋 기록 저장' 버튼 노출, 누를 때만 저장
- 서버 타임존 UTC → KST(서울, UTC+9) 적용

## 기타
- 핀볼 빈 참가자 허용 (수동 입력 시)"

$GH release create v1.9.3 \
  --title "v1.9.3 — 핀볼 순위 다중 입력" \
  --notes "## 핀볼
- 결과 저장: 우승자 1명 → 1등~N등 순위별 입력으로 변경
- Enter로 다음 순위 자동 추가
- 1등만 입력해도 저장 가능"

$GH release create v2.0.0 \
  --title "v2.0.0 — 핀볼 자동 순위 추출 (자체 호스팅 + postMessage)" \
  --latest \
  --notes "## 🎯 핀볼 — 자동 순위 수집
- lazygyu/roulette 소스를 자체 서버에서 직접 서빙 (\`/roulette/\`)
- JS 번들에 postMessage 패치 → 공이 목표에 닿을 때마다 순위 자동 입력
- 게임 종료 후 결과창에 1등, 2등... 자동 매핑, 직접 수정 가능
- '초기화' 버튼으로 새 게임 전 결과 리셋

## 기술 상세
- \`roulette.31f8fbbf.js\`에 \`window.parent.postMessage\` 두 곳 패치
- FastAPI \`/roulette\` StaticFiles 마운트
- Next.js \`/roulette/:path*\` 리라이트 추가
- PinballTab \`window.addEventListener('message', ...)\` 수신

## 법적 검토 완료
- lazygyu/roulette: MIT 라이선스 ✅
- 포크 수정 및 자체 호스팅 허용 ✅
- 출처 표기 유지 ✅"

echo "✅ 모든 릴리즈 생성 완료"
