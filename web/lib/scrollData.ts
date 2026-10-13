/* 주문서 공용 데이터·확률 유틸 — /scroll(확률 계산기)과 /scroll-sim(시뮬레이터)이 함께 쓴다.
 * 수치 정본은 여기 한 곳에만 둔다 (주문서 등급·업횟·스탯표·대표 아이콘). */
import type React from "react";

// ─── 주문서 데이터 ───
// icon: 확률 등급별 대표 주문서 아이템 ID (상의 힘 주문서 계열 — 등급별 테두리 색이 실제 %와 일치).
//        DB entity_names_en 검증값. 게임 내 주문서 테두리 색(회/파/노/…)이 % 등급을 그대로 나타낸다.
export const SCROLL_TYPES = [
  { pct: 10, label: "10%", desc: "최고 능력치, 최저 확률", color: "red", icon: 2040419 },
  { pct: 30, label: "30%", desc: "높은 능력치, 낮은 확률", color: "purple", icon: 2040407 },
  { pct: 60, label: "60%", desc: "가장 가성비가 좋음", color: "orange", icon: 2040418 },
  { pct: 70, label: "70%", desc: "준수한 확률과 능력치", color: "blue", icon: 2040406 },
  { pct: 100, label: "100%", desc: "안전하지만 낮은 능력치", color: "green", icon: 2040417 },
] as const;

export const SCROLL_SHORTCUTS: Record<number, string> = { 10: "Q", 30: "W", 60: "E", 70: "R", 100: "T" };

// 확률 → 대표 주문서 아이콘 (서버 아이콘 프록시 — CDN 변덕 차단)
export const SCROLL_ICON_BY_PCT: Record<number, number> = Object.fromEntries(
  SCROLL_TYPES.map((s) => [s.pct, s.icon])
);
export function scrollIconUrl(pct: number): string {
  const id = SCROLL_ICON_BY_PCT[pct] ?? SCROLL_ICON_BY_PCT[60];
  return `/api/icon/item/${id}`;
}

// 확률 등급별 테마 색 (Tailwind 클래스 — 슬롯/배지/버튼 공통)
export const PCT_THEME: Record<number, { ring: string; text: string; bg: string; bar: string }> = {
  10: { ring: "border-red-400", text: "text-red-500", bg: "bg-red-500/10", bar: "bg-red-500" },
  30: { ring: "border-purple-400", text: "text-purple-500", bg: "bg-purple-500/10", bar: "bg-purple-500" },
  60: { ring: "border-orange-400", text: "text-orange-500", bg: "bg-orange-500/10", bar: "bg-orange-500" },
  70: { ring: "border-blue-400", text: "text-blue-500", bg: "bg-blue-500/10", bar: "bg-blue-500" },
  100: { ring: "border-green-400", text: "text-green-600", bg: "bg-green-500/10", bar: "bg-green-500" },
};
export function pctTheme(pct: number) {
  return PCT_THEME[pct] ?? PCT_THEME[60];
}

// 이미지 로드 실패 시 조용히 숨김 (maplestory.io CDN 간헐 장애 대비)
export function hideOnError(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.visibility = "hidden";
}

// 무기 종류별 업그레이드 횟수
export const WEAPON_SLOTS: Record<string, number> = {
  "한손검": 7,
  "두손검": 7,
  "한손둔기": 7,
  "두손둔기": 7,
  "한손도끼": 7,
  "두손도끼": 7,
  "창": 7,
  "폴암": 7,
  "단검": 7,
  "아대": 7,
  "활": 7,
  "석궁": 7,
  "클로": 7,
  "총": 7,
  "완드": 7,
  "스태프": 7,
  "방패": 10,
  "모자": 7,
  "상의": 10,
  "하의": 7,
  "전신": 10,
  "장갑": 5,
  "신발": 5,
  "망토": 5,
  "귀걸이": 5,
  "얼굴장식": 3,
  "눈장식": 3,
};

