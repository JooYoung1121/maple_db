export interface SiteFeature {
  href: string;
  label: string;
  icon: string;
  description: string;
  homeLabel?: string;
}

export interface SiteSection {
  label: string;
  icon?: string; // 사이드 레일 아이콘
  items: SiteFeature[];
}

export const SITE_SECTIONS: SiteSection[] = [
  {
    label: "브레인",
    icon: "🧠",
    items: [
      { href: "/brain", label: "메랜 브레인", homeLabel: "메랜 브레인", icon: "🧠", description: "내 캐릭터 중심 지식 그래프 — 사냥터·퀘스트·드랍 탐색" },
    ],
  },
  {
    label: "마이",
    icon: "🍄",
    items: [
      { href: "/me", label: "마이페이지", icon: "🍄", description: "계정·캐릭터·즐겨찾기·추천을 한 곳에서" },
    ],
  },
  {
    label: "정보",
    icon: "📚",
    items: [
      { href: "/items", label: "아이템", icon: "🗡️", description: "무기, 방어구, 소비" },
      { href: "/mobs", label: "몬스터", icon: "👾", description: "일반 몬스터, 보스" },
      { href: "/bosses", label: "보스", icon: "💀", description: "보스 공략 정보" },
      { href: "/maps", label: "맵", icon: "🗺️", description: "사냥터, 마을, 던전" },
      { href: "/npcs", label: "NPC", icon: "🧑", description: "상점, 퀘스트 NPC" },
      { href: "/quests", label: "퀘스트", icon: "📜", description: "메인, 서브 퀘스트" },
      { href: "/quest-roadmap", label: "퀘스트 로드맵", icon: "🧭", description: "레벨별 퀘스트 진행 가이드" },
      { href: "/skills", label: "스킬", icon: "✨", description: "직업별 스킬 정보" },
      { href: "/drop-search", label: "획득 경로", icon: "🔎", description: "아이템 → 몬스터 → 출현 맵" },
    ],
  },
  {
    label: "계산기",
    icon: "🧮",
    items: [
      { href: "/damage", label: "스공 계산기", homeLabel: "스공 계산기", icon: "🧮", description: "스탯·메용·도핑 반영" },
      { href: "/scroll", label: "주문서 계산기", homeLabel: "주문서", icon: "📖", description: "강화 시뮬레이터" },
      { href: "/exp", label: "경험치 계산기", homeLabel: "경험치", icon: "📈", description: "레벨업 계산" },
      { href: "/nhit", label: "엔방컷 계산기", homeLabel: "엔방컷", icon: "⚔️", description: "젠컷 계산" },
      { href: "/skill-sim", label: "스킬 시뮬레이터", icon: "✨", description: "직업별 스킬 빌드 설계" },
      { href: "/gear-sim", label: "장비 세팅", icon: "🧰", description: "장비 조합 스탯 · 데미지 시뮬" },
      { href: "/fee", label: "공대 분배 계산기", homeLabel: "공대 분배", icon: "🪙", description: "보스 드랍 아이템 N빵 정산" },
    ],
  },
  {
    label: "전문기술",
    icon: "⚒️",
    items: [
      { href: "/maker", label: "메이커", icon: "⚒️", description: "제작 정보와 리버스 무기 기대값" },
    ],
  },
  {
    label: "가이드",
    icon: "📖",
    items: [
      { href: "/pq", label: "파티퀘스트", icon: "🏰", description: "PQ 공략 및 보상" },
      { href: "/hunt", label: "사냥터 추천", icon: "🎯", description: "레벨별 사냥터 가이드" },
      { href: "/leveling", label: "직업별 사냥터", icon: "🗺️", description: "직업·레벨 구간별 육성 루트" },
      { href: "/events", label: "이벤트 정리", icon: "🗂️", description: "진행 중 이벤트 요약 · 아카이브" },
      { href: "/job", label: "전직 가이드", icon: "📋", description: "직업별 전직 경로" },
      { href: "/medals", label: "훈장 가이드", icon: "🎖️", description: "탐험가 트리 · 기부왕 · 레벨 훈장" },
      { href: "/ship", label: "배 시간표", icon: "🚢", description: "정기선 운항 시간" },
      { href: "/trap", label: "함정 타이머", homeLabel: "트랩 타이머", icon: "⏱️", description: "트랩 주기 타이머" },
      { href: "/horntail", label: "혼테일 공략", icon: "🐲", description: "패턴 · 직업별 준비물 · 파츠별 딜 위치" },
      { href: "/boss-timer", label: "혼테일 타이머", icon: "🐉", description: "리저 · 공무 · 버프해제 쿨타임" },
      { href: "/field-boss", label: "필드보스 채널", icon: "👑", description: "처치 채널 · 시각 공유로 젠 로테이션" },
    ],
  },
  {
    label: "커뮤니티",
    icon: "💬",
    items: [
      { href: "/news", label: "공홈 소식", homeLabel: "메랜 공홈 소식", icon: "📰", description: "메이플랜드 공지·이벤트" },
      { href: "/weekly", label: "주간 메랜", icon: "🗞️", description: "한 주의 공식·커뮤니티 소식" },
      { href: "/channels", label: "채널 · 커뮤니티", icon: "📺", description: "메랜 방송 · 영상 · 공식 Discord 모음" },
      { href: "/bimae", label: "비매박제", icon: "🚫", description: "비매 유저 신고" },
      { href: "/community", label: "투표", icon: "🗳️", description: "유저 투표 참여" },
      { href: "/version", label: "업데이트 소식", icon: "🧾", description: "사이트 변경 내역" },
    ],
  },
  {
    label: "놀이터",
    icon: "🎮",
    items: [
      { href: "/play", label: "룰렛 · 주사위", icon: "🎰", description: "룰렛, 주사위 굴리기" },
      { href: "/lotto", label: "로또", icon: "🎱", description: "랜덤 번호 생성" },
      { href: "/fortune", label: "오늘의 운세", icon: "🔮", description: "메이플 운세 보기" },
      { href: "/quiz", label: "메이플 퀴즈", icon: "❓", description: "스피드퀴즈 · 실루엣 퀴즈" },
      { href: "/daily-mob", label: "오늘의 몬스터", icon: "👾", description: "매일 바뀌는 몬스터 추리" },
      { href: "/mapletle", label: "추억틀", icon: "🌡️", description: "단어 유사도로 메랜 단어 추리" },
      { href: "/worldcup", label: "이상형 월드컵", icon: "🏆", description: "몬스터 · 코디템 최애 뽑기" },
      { href: "/codi", label: "코디 시뮬레이터", icon: "🎨", description: "헤어 · 성형 · 장비 입혀보기" },
      { href: "/versus", label: "대전 게임", icon: "⚔️", description: "오목 · 짝맞추기 · 끝말잇기" },
      { href: "/chosung", label: "초성퀴즈 검색기", icon: "🔤", description: "초성으로 메랜 이름 찾기" },
      { href: "/museum", label: "이세계 도감", icon: "🗃️", description: "메랜에 없는 몹·아이템 구경" },
    ],
  },
  {
    label: "유물창고",
    icon: "🏺",
    items: [
      { href: "/tespia-bosses", label: "테스피아 2.0 보스", icon: "🏺", description: "2.0 오픈 전 미리보기 아카이브" },
    ],
  },
  {
    label: "추억길드",
    icon: "🍁",
    items: [
      { href: "/guild", label: "공지 · 이벤트", icon: "📢", description: "길드 공지사항" },
      { href: "/guild/events", label: "이벤트 모집", icon: "🎪", description: "유저 주최 이벤트 — 지원 · 룰렛 추첨" },
      { href: "/guild/members", label: "길드원 명단", icon: "👥", description: "길드원 정보" },
      { href: "/guild/attendance", label: "출석부", icon: "📋", description: "출석 체크 · 월간 랭킹" },
      { href: "/guild/boss", label: "보스", icon: "🐉", description: "보스 파티 · 기록" },
      { href: "/guild/board", label: "자유게시판", icon: "💬", description: "길드원 소통" },
      { href: "/guild/info", label: "정보공유", icon: "📚", description: "길드 공략과 자료 공유" },
      { href: "/guild/discord", label: "디스코드 봇", icon: "🤖", description: "대화형 챗봇 · 알림 설정" },
    ],
  },
];

