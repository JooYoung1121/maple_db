# 추억길드 카카오 오픈채팅 봇 설치 가이드

상시 구동 안드로이드 기기에서 메신저봇R로 카카오톡 알림을 읽고 답장하는 브릿지 방식입니다.
서버(이 저장소의 API)가 명령 해석·AI 답변·공지 큐를 담당하고, 기기는 메시지 중계만 합니다.

## 구조

```
[오픈카톡방] ↔ [안드로이드 기기: 카카오톡(봇 계정) + 메신저봇R] ↔ [서버 /api/kakao-bot/*]
```

- `!도움말` `!공지` `!이벤트` `!몹 발록` `!아이템 ...` `!맵 ...` `!스킬 히어로` `!놀이터 핀볼` `!주간` `!오늘의몬스터`
- `!질문 <내용>` / `푸확아 <내용>` → 사이트 링크 룰 매칭 → 미스 시 무료 LLM(Gemini) 답변
- 공홈 새 글 → 서버 큐 적재 → 기기가 60초마다 폴링해서 방에 전송

## 1. 서버 환경변수 (Railway)

| 변수 | 필수 | 설명 |
|---|---|---|
| `KAKAO_BOT_TOKEN` | O | 기기↔서버 인증 토큰. 아무 긴 임의 문자열 (예: `openssl rand -hex 24` 결과). **미설정 시 봇 API 전체 비활성** |
| `GEMINI_API_KEY` | 질문 기능용 | [Google AI Studio](https://aistudio.google.com/apikey)에서 무료 발급. 미설정 시 `!질문`만 비활성 (룰 링크는 동작) |
| `GEMINI_MODEL` | X | 기본 `gemini-2.5-flash` (404 시 `gemini-2.0-flash` 자동 폴백) |
| `PUBLIC_SITE_URL` | X | 링크 생성 기준. 기본 `https://memorymapledb.up.railway.app` |

## 2. 기기 준비

1. **봇 전용 카카오 계정**으로 기기의 카카오톡에 로그인합니다 (본계정 금지 — 제재 리스크 격리).
2. 봇 계정을 오픈카톡방에 입장시킵니다. 방 알림을 **켜짐**으로 둡니다 (알림이 와야 봇이 읽고 답장할 수 있음).
3. [메신저봇R](https://play.google.com/store/apps/details?id=com.xfl.msgbot) 설치 후:
   - 알림 접근 권한 허용 (설정 → 알림 접근)
   - 배터리 최적화 제외 (설정 → 배터리 → 메신저봇R·카카오톡 제외)
4. 기기 설정: 화면 꺼져도 Wi-Fi 유지, 절전 모드 해제.

## 3. 스크립트 설치

1. 메신저봇R에서 새 봇 생성 (JS, **API2** 사용).
2. `messengerbot.js` 내용을 붙여넣고 상단 `CONFIG` 수정:
   - `TOKEN`: Railway의 `KAKAO_BOT_TOKEN`과 동일한 값
   - `ROOMS`: 오픈카톡방 이름 (카톡에 표시되는 이름과 정확히 일치)
3. 컴파일 → 봇 활성화(전원 토글 ON).

## 4. 동작 확인

1. 방에서 `!도움말` 입력 → 명령어 목록이 답장으로 오면 채팅 브릿지 OK.
2. 알림 브릿지 테스트 (로컬 또는 아무 곳에서):
   ```bash
   curl -X POST https://memorymapledb.up.railway.app/api/kakao-bot/outbox/test \
     -H "X-Admin-Password: <관리자비번>"
   ```
   최대 60초 안에 방에 테스트 알림이 오면 OK. 이후 공홈 새 글이 올라올 때마다 자동 전송됩니다.

## 5. 링크 룰 관리 (관리자)

`!질문`/`푸확아` 자유 질문에서 특정 키워드가 나오면 AI 대신 사이트 링크로 답합니다.

```bash
# 룰 목록
curl https://.../api/kakao-bot/rules -H "X-Admin-Password: <비번>"
# 룰 추가 (keywords는 쉼표 구분, 띄어쓰기 무시 매칭)
curl -X POST https://.../api/kakao-bot/rules -H "X-Admin-Password: <비번>" \
  -H "Content-Type: application/json" \
  -d '{"keywords":"몬스터파크,몬파","reply":"몬스터파크 정리본이 있어요","path":"/events/monster-park-2026"}'
```

## 6. 한도·정책

- `!질문` AI 답변: 유저당 15초 쿨다운, 방당 하루 150회 (Gemini 무료 쿼터 보호)
- 링크 룰·명령어 응답은 무제한 (AI 미사용)
- 봇 계정은 카카오 약관상 그레이존이므로 계정 정지 가능성이 0이 아닙니다. 본계정과 분리 유지하세요.

## 트러블슈팅

| 증상 | 확인 |
|---|---|
| 명령에 무반응 | 방 알림 켜짐? 알림 접근 권한? ROOMS 이름 정확? 봇 전원 ON? |
| "HTTP 403" 로그 | CONFIG.TOKEN ≠ 서버 KAKAO_BOT_TOKEN |
| "HTTP 503" 로그 | 서버에 KAKAO_BOT_TOKEN 미설정 |
| 알림만 안 옴 | 방에 최근 메시지가 하나도 없으면 전송 세션이 없을 수 있음 — 방이 활성 상태인지 확인 |
| `!질문` 만 실패 | GEMINI_API_KEY 미설정/쿼터 초과 — 서버 로그 확인 |