// 아이템 이름 → 장비 종류 + 아이콘 매핑 (DB 실제 데이터)
export const NAMED_ITEMS: { name: string; type: string; icon: string }[] = [
  // 한손검
  { name: "타임리스 엑서큐서너스", type: "한손검", icon: "/api/icon/item/1302081" },
  { name: "리버스 엑서큐서너스", type: "한손검", icon: "/api/icon/item/1302086" },
  { name: "드래곤 카라벨라", type: "한손검", icon: "/api/icon/item/1302059" },
  { name: "스파타", type: "한손검", icon: "/api/icon/item/1302056" },
  // 두손검
  { name: "타임리스 니플하임", type: "두손검", icon: "/api/icon/item/1402046" },
  { name: "리버스 니플하임", type: "두손검", icon: "/api/icon/item/1402047" },
  { name: "드래곤 클레이모어", type: "두손검", icon: "/api/icon/item/1402036" },
  { name: "아스카론", type: "두손검", icon: "/api/icon/item/1402073" },
  { name: "참화도", type: "두손검", icon: "/api/icon/item/1402035" },
  // 한손도끼
  { name: "타임리스 버디슈", type: "한손도끼", icon: "/api/icon/item/1312037" },
  { name: "리버스 버디슈", type: "한손도끼", icon: "/api/icon/item/1312038" },
  { name: "드래곤 엑스", type: "한손도끼", icon: "/api/icon/item/1312031" },
  { name: "토마호크", type: "한손도끼", icon: "/api/icon/item/1312030" },
  // 두손도끼
  { name: "타임리스 타바르진", type: "두손도끼", icon: "/api/icon/item/1412033" },
  { name: "리버스 타바르진", type: "두손도끼", icon: "/api/icon/item/1412034" },
  { name: "드래곤 배틀엑스", type: "두손도끼", icon: "/api/icon/item/1412026" },
  { name: "타바르", type: "두손도끼", icon: "/api/icon/item/1412021" },
  // 한손둔기
  { name: "타임리스 알라르간도", type: "한손둔기", icon: "/api/icon/item/1322060" },
  { name: "리버스 알라르간도", type: "한손둔기", icon: "/api/icon/item/1322061" },
  { name: "드래곤 메이스", type: "한손둔기", icon: "/api/icon/item/1322052" },
  { name: "배틀해머", type: "한손둔기", icon: "/api/icon/item/1322045" },
  // 두손둔기
  { name: "타임리스 벨로체", type: "두손둔기", icon: "/api/icon/item/1422037" },
  { name: "리버스 벨로체", type: "두손둔기", icon: "/api/icon/item/1422038" },
  { name: "드래곤 플레임", type: "두손둔기", icon: "/api/icon/item/1422028" },
  { name: "골든 스미스해머", type: "두손둔기", icon: "/api/icon/item/1422027" },
  // 창
  { name: "타임리스 알슈피스", type: "창", icon: "/api/icon/item/1432047" },
  { name: "리버스 알슈피스", type: "창", icon: "/api/icon/item/1432049" },
  { name: "드래곤 팔티잔", type: "창", icon: "/api/icon/item/1432038" },
  { name: "벨룸 스피어", type: "창", icon: "/api/icon/item/1432066" },
  { name: "피나카", type: "창", icon: "/api/icon/item/1432030" },
  // 폴암
  { name: "커터문", type: "폴암", icon: "/api/icon/item/1442002" },
  { name: "타임리스 디에스이라에", type: "폴암", icon: "/api/icon/item/1442063" },
  { name: "리버스 디에스이라에", type: "폴암", icon: "/api/icon/item/1442067" },
  { name: "드래곤 핼버드", type: "폴암", icon: "/api/icon/item/1442045" },
  { name: "모글레이", type: "폴암", icon: "/api/icon/item/1442090" },
  { name: "제드버그", type: "폴암", icon: "/api/icon/item/1442044" },
  // 단검
  { name: "타임리스 페스카즈", type: "단검", icon: "/api/icon/item/1332073" },
  { name: "타임리스 킬릭", type: "단검", icon: "/api/icon/item/1332074" },
  { name: "리버스 페스카즈", type: "단검", icon: "/api/icon/item/1332075" },
  { name: "리버스 킬릭", type: "단검", icon: "/api/icon/item/1332076" },
  { name: "드래곤 칸자르", type: "단검", icon: "/api/icon/item/1332049" },
  { name: "드래곤 크리스", type: "단검", icon: "/api/icon/item/1332050" },
  // 아대 (카타라)
  { name: "타임리스 코션", type: "아대", icon: "/api/icon/item/1342011" },
  { name: "리버스 코션", type: "아대", icon: "/api/icon/item/1342012" },
  { name: "청월도", type: "아대", icon: "/api/icon/item/1342010" },
  { name: "용연도", type: "아대", icon: "/api/icon/item/1342009" },
  { name: "유성도", type: "아대", icon: "/api/icon/item/1342008" },
  // 클로
  { name: "타임리스 람피온", type: "클로", icon: "/api/icon/item/1472068" },
  { name: "리버스 람피온", type: "클로", icon: "/api/icon/item/1472071" },
  { name: "드래곤 그린 슬레브", type: "클로", icon: "/api/icon/item/1472051" },
  { name: "드래곤 퍼플 슬레브", type: "클로", icon: "/api/icon/item/1472052" },
  { name: "클립토", type: "클로", icon: "/api/icon/item/1472069" },
  { name: "레드 크리븐", type: "클로", icon: "/api/icon/item/1472053" },
  // 아대 (너클)
  { name: "용아주조", type: "아대", icon: "/api/icon/item/1482013" },
  { name: "크루시오", type: "아대", icon: "/api/icon/item/1482051" },
  { name: "킹 센트", type: "아대", icon: "/api/icon/item/1482012" },
  // 완드
  { name: "타임리스 엔릴 티어", type: "완드", icon: "/api/icon/item/1372044" },
  { name: "리버스 엔릴 티어", type: "완드", icon: "/api/icon/item/1372045" },
  { name: "드래곤 완드", type: "완드", icon: "/api/icon/item/1372032" },
  // 스태프
  { name: "타임리스 에아스 핸드", type: "스태프", icon: "/api/icon/item/1382057" },
  { name: "리버스 에아스 핸드", type: "스태프", icon: "/api/icon/item/1382059" },
  { name: "드래곤 스태프", type: "스태프", icon: "/api/icon/item/1382036" },
  { name: "레바테인", type: "스태프", icon: "/api/icon/item/1382058" },
  // 활
  { name: "타임리스 엔가우", type: "활", icon: "/api/icon/item/1452057" },
  { name: "리버스 엔가우", type: "활", icon: "/api/icon/item/1452059" },
  { name: "드래곤 샤인보우", type: "활", icon: "/api/icon/item/1452044" },
  { name: "바리사다", type: "활", icon: "/api/icon/item/1452058" },
  { name: "화이트 니스록", type: "활", icon: "/api/icon/item/1452019" },
  { name: "골든 니스록", type: "활", icon: "/api/icon/item/1452020" },
  // 석궁
  { name: "타임리스 블랙뷰티", type: "석궁", icon: "/api/icon/item/1462050" },
  { name: "리버스 블랙뷰티", type: "석궁", icon: "/api/icon/item/1462051" },
  { name: "드래곤 샤인크로스", type: "석궁", icon: "/api/icon/item/1462039" },
  { name: "인페르나", type: "석궁", icon: "/api/icon/item/1462076" },
  { name: "화이트 네쉐르", type: "석궁", icon: "/api/icon/item/1462015" },
  { name: "골든 네쉐르", type: "석궁", icon: "/api/icon/item/1462016" },
  // 총
  { name: "드래곤 세인트", type: "총", icon: "/api/icon/item/1492013" },
  { name: "템페스트", type: "총", icon: "/api/icon/item/1492024" },
  { name: "콘체르토", type: "총", icon: "/api/icon/item/1492012" },
  // 모자
  { name: "타임리스 휀넬", type: "모자", icon: "/api/icon/item/1002776" },
  { name: "타임리스 코럴", type: "모자", icon: "/api/icon/item/1002777" },
  { name: "타임리스 라피드", type: "모자", icon: "/api/icon/item/1002778" },
  { name: "타임리스 차이브", type: "모자", icon: "/api/icon/item/1002779" },
  { name: "리버스 휀넬", type: "모자", icon: "/api/icon/item/1002790" },
  { name: "리버스 코럴", type: "모자", icon: "/api/icon/item/1002791" },
  // 상의
  { name: "그린 네오스", type: "상의", icon: "/api/icon/item/1040120" },
  { name: "블루 네오스", type: "상의", icon: "/api/icon/item/1040121" },
  { name: "블랙 네오스", type: "상의", icon: "/api/icon/item/1040122" },
  { name: "그린 엘소르", type: "상의", icon: "/api/icon/item/1041122" },
  { name: "퍼플 엘소르", type: "상의", icon: "/api/icon/item/1041123" },
  { name: "다크 엘소르", type: "상의", icon: "/api/icon/item/1041124" },
  // 전신
  { name: "타임리스 타라곤", type: "전신", icon: "/api/icon/item/1052155" },
  { name: "타임리스 에버뉴", type: "전신", icon: "/api/icon/item/1052157" },
  { name: "타임리스 프린지드", type: "전신", icon: "/api/icon/item/1052158" },
  { name: "타임리스 부르군트", type: "전신", icon: "/api/icon/item/1052159" },
  { name: "리버스 타라곤", type: "전신", icon: "/api/icon/item/1052160" },
  { name: "리버스 에버뉴", type: "전신", icon: "/api/icon/item/1052162" },
  // 하의
  { name: "그린 네오스 바지", type: "하의", icon: "/api/icon/item/1060109" },
  { name: "블루 네오스 바지", type: "하의", icon: "/api/icon/item/1060110" },
  { name: "블랙 네오스 바지", type: "하의", icon: "/api/icon/item/1060111" },
  { name: "그린 엘소르 치마", type: "하의", icon: "/api/icon/item/1061121" },
  { name: "퍼플 엘소르 치마", type: "하의", icon: "/api/icon/item/1061122" },
  { name: "다크 엘소르 치마", type: "하의", icon: "/api/icon/item/1061123" },
  // 장갑
  { name: "타임리스 베르가못", type: "장갑", icon: "/api/icon/item/1082234" },
  { name: "타임리스 프레스토", type: "장갑", icon: "/api/icon/item/1082236" },
  { name: "타임리스 루바브", type: "장갑", icon: "/api/icon/item/1082237" },
  { name: "타임리스 차알스톤", type: "장갑", icon: "/api/icon/item/1082238" },
  { name: "리버스 베르가못", type: "장갑", icon: "/api/icon/item/1082239" },
  { name: "리버스 프레스토", type: "장갑", icon: "/api/icon/item/1082241" },
  // 신발
  { name: "타임리스 그라베", type: "신발", icon: "/api/icon/item/1072355" },
  { name: "타임리스 카바티나", type: "신발", icon: "/api/icon/item/1072356" },
  { name: "타임리스 론타노", type: "신발", icon: "/api/icon/item/1072357" },
  { name: "타임리스 문스티드", type: "신발", icon: "/api/icon/item/1072358" },
  { name: "타임리스 파라온", type: "신발", icon: "/api/icon/item/1072359" },
  { name: "리버스 그라베", type: "신발", icon: "/api/icon/item/1072361" },
  // 방패
  { name: "스킬 습득용 방패", type: "방패", icon: "/api/icon/item/1092041" },
  { name: "겔러해드 실드", type: "방패", icon: "/api/icon/item/1092042" },
  { name: "타임리스 프렐류드", type: "방패", icon: "/api/icon/item/1092057" },
  { name: "타임리스 카이트 실드", type: "방패", icon: "/api/icon/item/1092058" },
  { name: "타임리스 리스트", type: "방패", icon: "/api/icon/item/1092059" },
  { name: "블루 드래곤 실드", type: "방패", icon: "/api/icon/item/1092060" },
  // 망토
  { name: "타임리스 문라이트", type: "망토", icon: "/api/icon/item/1102172" },
  { name: "시리우스 망토", type: "망토", icon: "/api/icon/item/1102231" },
  { name: "루디브리엄 망토", type: "망토", icon: "/api/icon/item/1102057" },
];