export const ALL_SITE_FEATURES = SITE_SECTIONS.flatMap((section) => section.items);

export const SEARCH_TYPE_META: Record<string, {
  label: string;
  path: string;
  bg: string;
  text: string;
}> = {
  item: { label: "아이템", path: "/items", bg: "bg-blue-100 dark:bg-blue-950", text: "text-blue-700 dark:text-blue-300" },
  mob: { label: "몬스터", path: "/mobs", bg: "bg-red-100 dark:bg-red-950", text: "text-red-700 dark:text-red-300" },
  map: { label: "맵", path: "/maps", bg: "bg-green-100 dark:bg-green-950", text: "text-green-700 dark:text-green-300" },
  npc: { label: "NPC", path: "/npcs", bg: "bg-purple-100 dark:bg-purple-950", text: "text-purple-700 dark:text-purple-300" },
  quest: { label: "퀘스트", path: "/quests", bg: "bg-yellow-100 dark:bg-yellow-950", text: "text-yellow-800 dark:text-yellow-200" },
  skill: { label: "스킬", path: "/skills", bg: "bg-cyan-100 dark:bg-cyan-950", text: "text-cyan-800 dark:text-cyan-200" },
};

export function featureForPath(pathname: string): SiteFeature | undefined {
  return [...ALL_SITE_FEATURES]
    .sort((a, b) => b.href.length - a.href.length)
    .find((feature) => pathname === feature.href || pathname.startsWith(`${feature.href}/`));
}
