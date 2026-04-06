"use client";

const VERSION = "2.11.0";

const SEMVER_EXPLANATION = [
  { label: "패치 (1.0.X)", desc: "버그 수정", color: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300" },
  { label: "마이너 (1.X.0)", desc: "새로운 기능 추가", color: "bg-blue-50 text-blue-700" },
  { label: "메이저 (X.0.0)", desc: "대규모 변경", color: "bg-orange-50 text-orange-700" },
];

const CHANGELOG: {
  version: string;
  date: string;
  type: "major" | "minor" | "patch";
  title: string;
  features: { category: string; items: string[] }[];
}[] = [
  {
    version: "2.11.0",
    date: "2026-04-06",
    type: "minor",
    title: "퀘스트 페이지 전면 리뉴얼 + Quest.wz 데이터 파싱",
    features: [
      {
        category: "신규 — 퀘스트 페이지 리뉴얼",
        items: [
          "Prydwen.gg 스타일 카드형/테이블형 뷰 전환",
          "사이드바 필터 (지역, 카테고리, 퀘스트 유형, 레벨 범위, 보상 유무)",
          "모바일 반응형 필터 드로어",
          "완료 체크박스 (localStorage 저장)",
          "정렬 기능 (레벨, EXP, 메소, 이름순)",
        ],
      },
      {
        category: "신규 — 퀘스트 상세 페이지",
        items: [
          "탭 구조: 개요 / 조건·보상 / 퀘스트 체인",
          "선행 퀘스트 체인 타임라인 시각화",
          "보상 아이템·필요 몬스터 링크 연결",
          "사이드바 빠른 정보 카드",
        ],
      },
      {
        category: "데이터 — Quest.wz v62 파싱",
        items: [
          "1,697건 퀘스트 데이터 추출 (Act, Check, QuestInfo, Say)",
          "선행퀘스트, 필요아이템, 필요몬스터, EXP/메소 보상 파싱",
          "카테고리·지역·퀘스트 유형 자동 분류",
          "한국어 퀘스트명 1,623건 매칭",
          "메이플랜드 전용 퀘스트 플래그 (is_mapleland)",
          "NPC 이름 자동 매칭 1,694건",
        ],
      },
      {
        category: "보안 — API 개선",
        items: [
          "N+1 쿼리 → 배치 쿼리 최적화",
          "퀘스트 체인 API 재귀 깊이 50 제한",
          "입력 파라미터 길이 제한 (검색어 100자, 필터 50자)",
          "ARIA 접근성 속성 추가 (탭, 카드, 토글)",
          "QuestChain lazy loading (탭 활성화 시에만 로드)",
        ],
      },
    ],
  },
  {
    version: "2.10.0",
    date: "2026-04-06",
    type: "minor",
    title: "오늘의 운세 + Gemini 요약 버그 수정",
    features: [
      {
        category: "신규 — 오늘의 운세 (/fortune)",
        items: [
          "생년월일 + 직업 기반 AI 개인화 운세 (띠 + 별자리 자동 계산)",
          "메이플랜드 운세 / 현실 운세 2종 탭 전환",
          "행운의 몬스터·사냥터·아이템 — DB 실제 데이터 기반 (1,200+ 몬스터, 4,700+ 맵, 11,000+ 아이템)",
          "강화운 별점 표시 (1~5점)",
          "같은 조합 하루 최대 3가지 다른 운세, 매일 자정(KST) 초기화",
          "남용 방지: IP 기반 30초 쿨다운 + 일일 3회 제한 + 쿠키 카운트다운",
          "Gemini 2.5 Flash AI 생성",
        ],
      },
      {
        category: "수정 — 공지 요약 Gemini API",
        items: [
          "서버 재시작 시 모든 AI 요약을 삭제하던 1회성 코드 제거 (매 배포마다 Gemini API 수백건 불필요 호출 방지)",
        ],
      },
    ],
  },
  {
    version: "2.9.1",
    date: "2026-04-05",
    type: "patch",
    title: "함정 선택 기능 + 모바일 레이아웃 수정",
    features: [
      {
        category: "개선 — 함정 타이머 (/trap)",
        items: [
          "함정 선택 기능: 두더지(31초)/엘나스 증기(9초)/슬리피우드 증기(9초) 전환",
          "기본 모드 PiP로 변경",
          "동적 사이클: 함정별 경고/위험 임계값 자동 조절",
          "타이머 불가 함정 정보 표시 (용의숲 돌, 돼지공원 가시 등)",
        ],
      },
      {
        category: "수정 — 수수료 계산기 (/fee)",
        items: [
          "공대 분배 모바일 레이아웃 overflow 수정 (공제 항목이 화면 밖으로 밀리던 문제)",
        ],
      },
    ],
  },
  {
    version: "2.9.0",
    date: "2026-04-05",
    type: "minor",
    title: "함정 타이머 (두더지 알리미)",
    features: [
      {
        category: "신규 — 함정 타이머 (/trap)",
        items: [
          "리프레 두더지 31초 사이클 타이머 (스페이스바 동기화)",
          "5가지 UI 모드: 그라데이션 바 / 컴팩트 / 알림음+진동 / 다중 타이머 / PiP 오버레이",
          "Document PiP API 원클릭 오버레이 (게임 위 항상 표시)",
          "Web Audio API 경고음 (5초 전, 3초 전, 출몰 시)",
          "다중 타이머: 채널별 독립 타이머 + 임박순 자동 정렬",
          "오버레이 설정 가이드 (PiP / PowerToys / 수동 배치)",
          "맵 함정 종합 정보 (두더지/떨어지는 돌/증기/가시 등 5종)",
        ],
      },
    ],
  },
  {
    version: "2.8.1",
    date: "2026-04-05",
    type: "patch",
    title: "사냥터 검증 데이터 교체 + 배 시간표 수정 + 시세 비공개",
    features: [
      {
        category: "개선 — 사냥터 추천 (/hunt)",
        items: [
          "커뮤니티(나무위키/아카라이브/DC갤/vortexgaming) + maple.db 크로스체크로 43개 사냥터 전면 교체",
          "보스런 별도 섹션 (자쿰/혼테일/파풀라투스)",
          "PQ 별도 표시 (커닝/루디/오르비스/로미오PQ)",
          "직업별 젠컷 스펙 정보 추가 (비숍/보마/나로/히어로 등)",
          "각 사냥터 출처(source) 표시",
        ],
      },
      {
        category: "개선 — 배 시간표 (/ship)",
        items: [
          "오르비스↔아쿠아리움 직행 노선 삭제 (존재하지 않는 노선)",
          "오르비스↔무릉 학 이동을 즉시 이동으로 변경",
          "즉시 이동수단 섹션 추가 (학/돌고래 택시/낙타 택시 8개 노선)",
          "아쿠아리움 가는 방법 경로 안내 추가",
          "모든 노선 실제 티켓 비용 반영 + 크림슨 발록 출현 정보",
        ],
      },
      {
        category: "변경 — 시세 조회 (/market)",
        items: [
          "시세 조회 페이지 비공개 처리 (관리자 비밀번호 인증 게이트)",
          "아이템 상세 페이지 시세 차트 임시 제거 (데이터 정확도 이슈)",
        ],
      },
    ],
  },
  {
    version: "2.8.0",
    date: "2026-04-05",
    type: "minor",
    title: "메팁 시세 연동 + 시세 조회 페이지",
    features: [
      {
        category: "신규 — 시세 조회 (/market)",
        items: [
          "메팁(matip.kr) 시세 데이터 연동 (프록시 API)",
          "아이템 검색 + 자동완성 (~1,200개 아이템)",
          "시세 차트: 매도/매수 라인 + min/max 영역 (Recharts)",
          "시간별/일별/월별 해상도 토글",
          "인기 아이템 퀵선택 (주문서/장비/소비)",
          "주문서 시세 비교 테이블 (100%/60%/10% 기대값 계산)",
        ],
      },
      {
        category: "신규 — 아이템 상세 시세",
        items: [
          "아이템 상세 페이지(/items/[id])에 실시간 시세 차트 추가",
          "매도/매수 평균가, 최저/최고가, 거래량 요약 카드",
        ],
      },
      {
        category: "개선 — 사냥터 추천 (/hunt)",
        items: [
          "빅뱅전(v62~v83) 데이터 30개로 전면 교체",
          "레벨 입력 필드 비우기 허용 (UX 개선)",
        ],
      },
      {
        category: "개선 — 성능",
        items: [
          "비매 박제 DB 쿼리 최적화 (인덱스 추가, WAL 중복 실행 제거)",
        ],
      },
    ],
  },
  {
    version: "2.7.0",
    date: "2026-04-05",
    type: "minor",
    title: "다크모드 + 사냥터 추천 + 배 시간표 + 보안 강화",
    features: [
      {
        category: "신규 — 다크모드",
        items: [
          "전체 사이트 다크모드 지원 (NavBar 토글 버튼)",
          "시스템 설정 자동 감지 + localStorage 저장",
          "30개+ 페이지 및 공통 컴포넌트 dark: 스타일 적용",
        ],
      },
      {
        category: "신규 — 사냥터 추천 (/hunt)",
        items: [
          "레벨/직업/1타 데미지 기반 최적 사냥터 추천",
          "16개 큐레이션 사냥터 (레벨 1~200 커버)",
          "시간당 예상 경험치, 몬스터 테이블, 팁 표시",
        ],
      },
      {
        category: "신규 — 배 시간표 (/ship)",
        items: [
          "12개 항로 (빅토리아↔오르비스, 오르비스↔기타 지역)",
          "실시간 다음 출발 카운트다운 타이머",
          "곧 출발/대기 중 색상 상태 배지",
        ],
      },
      {
        category: "보안 — 취약점 수정",
        items: [
          "비매/투표 삭제 API에 관리자 인증 추가",
          "뉴스 HTML 렌더링 XSS 방지 (DOMPurify 적용)",
          "관리자 페이지 비밀번호 인증 게이트 추가",
          "게시판 삭제 비밀번호 헤더 전송으로 변경 (URL 노출 방지)",
        ],
      },
      {
        category: "개선 — 버그 수정",
        items: [
          "푸터 버전 표시 동기화 (v2.5.0 → v2.7.0)",
          "숫자 포맷 toLocaleString() 전체 페이지 통일",
          "투표 쿨다운 메모리 누수 수정",
          "community.py DB 연결 이중 해제 수정",
        ],
      },
    ],
  },
  {
    version: "2.6.1",
    date: "2026-03-31",
    type: "patch",
    title: "AI 요약 톤 개선",
    features: [
      {
        category: "개선 — AI 요약 (/news)",
        items: [
          "요약 말투를 딱딱한 보고서 → 편하고 읽기 쉬운 톤으로 변경",
          "요약 카드 디자인 리뉴얼 (TL;DR 라벨, 오렌지 테마)",
          "기존 요약 전체 재생성",
        ],
      },
    ],
  },
  {
    version: "2.6.0",
    date: "2026-03-31",
    type: "minor",
    title: "공지 AI 요약 기능",
    features: [
      {
        category: "신규 — 공지 AI 요약 (/news)",
        items: [
          "업데이트/이벤트 공지에 Gemini AI 요약 카드 표시",
          "게시글 펼침 시 본문 상단에 핵심 내용 요약 제공",
          "기존 게시글 자동 백필 (크롤링 시 요약 생성)",
        ],
      },
    ],
  },
  {
    version: "2.5.3",
    date: "2026-03-30",
    type: "patch",
    title: "수수료작 비교 정리",
    features: [
      {
        category: "개선 — 수수료 계산기 (/fee)",
        items: [
          "자동 최적 / 9999만 분할 제거, 99만~2499만 단위만 표시",
        ],
      },
    ],
  },
  {
    version: "2.5.2",
    date: "2026-03-30",
    type: "patch",
    title: "수수료 계산기 UX 개선",
    features: [
      {
        category: "개선 — 수수료 계산기 (/fee)",
        items: [
          "수수료작 비교 테이블: 건당 수수료·실수령액 표시 (건당 얼마 빠지는지 확인 가능)",
          "분할 행 클릭 시 해당 기준 실수령액 카드 표시",
          "기록 저장 시 선택한 분할 기준으로 저장 (노수작/499만/999만 등)",
        ],
      },
    ],
  },
  {
    version: "2.5.1",
    date: "2026-03-30",
    type: "patch",
    title: "수수료 계산기 탭 통합",
    features: [
      {
        category: "개선 — 수수료 계산기 (/fee)",
        items: [
          "수수료 계산 + 최적 분할 탭을 하나로 통합 (3탭 → 2탭)",
          "금액 입력 시 단건 수수료 + 분할 비교 테이블 동시 표시",
          "분할 단위별(499만/999만/2499만/9999만) 수수료·절약액 비교",
          "자동 최적 분할 추천 행 하이라이트",
          "직접거래 또는 10만 미만 시 분할 비교 섹션 자동 숨김",
        ],
      },
    ],
  },
  {
    version: "2.5.0",
    date: "2026-03-30",
    type: "minor",
    title: "자유게시판 + 투표 기능 강화",
    features: [
      {
        category: "신규 — 자유게시판 (/guild/board)",
        items: [
          "자유게시판: 글쓰기 (닉네임/제목/내용)",
          "댓글 작성 + 추천(IP 중복 방지)",
          "댓글 정렬: 최신순/추천순 토글",
          "관리자 비밀번호 보호 글/댓글 삭제",
          "글 목록 페이지네이션, 댓글 수 표시",
        ],
      },
      {
        category: "개선 — 투표 (/community)",
        items: [
          "복수투표 허용 옵션 (선택지별 개별 투표)",
          "사용자 선택지 추가 허용 옵션 (최대 20개)",
          "마감일 설정 (datetime-local) + '마감됨' 배지 표시",
          "마감 후 투표/선택지 추가 불가",
        ],
      },
      {
        category: "변경 — 내비게이션",
        items: [
          "추억길드 메뉴에 '자유게시판' 링크 추가",
        ],
      },
    ],
  },
  {
    version: "2.4.0",
    date: "2026-03-30",
    type: "minor",
    title: "디스코드 봇 통합",
    features: [
      {
        category: "신규 — 디스코드 봇 연동",
        items: [
          "maple.land 신규 공지/이벤트 자동 디스코드 알림",
          "길드 게시판(공지·이벤트) 작성 시 자동 디스코드 알림",
          "관리자 수동 알림(공지) 전송 기능",
          "웹 관리 페이지(/guild/discord)에서 봇 설정 관리 (채널 ID, 알림 on/off)",
          "봇 온라인/오프라인 상태 실시간 표시",
        ],
      },
      {
        category: "변경 — 내비게이션",
        items: [
          "추억길드 메뉴에 '디스코드 봇' 링크 추가",
        ],
      },
    ],
  },
  {
    version: "2.3.1",
    date: "2026-03-30",
    type: "patch",
    title: "보스별 쿨타임 규칙 정확 반영",
    features: [
      {
        category: "보스 쿨타이머",
        items: [
          "자쿰/파풀: 1트 시작 기준 24시간 쿨 (2트 시간과 무관하게 1트 기준으로 전체 리셋)",
          "혼테일: 1트만 가능, 24시간 쿨",
          "피아누스: 비늘 수령 시점 기준 7일 쿨 (비늘 소모 후 퀘 재활성화)",
          "크림슨파퀘: 1트·2트 각각 개별 1주일 쿨 (따로 계산)",
          "보스별 쿨 규칙 안내 박스 추가",
          "폼 시각 라벨 보스별 분기 (1트 시작 시각/비늘 수령 시각/입장 시각)",
          "1트만 가능한 보스는 트라이 선택 숨김",
          "7일 쿨 카운트다운에 일(day) 단위 표시",
        ],
      },
    ],
  },
  {
    version: "2.3.0",
    date: "2026-03-30",
    type: "minor",
    title: "보스 관리 페이지 + 수수료 기록 저장",
    features: [
      {
        category: "신규 — 보스 관리 (/guild/boss)",
        items: [
          "쿨타이머 탭: 보스별 클리어 기록 등록, 남은시간 실시간 카운트다운",
          "구인 탭: 보스 구인글 작성, 참가/취소, 인원 마감 자동 처리",
          "드롭 기록 탭: 보스별 드롭 아이템 기록 관리",
          "자쿰 / 혼테일 / 피아누스 / 파풀라투스 / 크림슨파퀘 5종 지원",
        ],
      },
      {
        category: "개선 — 수수료 계산기",
        items: [
          "각 탭 (단건/분할/공대) 계산 결과 기록 저장 기능 추가",
          "하단 '최근 기록' 접기/펼치기 섹션 (유형별 요약 표시)",
          "관리자 비밀번호 보호 삭제",
        ],
      },
      {
        category: "변경 — 내비게이션",
        items: [
          "추억길드 메뉴에 '보스' 링크 추가",
        ],
      },
    ],
  },
  {
    version: "2.2.1",
    date: "2026-03-28",
    type: "patch",
    title: "길드원 레벨 인라인 수정 추가",
    features: [
      {
        category: "길드원 명단",
        items: [
          "레벨 셀 클릭 → 인라인 수정 (비밀번호 불필요, 누구나 가능)",
          "Enter 저장 / Escape 취소 / 포커스 이탈 시 자동 저장",
        ],
      },
    ],
  },
  {
    version: "2.2.0",
    date: "2026-03-28",
    type: "minor",
    title: "길드원 명단 페이지 추가 + 내비 공지 텍스트 변경",
    features: [
      {
        category: "신규 — 길드원 명단 (/guild/members)",
        items: [
          "124명 초기 데이터 적재 (마스터 1 · 부마스터 7 · 길드원 84 · 부캐릭 31 · 새싹 1)",
          "직책별 필터 탭 (전체 / 마스터 / 부마스터 / 길드원 / 부캐릭 / 새싹)",
          "레벨 내림차순 / 닉네임 정렬 지원",
          "직책 배지 색상 구분 (마스터: 오렌지, 부마스터: 파랑, 길드원: 그레이, 부캐릭: 연보라, 새싹: 초록)",
          "통계 카드: 전체 인원, 직책별 수, 평균 레벨",
          "관리자 모드: 추가 / 수정 / 삭제 (비밀번호 보호)",
        ],
      },
      {
        category: "변경 — 내비게이션",
        items: [
          "'공지' 링크 텍스트 → '메랜 공홈 공지'로 변경",
          "추억길드 메뉴에 '길드원 명단' 링크 추가",
        ],
      },
    ],
  },
  {
    version: "2.1.1",
    date: "2026-03-28",
    type: "patch",
    title: "디스코드 링크 + 핀볼 사용 안내 개선",
    features: [
      {
        category: "추억길드",
        items: ["디스코드 초대 링크 연결 (discord.gg/2T7DNt54D)"],
      },
      {
        category: "핀볼",
        items: [
          "결과 저장 사용 안내 박스 추가 (슬롯 미리 추가 방법 설명)",
          "N명 빠른 설정 드롭다운 추가 (2~8명 선택 시 슬롯 자동 생성)",
        ],
      },
    ],
  },
  {
    version: "2.1.0",
    date: "2026-03-28",
    type: "minor",
    title: "추억길드 전용 게시판 추가",
    features: [
      {
        category: "신규 — 추억길드 페이지 (/guild)",
        items: [
          "디스코드 초대 버튼 (링크 추가 예정)",
          "공지사항 / 이벤트 탭 분리",
          "관리자 비밀번호로 글쓰기/삭제 가능",
          "제목·내용·작성자 입력, 클릭으로 내용 펼치기",
          "KST 타임존 적용",
        ],
      },
    ],
  },
  {
    version: "2.0.0",
    date: "2026-03-28",
    type: "major",
    title: "핀볼 자동 순위 추출 (자체 호스팅)",
    features: [
      {
        category: "핀볼 — 자동 순위 수집",
        items: [
          "lazygyu/roulette 소스를 자체 서버에서 직접 서빙 (/roulette/)",
          "JS 번들에 postMessage 패치 → 공이 목표에 닿을 때마다 순위 자동 입력",
          "게임 종료 후 결과창에 1등, 2등... 자동 매핑, 직접 수정 가능",
          "'초기화' 버튼으로 새 게임 전 결과 리셋",
        ],
      },
    ],
  },
  {
    version: "1.9.3",
    date: "2026-03-28",
    type: "patch",
    title: "핀볼 순위 다중 입력",
    features: [
      {
        category: "핀볼",
        items: [
          "결과 저장: 우승자 1명 → 순위별 전체 입력으로 변경",
          "1등~N등 순서대로 이름 입력, '+ 순위 추가' 버튼으로 확장",
          "1등만 입력해도 저장 가능",
        ],
      },
    ],
  },
  {
    version: "1.9.2",
    date: "2026-03-28",
    type: "patch",
    title: "게임 기록 수동 저장 + 서울 타임존 적용",
    features: [
      {
        category: "변경 — 게임 기록",
        items: [
          "룰렛·주사위·사다리: 게임 종료 후 '📋 기록 저장' 버튼 노출, 누를 때만 저장",
          "서버 타임존 UTC → KST(서울) 적용",
        ],
      },
    ],
  },
  {
    version: "1.9.1",
    date: "2026-03-28",
    type: "patch",
    title: "핀볼 전체화면 + 결과 수동 저장",
    features: [
      {
        category: "핀볼",
        items: [
          "전체화면 버튼 추가 (⛶) — iframe 전체화면 토글",
          "결과 저장 폼 추가 — 우승자 이름 직접 입력 후 기록 저장",
        ],
      },
    ],
  },
  {
    version: "1.9.0",
    date: "2026-03-28",
    type: "patch",
    title: "핀볼 이름 복구 + 공경주 탭 제거",
    features: [
      {
        category: "변경",
        items: [
          "공뽑기 → 핀볼로 이름 복구 (🎯 핀볼)",
          "공경주 탭 제거",
          "MIT 라이선스 출처 표기 추가 (lazygyu/roulette)",
        ],
      },
    ],
  },
  {
    version: "1.8.0",
    date: "2026-03-28",
    type: "minor",
    title: "공뽑기 box2d-wasm 물리 엔진으로 교체",
    features: [
      {
        category: "변경 — 공뽑기",
        items: [
          "수제 물리 → lazygyu/roulette (box2d-wasm) iframe 교체",
          "업계 최고 수준 2D 강체 물리 엔진 적용",
          "멀티볼, 스킬(밀쳐내기), 다양한 맵 등 풍부한 기능 지원",
          "게임 내에서 직접 참가자 입력 (이름/가중치, 이름*중복 문법)",
        ],
      },
    ],
  },
  {
    version: "1.7.0",
    date: "2026-03-28",
    type: "minor",
    title: "공뽑기 개편 (높이 3배) + 공경주 추가",
    features: [
      {
        category: "변경 — 공뽑기 (구 핀볼)",
        items: [
          "이름 변경: 핀볼 → 공뽑기",
          "캔버스 높이 3배 (520 → 1560px), 페그 24행으로 확장",
          "낙하 중 공을 따라 자동 스크롤",
        ],
      },
      {
        category: "신규 — 공경주 (멀티볼 레이스)",
        items: [
          "참가자별 공이 동시에 낙하 — 먼저 FINISH 라인에 닿는 순서로 순위 결정",
          "공끼리 충돌 물리 적용 (예측 불가능한 결과)",
          "실시간 순위 현황 표시 (🥇🥈🥉)",
          "순수 물리 시뮬레이션 — 편향 없는 공정한 레이스",
        ],
      },
    ],
  },
  {
    version: "1.6.0",
    date: "2026-03-28",
    type: "minor",
    title: "사다리 타기 추가",
    features: [
      {
        category: "신규 — 사다리 타기",
        items: [
          "Canvas 기반 사다리 그래픽: 참가자 최대 8명",
          "당첨자 뽑기 모드 (당첨/꽝) / 순서 정하기 모드 (1등~N등)",
          "사다리 미리 보기 후 시작 → 2.4초 애니메이션으로 경로 표시",
          "'새 사다리' 버튼으로 사다리 재생성 가능",
          "전체 결과 테이블 표시 (참가자별 결과)",
          "게임 기록 자동 저장",
        ],
      },
    ],
  },
  {
    version: "1.5.0",
    date: "2026-03-28",
    type: "minor",
    title: "핀볼(Plinko) 추가 및 게임 기록 저장",
    features: [
      {
        category: "신규 — 핀볼 (Plinko)",
        items: [
          "Canvas 기반 물리 시뮬레이션: 공이 핀을 튕기며 낙하",
          "참가자 최대 10명 슬롯 등분, 공이 당첨 슬롯으로 자연스럽게 수렴",
          "8행 삼각 핀 배열, 중력·반사·마찰 물리 파라미터 적용",
          "당첨 슬롯 오렌지 하이라이트 + 당첨자 발표 카드",
        ],
      },
      {
        category: "신규 — 게임 기록 저장",
        items: [
          "룰렛·주사위·핀볼 결과를 서버에 자동 저장",
          "놀이터 하단 '최근 기록' 섹션 (접기/펼치기)",
          "주사위 기록에 합계 점수 표시",
          "비밀번호 보호 삭제: 관리자 비밀번호 입력 모달",
          "환경변수 GAME_ADMIN_PASSWORD 로 비밀번호 관리 (Railway)",
        ],
      },
    ],
  },
  {
    version: "1.4.0",
    date: "2026-03-28",
    type: "minor",
    title: "로또 생성기 추가 및 홈·커뮤니티 구조 개편",
    features: [
      {
        category: "신규 — 로또 번호 생성기",
        items: [
          "1~45 중 6개 + 보너스 번호 랜덤 추첨",
          "한국 로또 공식 색상 구슬 UI (노랑/파랑/빨강/회색/초록)",
          "1·3·5개 세트 동시 생성 가능",
        ],
      },
      {
        category: "구조 개편 — 커뮤니티 / 놀이터 분리",
        items: [
          "커뮤니티: 비매박제, 투표 (유저 생성 콘텐츠)",
          "놀이터: 룰렛·주사위(/play), 로또(/lotto) (랜덤 툴)",
          "기존 /community는 투표 전용으로 분리",
        ],
      },
      {
        category: "홈 화면 개편",
        items: [
          "5개 카드 → 정보·계산기·가이드·커뮤니티·놀이터 섹션 구조화",
          "보스, 스킬, 수수료, 파티퀘스트, 비매박제 등 누락 항목 추가",
        ],
      },
    ],
  },
  {
    version: "1.3.1",
    date: "2026-03-26",
    type: "patch",
    title: "룰렛·주문서 UI 개선 및 주사위 기능 추가",
    features: [
      {
        category: "커뮤니티 — 주사위",
        items: [
          "주사위 탭 추가: 닉네임 등록 후 주사위 굴리기 대결",
          "주사위 수 선택 (1~6개), 개별 결과 및 합산 표시",
          "합산 높은 순 자동 정렬, 1위 트로피 표시",
        ],
      },
      {
        category: "커뮤니티 — 룰렛",
        items: [
          "공평 모드 / 불공평 모드 버튼 분리 (단일 토글 → 두 버튼)",
          "불공평 모드 클릭 시마다 가중치 재랜덤 적용",
        ],
      },
      {
        category: "주문서 시뮬레이션",
        items: [
          "주문서 버튼의 (+N) 스탯 표시 제거 → [Q/W/E/R/T] 단축키 표시로 변경",
          "아이템 이름 검색으로 장비 종류 자동 설정 (영웅의 글라디우스 등 25종)",
        ],
      },
    ],
  },
  {
    version: "1.3.0",
    date: "2026-03-26",
    type: "minor",
    title: "메이플랜드 공식 공지 자동 수집 및 검색",
    features: [
      {
        category: "공지 페이지 (/news)",
        items: [
          "maple.land 공지사항·이벤트 자동 크롤링 (30분마다 신규 수집)",
          "카테고리 필터: 업데이트 / 점검 / 안내 / 이벤트 / 제재",
          "제목·내용 키워드 검색",
          "클릭 시 본문 인라인 펼침 + 원문 링크 제공",
          "검색 키워드 가이드 (패치노트, 버그 수정, 이벤트 등 주제별 분류)",
        ],
      },
      {
        category: "네비게이션",
        items: [
          "상단 메뉴에 '공지' 링크 추가",
          "마지막 방문 이후 새 공지 수를 빨간 뱃지로 표시",
        ],
      },
    ],
  },
  {
    version: "1.2.0",
    date: "2026-03-24",
    type: "minor",
    title: "사냥터 젠컷 정보 페이지 개편 + 주문서 UI 개선",
    features: [
      {
        category: "사냥터 탭 전면 개편",
        items: [
          "직업별 스탯 입력 방식 → 사냥터별 젠컷 기준 참조 테이블로 변경",
          "마법직업: 1방/2방컷에 필요한 마력(MA) 임계값 자동 계산 표시",
          "물리직업: 기준 스탯공격력 입력 시 몇 방컷인지 역산 표시",
          "커뮤니티 검증 데이터 별도 표시 (비숍 남둥 마력 885~910, 보마 망용둥 스공 5400 등)",
          "11개 주요 사냥터 수록 (미나르숲 타우로마시스 ~ 망가진 용의 둥지)",
          "레벨·직업계열·지역 필터 지원",
        ],
      },
      {
        category: "주문서 시뮬레이션 UI",
        items: [
          "주문서 확률 버튼 순서 변경: 100→10% → 10→100% (qwert 키보드 순서 대응)",
        ],
      },
    ],
  },
  {
    version: "1.1.1",
    date: "2026-03-23",
    type: "patch",
    title: "법사 데미지 공식 수정 및 몬스터 데이터 보정",
    features: [
      {
        category: "버그 수정",
        items: [
          "법사 MIN 데미지 공식: (INT+LUK×0.5) → (INT×숙련도(60%)+LUK) 로 수정 — 숙련도 개념 올바르게 반영",
          "스켈로스 방어 데이터 수정: 물방 950→810, 마방 950→710 (메이플랜드 실제값)",
        ],
      },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-03-23",
    type: "minor",
    title: "커뮤니티 기능 추가 및 엔방컷 계산기 개선",
    features: [
      {
        category: "커뮤니티 — 투표",
        items: [
          "투표 생성/참여/삭제 기능 (질문 + 선택지 2~6개)",
          "득표율 바 차트 시각화",
          "IP 기반 중복 투표 방지",
        ],
      },
      {
        category: "커뮤니티 — 룰렛",
        items: [
          "참가자 이름 추가/삭제, 당첨 수 설정",
          "공평 모드: 모든 참가자 동일 확률",
          "불공평 모드: 클릭마다 무작위 가중치 재배분",
          "SVG 파이 차트 시각화 + 10초 회전 애니메이션",
        ],
      },
      {
        category: "사냥터 추천 탭 개선",
        items: [
          "사냥터 탭 자체 캐릭터 레벨/평균 데미지 입력 가능",
          "계산기 탭 값으로 불러오기 버튼 추가",
        ],
      },
      {
        category: "스킬 데이터 수정",
        items: [
          "아이스스트라이크 맥스 레벨 30 확인",
        ],
      },
    ],
  },
  {
    version: "1.0.5",
    date: "2026-03-23",
    type: "patch",
    title: "엔방컷 계산기 개선 및 스킬 데이터 정확도 향상",
    features: [
      {
        category: "버그 수정",
        items: [
          "숫자 입력 필드에서 백스페이스로 한 자리 수 삭제 안 되는 문제 수정",
        ],
      },
      {
        category: "스킬 데이터 수정 (메이플랜드 기준)",
        items: [
          "비숍 제네시스: 670% → 650%, 타격 마리수 15 → 10",
          "썬콜 체인 라이트닝: 300% → 210% (Lv.30 기준)",
          "썬콜 아이스 스트라이크: 210% → 90% (Lv.20 기준)",
        ],
      },
      {
        category: "엔방컷 계산기 — 레벨 기준 스탯 자동 계산",
        items: [
          "캐릭터 레벨 변경 시 주 스탯 자동 계산 (레벨 × 5)",
          "직업 변경 시 주/부 스탯 자동 초기화",
          "직업별 기본 부스탯 설정 (전사 DEX 25, 마법사 LUK 20 등)",
          "자동 계산 ON/OFF 토글 지원",
        ],
      },
      {
        category: "엔방컷 계산기 — 패시브 스킬 추가",
        items: [
          "보우마스터 크리티컬샷 패시브 추가 (크리티컬 확률 +40%)",
          "신궁 크리티컬샷 패시브 추가 (크리티컬 확률 +40%)",
        ],
      },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-03-22",
    type: "major",
    title: "최초 릴리즈",
    features: [
      {
        category: "데이터베이스",
        items: [
          "아이템 데이터베이스 — 장비, 소비, 기타 아이템 전체 수록",
          "몬스터 데이터베이스 — 스탯, 드롭 정보 포함",
          "맵 데이터베이스 — 필드/던전/지역 분류",
          "NPC 데이터베이스 — 상점 및 퀘스트 NPC",
          "퀘스트 데이터베이스 — 선행/보상 조건 포함",
          "스킬 데이터베이스 — 직업별 스킬 목록",
        ],
      },
      {
        category: "경험치 계산기",
        items: [
          "한타임 사냥 경험치 계산",
          "목표 레벨 달성 시간 계산",
          "경험치표 조회",
        ],
      },
      {
        category: "주문서 시뮬레이션",
        items: [
          "성공 확률 계산",
          "주문서 시뮬레이터",
          "강화 후 스탯 비교표",
        ],
      },
      {
        category: "수수료 계산기",
        items: [
          "공대 분배 수수료 계산 (노수작 / 수수작)",
          "거래 방식별 수수료 (직접 거래 / 일반 / 택배)",
          "최적 분할 단위 자동 계산",
          "공제 항목 다중 추가 지원",
        ],
      },
      {
        category: "비매박제 게시판",
        items: [
          "비매너 유저 신고 게시판",
          "직업 세분화 (히어로, 팔라딘, 썬콜 등)",
          "아이템 분류 필터",
        ],
      },
      {
        category: "보스 정보",
        items: ["보스 몬스터 스탯 및 드롭 정보"],
      },
      {
        category: "파티퀘스트 가이드",
        items: ["파티퀘스트 진행 방법 및 보상 안내"],
      },
      {
        category: "검색",
        items: ["FTS5 기반 통합 전문 검색"],
      },
    ],
  },
];

const TYPE_BADGE: Record<"major" | "minor" | "patch", string> = {
  major: "bg-orange-100 text-orange-700 border border-orange-200",
  minor: "bg-blue-50 text-blue-700 border border-blue-200",
  patch: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700",
};

const TYPE_LABEL: Record<"major" | "minor" | "patch", string> = {
  major: "메이저",
  minor: "마이너",
  patch: "패치",
};

export default function VersionPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <span className="inline-block bg-orange-500 text-white text-2xl font-bold px-6 py-2 rounded-full tracking-wide">
          v{VERSION}
        </span>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">버전 정보 / 변경 이력</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">추억길드 전용 메랜 정보 사이트</p>
      </div>

      {/* Semver explanation */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-3">
        <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">시맨틱 버전 안내</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          {SEMVER_EXPLANATION.map((s) => (
            <div key={s.label} className={`flex-1 rounded-lg px-4 py-3 ${s.color}`}>
              <p className="font-semibold text-sm">{s.label}</p>
              <p className="text-xs mt-0.5 opacity-80">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Changelog timeline */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">변경 이력</h2>

        {CHANGELOG.map((entry) => (
          <div key={entry.version} className="flex gap-4">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-orange-500 mt-1.5 shrink-0" />
              <div className="w-px flex-1 bg-gray-200 mt-1" />
            </div>

            {/* Card */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-6 flex-1 space-y-4">
              {/* Version header */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">v{entry.version}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_BADGE[entry.type]}`}>
                  {TYPE_LABEL[entry.type]}
                </span>
                <span className="text-xs text-gray-400 ml-auto">{entry.date}</span>
              </div>
              <p className="text-sm font-medium text-orange-600">{entry.title}</p>

              {/* Feature categories */}
              <div className="space-y-4">
                {entry.features.map((cat) => (
                  <div key={cat.category}>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                      {cat.category}
                    </p>
                    <ul className="space-y-1">
                      {cat.items.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <span className="text-orange-400 mt-0.5 shrink-0">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