// 주문서 스탯 데이터 (공격력/마력 기준)
export const SCROLL_STATS: {
  category: string;
  items: { name: string; stats: Record<number, string> }[];
}[] = [
  {
    category: "무기 공격력",
    items: [
      { name: "공격력 주문서", stats: { 100: "+1", 70: "+2", 60: "+2", 30: "+3", 10: "+5" } },
    ],
  },
  {
    category: "무기 마력",
    items: [
      { name: "마력 주문서", stats: { 100: "+1", 70: "+2", 60: "+2", 30: "+3", 10: "+5" } },
    ],
  },
  {
    category: "방어구 (상의/하의/전신)",
    items: [
      { name: "STR 주문서", stats: { 100: "+1", 70: "+2", 60: "+2", 30: "+3", 10: "+5" } },
      { name: "DEX 주문서", stats: { 100: "+1", 70: "+2", 60: "+2", 30: "+3", 10: "+5" } },
      { name: "INT 주문서", stats: { 100: "+1", 70: "+2", 60: "+2", 30: "+3", 10: "+5" } },
      { name: "LUK 주문서", stats: { 100: "+1", 70: "+2", 60: "+2", 30: "+3", 10: "+5" } },
      { name: "HP 주문서", stats: { 100: "+5", 70: "+10", 60: "+15", 30: "+20", 10: "+30" } },
    ],
  },
  {
    category: "장갑",
    items: [
      { name: "공격력 주문서", stats: { 100: "+0", 70: "+1", 60: "+2", 30: "+2", 10: "+3" } },
      { name: "마력 주문서", stats: { 100: "+0", 70: "+1", 60: "+2", 30: "+2", 10: "+3" } },
      { name: "DEX 주문서", stats: { 100: "+1", 70: "+2", 60: "+2", 30: "+3", 10: "+5" } },
    ],
  },
  {
    category: "모자",
    items: [
      { name: "STR 주문서", stats: { 100: "+1", 70: "+1", 60: "+2", 30: "+2", 10: "+3" } },
      { name: "DEX 주문서", stats: { 100: "+1", 70: "+1", 60: "+2", 30: "+2", 10: "+3" } },
      { name: "INT 주문서", stats: { 100: "+1", 70: "+1", 60: "+2", 30: "+2", 10: "+3" } },
      { name: "LUK 주문서", stats: { 100: "+1", 70: "+1", 60: "+2", 30: "+2", 10: "+3" } },
      { name: "HP 주문서", stats: { 100: "+5", 70: "+10", 60: "+15", 30: "+20", 10: "+30" } },
    ],
  },
  {
    category: "신발",
    items: [
      { name: "이동속도 주문서", stats: { 100: "+1", 70: "+1", 60: "+2", 30: "+2", 10: "+3" } },
      { name: "점프력 주문서", stats: { 100: "+1", 70: "+1", 60: "+2", 30: "+2", 10: "+3" } },
    ],
  },
  {
    category: "망토",
    items: [
      { name: "마법방어 주문서", stats: { 100: "+2", 70: "+3", 60: "+4", 30: "+5", 10: "+7" } },
      { name: "물리방어 주문서", stats: { 100: "+2", 70: "+3", 60: "+4", 30: "+5", 10: "+7" } },
    ],
  },
];

// ─── 확률 계산 유틸 ───
export function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  if (k > n - k) k = n - k;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}

export function binomialProb(n: number, k: number, p: number): number {
  return comb(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

// k번 이상 성공할 확률
export function binomialCDF(n: number, kMin: number, p: number): number {
  let sum = 0;
  for (let k = kMin; k <= n; k++) {
    sum += binomialProb(n, k, p);
  }
  return sum;
}

// 장비 카테고리별 사용 가능한 주문서 목록 반환
export function getScrollsForEquipment(equipmentType: string): string[] {
  if (!equipmentType) return [];
  // 무기
  const weapons = ["한손검","두손검","한손둔기","두손둔기","한손도끼","두손도끼","창","폴암","단검","아대","활","석궁","클로","총","완드","스태프"];
  if (weapons.includes(equipmentType)) {
    return SCROLL_STATS.filter(c => c.category.includes("무기")).flatMap(c => c.items.map(i => i.name));
  }
  if (equipmentType === "장갑") {
    return SCROLL_STATS.find(c => c.category === "장갑")?.items.map(i => i.name) ?? [];
  }
  if (equipmentType === "모자") {
    return SCROLL_STATS.find(c => c.category === "모자")?.items.map(i => i.name) ?? [];
  }
  if (equipmentType === "신발") {
    return SCROLL_STATS.find(c => c.category === "신발")?.items.map(i => i.name) ?? [];
  }
  if (equipmentType === "망토") {
    return SCROLL_STATS.find(c => c.category === "망토")?.items.map(i => i.name) ?? [];
  }
  // 방어구 (상의, 하의, 전신, 방패, 귀걸이 등)
  const armor = SCROLL_STATS.find(c => c.category.includes("방어구"));
  return armor?.items.map(i => i.name) ?? [];
}

// 주문서 이름 + % 로 스탯 증가량 숫자 반환
export function getStatGain(scrollName: string, pct: number, equipmentType: string): number {
  for (const cat of SCROLL_STATS) {
    for (const item of cat.items) {
      if (item.name === scrollName) {
        const raw = item.stats[pct as keyof typeof item.stats];
        if (raw) return parseInt(raw.replace("+", ""), 10);
      }
    }
  }
  return 0;
}

export type NamedItem = (typeof NAMED_ITEMS)[number];
