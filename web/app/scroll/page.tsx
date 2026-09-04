"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";

// ─── 주문서 데이터 ───
// icon: 확률 등급별 대표 주문서 아이템 ID (상의 힘 주문서 계열 — 등급별 테두리 색이 실제 %와 일치).
//        DB entity_names_en 검증값. 게임 내 주문서 테두리 색(회/파/노/…)이 % 등급을 그대로 나타낸다.
const SCROLL_TYPES = [
  { pct: 10, label: "10%", desc: "최고 능력치, 최저 확률", color: "red", icon: 2040419 },
  { pct: 30, label: "30%", desc: "높은 능력치, 낮은 확률", color: "purple", icon: 2040407 },
  { pct: 60, label: "60%", desc: "가장 가성비가 좋음", color: "orange", icon: 2040418 },
  { pct: 70, label: "70%", desc: "준수한 확률과 능력치", color: "blue", icon: 2040406 },
  { pct: 100, label: "100%", desc: "안전하지만 낮은 능력치", color: "green", icon: 2040417 },
] as const;

const SCROLL_SHORTCUTS: Record<number, string> = { 10: "Q", 30: "W", 60: "E", 70: "R", 100: "T" };

// 확률 → 대표 주문서 아이콘 (서버 아이콘 프록시 — CDN 변덕 차단)
const SCROLL_ICON_BY_PCT: Record<number, number> = Object.fromEntries(
  SCROLL_TYPES.map((s) => [s.pct, s.icon])
);
function scrollIconUrl(pct: number): string {
  const id = SCROLL_ICON_BY_PCT[pct] ?? SCROLL_ICON_BY_PCT[60];
  return `/api/icon/item/${id}`;
}

// 확률 등급별 테마 색 (Tailwind 클래스 — 슬롯/배지/버튼 공통)
const PCT_THEME: Record<number, { ring: string; text: string; bg: string; bar: string }> = {
  10: { ring: "border-red-400", text: "text-red-500", bg: "bg-red-500/10", bar: "bg-red-500" },
  30: { ring: "border-purple-400", text: "text-purple-500", bg: "bg-purple-500/10", bar: "bg-purple-500" },
  60: { ring: "border-orange-400", text: "text-orange-500", bg: "bg-orange-500/10", bar: "bg-orange-500" },
  70: { ring: "border-blue-400", text: "text-blue-500", bg: "bg-blue-500/10", bar: "bg-blue-500" },
  100: { ring: "border-green-400", text: "text-green-600", bg: "bg-green-500/10", bar: "bg-green-500" },
};
function pctTheme(pct: number) {
  return PCT_THEME[pct] ?? PCT_THEME[60];
}

// 이미지 로드 실패 시 조용히 숨김 (maplestory.io CDN 간헐 장애 대비)
function hideOnError(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.visibility = "hidden";
}

// 무기 종류별 업그레이드 횟수
const WEAPON_SLOTS: Record<string, number> = {
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
const NAMED_ITEMS: { name: string; type: string; icon: string }[] = [
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
const SCROLL_STATS: {
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
function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  if (k > n - k) k = n - k;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}

function binomialProb(n: number, k: number, p: number): number {
  return comb(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

// k번 이상 성공할 확률
function binomialCDF(n: number, kMin: number, p: number): number {
  let sum = 0;
  for (let k = kMin; k <= n; k++) {
    sum += binomialProb(n, k, p);
  }
  return sum;
}

// ─── 탭 타입 ───
type Tab = "calc" | "sim" | "ref" | "ranking";

// ─── 시뮬 결과 ───
interface SimSlot {
  status: "pending" | "success" | "fail";
  pct: number; // which scroll % was used
}

interface HistoryEntry {
  slots: SimSlot[];
  equipmentType: string;
  scrollType: string;
  totalSlots: number;
  successCount: number;
  statGain: number;
  statLabel: string;
}

// ─── 랭킹 엔트리 ───
interface RankingEntry {
  id: number;
  nickname: string;
  equipment_type: string;
  scroll_type: string;
  slot_count: number;
  success_count: number;
  total_stat_gain: string | null;
  scroll_detail: string | null;
  created_at: string;
}

export default function ScrollPage() {
  const [activeTab, setActiveTab] = useState<Tab>("calc");

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1 font-pixel">주문서 확률 계산기</h1>
      <p className="text-sm text-dim mb-6">
        주문서 성공 확률 계산, 시뮬레이션, 스탯 참고표, 랭킹
      </p>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 bg-surface2 p-1 w-fit">
        {([
          { key: "calc" as Tab, label: "확률 계산" },
          { key: "sim" as Tab, label: "시뮬레이션" },
          { key: "ref" as Tab, label: "주문서 스탯표" },
          { key: "ranking" as Tab, label: "랭킹" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm transition-colors ${
              activeTab === t.key
                ? "pixel-btn"
                : "font-pixel text-dim hover:text-maple"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "calc" && <CalcTab />}
      {activeTab === "sim" && <SimTab />}
      {activeTab === "ref" && <RefTab />}
      {activeTab === "ranking" && <RankingTab />}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  확률 계산 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function CalcTab() {
  const [slots, setSlots] = useState(7);
  const [scrollPct, setScrollPct] = useState(60);
  const [weaponType, setWeaponType] = useState("");

  const p = scrollPct / 100;

  // 무기 선택 시 슬롯 자동 설정
  const handleWeaponChange = (wt: string) => {
    setWeaponType(wt);
    if (wt && WEAPON_SLOTS[wt]) {
      setSlots(WEAPON_SLOTS[wt]);
    }
  };

  const rows = useMemo(() => {
    const result = [];
    for (let k = 0; k <= slots; k++) {
      const exact = binomialProb(slots, k, p);
      const atLeast = binomialCDF(slots, k, p);
      result.push({ k, exact, atLeast });
    }
    return result;
  }, [slots, p]);

  // 기대값
  const expected = slots * p;

  return (
    <div className="space-y-6">
      {/* 설정 */}
      <div className="pixel-panel p-5">
        <h2 className="font-bold text-lg mb-4 font-pixel">설정</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-dim mb-1">장비 종류</label>
            <select
              value={weaponType}
              onChange={(e) => handleWeaponChange(e.target.value)}
              className="w-full px-3 py-2 pixel-input text-sm"
            >
              <option value="">직접 입력</option>
              {Object.entries(WEAPON_SLOTS).map(([name, s]) => (
                <option key={name} value={name}>
                  {name} ({s}칸)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-dim mb-1">
              업그레이드 횟수 (슬롯)
            </label>
            <input
              type="number"
              min={1}
              max={15}
              value={slots}
              onChange={(e) => {
                setSlots(Math.max(1, Math.min(15, Number(e.target.value))));
                setWeaponType("");
              }}
              className="w-full px-3 py-2 pixel-input text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-dim mb-1">주문서 확률</label>
            <div className="flex gap-1.5 flex-wrap">
              {SCROLL_TYPES.map((s) => {
                const active = scrollPct === s.pct;
                const th = pctTheme(s.pct);
                return (
                  <button
                    key={s.pct}
                    onClick={() => setScrollPct(s.pct)}
                    className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 border-2 transition-colors ${
                      active ? `${th.ring} ${th.bg}` : "border-edge bg-surface2 hover:border-maple/60"
                    }`}
                  >
                    <img
                      src={scrollIconUrl(s.pct)}
                      alt=""
                      onError={hideOnError}
                      className="w-6 h-6 object-contain [image-rendering:pixelated]"
                    />
                    <span className={`font-pixel text-[11px] ${active ? th.text : "text-dim"}`}>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="업그레이드 횟수" value={`${slots}칸`} />
        <SummaryCard label="주문서 확률" value={`${scrollPct}%`} />
        <SummaryCard label="기대 성공 횟수" value={`${expected.toFixed(1)}회`} />
        <SummaryCard
          label="올작 확률"
          value={`${(binomialProb(slots, slots, p) * 100).toFixed(
            binomialProb(slots, slots, p) * 100 < 0.01 ? 4 : 2
          )}%`}
          highlight
        />
      </div>

      {/* 확률 테이블 */}
      <div className="pixel-panel overflow-hidden">
        <div className="px-5 py-3 border-b-2 border-edge">
          <h2 className="font-bold font-pixel">성공 횟수별 확률</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface2 text-dim">
                <th className="text-left px-5 py-2.5 font-medium">성공 횟수</th>
                <th className="text-right px-5 py-2.5 font-medium">정확히 N작 확률</th>
                <th className="text-right px-5 py-2.5 font-medium">N작 이상 확률</th>
                <th className="px-5 py-2.5 font-medium text-left">확률 바</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.k}
                  className={`border-t border-edge/40 ${
                    r.k === slots ? "bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)]" : ""
                  }`}
                >
                  <td className="px-5 py-2.5 font-medium">
                    {r.k}작{" "}
                    {r.k === slots && (
                      <span className="text-xs text-maple ml-1">올작</span>
                    )}
                    {r.k === 0 && (
                      <span className="text-xs text-red-400 ml-1">꽝</span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono">
                    {formatPct(r.exact)}
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono">
                    {formatPct(r.atLeast)}
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="h-4 bg-surface2 rounded-full overflow-hidden w-full max-w-[200px]">
                      <div
                        className={`h-full rounded-full transition-all ${
                          r.k === slots ? "bg-maple" : "bg-blue-400"
                        }`}
                        style={{ width: `${Math.max(r.exact * 100, 0.5)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-4 ${
        highlight
          ? "border-2 border-maple bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)]"
          : "pixel-panel"
      }`}
    >
      <p className="text-xs text-dim mb-1">{label}</p>
      <p
        className={`text-lg font-bold ${
          highlight ? "text-maple" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function formatPct(v: number): string {
  const pct = v * 100;
  if (pct === 0) return "0%";
  if (pct === 100) return "100%";
  if (pct < 0.01) return `${pct.toFixed(4)}%`;
  if (pct < 1) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(2)}%`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  시뮬레이션 탭 (통합 — 슬롯별 주문서 % 자유 선택)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 장비 카테고리별 사용 가능한 주문서 목록 반환
function getScrollsForEquipment(equipmentType: string): string[] {
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
function getStatGain(scrollName: string, pct: number, equipmentType: string): number {
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

// ─── 아이템 검색 컴포넌트 ───
type NamedItem = typeof NAMED_ITEMS[0];

function ItemSearch({ onSelect }: { onSelect: (item: NamedItem) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<NamedItem | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.length >= 1
    ? NAMED_ITEMS.filter((i) => i.name.includes(query) || i.type.includes(query)).slice(0, 10)
    : [];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-dim mb-1">
        아이템 검색 (선택 시 장비 종류 자동 적용)
      </label>
      <div className="flex items-center gap-2 pixel-input px-3 py-2">
        {selected && (
          <img
            src={selected.icon}
            alt={selected.name}
            className="w-7 h-7 object-contain shrink-0"
          />
        )}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="예: 타임리스, 드래곤, 엔가우..."
          className="flex-1 text-sm focus:outline-none bg-transparent"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setSelected(null); }}
            className="text-dim hover:text-maple text-base leading-none"
          >
            ×
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 pixel-panel max-h-60 overflow-y-auto">
          {filtered.map((item) => (
            <button
              key={item.name}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery(item.name);
                setSelected(item);
                setOpen(false);
                onSelect(item);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)] text-left transition-colors"
            >
              <img
                src={item.icon}
                alt={item.name}
                className="w-8 h-8 object-contain shrink-0"
              />
              <div>
                <p className="text-sm font-medium text-ink">{item.name}</p>
                <p className="text-xs text-dim">{item.type}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SimTab() {
  const [equipmentType, setEquipmentType] = useState("한손검");
  const [selectedItem, setSelectedItem] = useState<NamedItem | null>(null);
  const [scrollType, setScrollType] = useState("공격력 주문서");
  const [currentSlotPct, setCurrentSlotPct] = useState(60);
  const [simSlots, setSimSlots] = useState<SimSlot[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // 등록 모달
  const [showRegister, setShowRegister] = useState(false);
  const [registerNickname, setRegisterNickname] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerDone, setRegisterDone] = useState(false);

  const slots = WEAPON_SLOTS[equipmentType] ?? 7;
  const availableScrolls = useMemo(() => getScrollsForEquipment(equipmentType), [equipmentType]);

  // 장비 변경 시 주문서 기본값 업데이트
  useEffect(() => {
    if (availableScrolls.length > 0 && !availableScrolls.includes(scrollType)) {
      setScrollType(availableScrolls[0]);
    }
  }, [availableScrolls, scrollType]);

  // 초기화
  const reset = useCallback(() => {
    setSimSlots(Array.from({ length: slots }, () => ({ status: "pending" as const, pct: currentSlotPct })));
    setCurrentIdx(0);
    setRunning(true);
    setShowRegister(false);
    setRegisterDone(false);
  }, [slots, currentSlotPct]);

  // 장비/슬롯 변경 시 자동 초기화
  useEffect(() => {
    setSimSlots(Array.from({ length: slots }, () => ({ status: "pending" as const, pct: currentSlotPct })));
    setCurrentIdx(0);
    setRunning(true);
    setShowRegister(false);
    setRegisterDone(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentType, slots]);

  // 한 칸 주문서 바르기
  const rollOne = useCallback(() => {
    setSimSlots((prev) => {
      if (currentIdx >= prev.length) return prev;
      const next = [...prev];
      const success = Math.random() * 100 < currentSlotPct;
      next[currentIdx] = { status: success ? "success" : "fail", pct: currentSlotPct };
      return next;
    });
    setCurrentIdx((prev) => {
      const nextIdx = prev + 1;
      if (nextIdx >= slots) {
        setSimSlots((final) => {
          const successCount = final.filter((s) => s.status === "success").length;
          const statGain = final.reduce((acc, s) => {
            if (s.status === "success") {
              return acc + getStatGain(scrollType, s.pct, equipmentType);
            }
            return acc;
          }, 0);
          setHistory((h) => [
            {
              slots: final,
              equipmentType,
              scrollType,
              totalSlots: slots,
              successCount,
              statGain,
              statLabel: scrollType,
            },
            ...h,
          ]);
          return final;
        });
        setRunning(false);
      }
      return nextIdx;
    });
  }, [currentIdx, currentSlotPct, slots, scrollType, equipmentType]);

  // 키보드: Space=바르기, F=리셋, 1=100%, 7=70%, 6=60%, 3=30%, 0=10%
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (running) rollOne();
        else reset();
      }
      if (e.code === "KeyF") {
        e.preventDefault();
        reset();
      }
      // 주문서 확률 단축키
      const pctMap: Record<string, number> = {
        "KeyQ": 10, "KeyW": 30, "KeyE": 60, "KeyR": 70, "KeyT": 100,
      };
      if (pctMap[e.code] && running) {
        e.preventDefault();
        setCurrentSlotPct(pctMap[e.code]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [running, rollOne, reset]);

  const successes = simSlots.filter((s) => s.status === "success").length;
  const fails = simSlots.filter((s) => s.status === "fail").length;
  const done = !running && currentIdx > 0;

  // 완료된 시뮬의 총 스탯 증가량
  const totalStatGain = done
    ? simSlots.reduce((acc, s) => {
        if (s.status === "success") return acc + getStatGain(scrollType, s.pct, equipmentType);
        return acc;
      }, 0)
    : 0;

  // 등록
  const handleRegister = async () => {
    if (!registerNickname.trim()) return;
    setRegisterLoading(true);
    try {
      const scrollDetail = JSON.stringify(
        simSlots.map((s) => ({ pct: s.pct, status: s.status }))
      );
      await fetch("/api/scroll-rankings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: registerNickname.trim(),
          equipment_type: equipmentType,
          scroll_type: scrollType,
          slot_count: slots,
          success_count: successes,
          total_stat_gain: totalStatGain > 0 ? `+${totalStatGain}` : "0",
          scroll_detail: scrollDetail,
        }),
      });
      setRegisterDone(true);
    } catch {
      // silent fail
    } finally {
      setRegisterLoading(false);
    }
  };

  // 히스토리 통계
  const histAvg =
    history.length > 0
      ? history.reduce((a, b) => a + b.successCount, 0) / history.length
      : 0;

  return (
    <div className="space-y-6">
      {/* 설정 */}
      <div className="pixel-panel p-5">
        <h2 className="font-bold text-lg mb-4 font-pixel">설정</h2>
        <div className="mb-4">
          <ItemSearch onSelect={(item) => { setEquipmentType(item.type); setSelectedItem(item); }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-dim mb-1">장비 종류</label>
            <select
              value={equipmentType}
              onChange={(e) => { setEquipmentType(e.target.value); setSelectedItem(null); }}
              className="w-full px-3 py-2 pixel-input text-sm"
            >
              {Object.entries(WEAPON_SLOTS).map(([name, s]) => (
                <option key={name} value={name}>
                  {name} ({s}칸)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-dim mb-1">주문서 종류</label>
            <select
              value={scrollType}
              onChange={(e) => setScrollType(e.target.value)}
              className="w-full px-3 py-2 pixel-input text-sm"
            >
              {availableScrolls.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 슬롯 시각화 */}
      <div className="pixel-panel p-6">
        {/* 대상 장비 히어로 */}
        <div className="flex items-center gap-4 mb-5 pb-4 border-b-2 border-edge/60">
          <div className="w-16 h-16 flex items-center justify-center border-2 border-edge bg-surface2 shrink-0">
            {selectedItem ? (
              <img
                src={selectedItem.icon}
                alt={selectedItem.name}
                onError={hideOnError}
                className="w-12 h-12 object-contain [image-rendering:pixelated]"
              />
            ) : (
              <span className="text-2xl opacity-60" aria-hidden>🗡️</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-pixel text-base text-ink truncate">
              {selectedItem ? selectedItem.name : `${equipmentType}`}
            </p>
            <p className="text-xs text-dim mt-0.5">
              {equipmentType} · 업그레이드 {slots}칸 · <span className="text-ink">{scrollType}</span>
            </p>
          </div>
          {/* 성공/실패/남음 카운터 */}
          <div className="flex items-center gap-2 text-sm shrink-0">
            <span className="flex flex-col items-center px-2">
              <span className="text-green-600 font-bold text-lg leading-none">{successes}</span>
              <span className="text-[10px] text-dim">성공</span>
            </span>
            <span className="flex flex-col items-center px-2">
              <span className="text-red-500 font-bold text-lg leading-none">{fails}</span>
              <span className="text-[10px] text-dim">실패</span>
            </span>
            <span className="flex flex-col items-center px-2">
              <span className="text-dim font-bold text-lg leading-none">{slots - successes - fails}</span>
              <span className="text-[10px] text-dim">남음</span>
            </span>
          </div>
        </div>

        {/* 상태 제목 */}
        <p className="text-center font-pixel text-sm mb-4">
          {done
            ? successes === slots
              ? <span className="text-maple">🎉 축하합니다! 올작 성공!</span>
              : <span className="text-ink">{successes}작 완료</span>
            : <span className="text-dim">주문서를 발라 강화하세요</span>}
        </p>

        {/* 슬롯 그리드 — 각 칸에 주문서 아이콘 */}
        <div className="flex gap-2 flex-wrap justify-center mb-5">
          {simSlots.map((slot, i) => {
            const isCurrent = i === currentIdx && running;
            const th = pctTheme(slot.status !== "pending" ? slot.pct : currentSlotPct);
            return (
              <div
                key={i}
                className={`relative w-16 h-16 flex flex-col items-center justify-center border-2 transition-all duration-300 ${
                  slot.status === "success"
                    ? "border-green-400 bg-green-500/10 scale-105 shadow-[0_0_10px_rgba(74,222,128,0.35)]"
                    : slot.status === "fail"
                    ? "border-red-300 bg-red-500/10"
                    : isCurrent
                    ? `${th.ring} bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)] animate-pulse`
                    : "border-edge bg-surface2"
                }`}
              >
                {slot.status === "success" ? (
                  <>
                    <img src={scrollIconUrl(slot.pct)} alt="" onError={hideOnError} className="w-8 h-8 object-contain [image-rendering:pixelated]" />
                    <span className="absolute -top-1.5 -right-1.5 text-green-500 text-sm bg-surface rounded-full leading-none">✔</span>
                  </>
                ) : slot.status === "fail" ? (
                  <span className="text-red-500 text-2xl leading-none">✕</span>
                ) : isCurrent ? (
                  <img src={scrollIconUrl(currentSlotPct)} alt="" onError={hideOnError} className="w-8 h-8 object-contain [image-rendering:pixelated] opacity-70" />
                ) : (
                  <span className="text-dim text-lg opacity-50">·</span>
                )}
                <span className={`text-[10px] leading-none mt-0.5 font-pixel ${
                  slot.status === "success" ? "text-green-600" : slot.status === "fail" ? "text-red-400" : isCurrent ? th.text : "text-dim opacity-50"
                }`}>
                  {slot.status !== "pending" ? `${slot.pct}%` : isCurrent ? `${currentSlotPct}%` : `${i + 1}`}
                </span>
              </div>
            );
          })}
        </div>

        {/* 현재 슬롯 주문서 % 선택 — 실제 주문서 이미지 */}
        {running && (
          <div className="mb-5">
            <p className="text-xs text-dim mb-2 text-center">
              슬롯 <span className="text-maple font-bold">{currentIdx + 1}</span> / {slots} — 바를 주문서 선택
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              {SCROLL_TYPES.map((s) => {
                const active = currentSlotPct === s.pct;
                const th = pctTheme(s.pct);
                return (
                  <button
                    key={s.pct}
                    onClick={() => setCurrentSlotPct(s.pct)}
                    className={`flex flex-col items-center gap-0.5 px-3 py-2 border-2 transition-colors ${
                      active ? `${th.ring} ${th.bg}` : "border-edge bg-surface2 hover:border-maple/60"
                    }`}
                  >
                    <img src={scrollIconUrl(s.pct)} alt="" onError={hideOnError} className="w-7 h-7 object-contain [image-rendering:pixelated]" />
                    <span className={`font-pixel text-[11px] ${active ? th.text : "text-dim"}`}>{s.label}</span>
                    <span className="text-[9px] text-dim opacity-60">[{SCROLL_SHORTCUTS[s.pct]}]</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 결과 메시지 */}
        {done && (
          <div
            className={`text-center py-3 rounded-lg mb-4 text-sm font-medium ${
              successes === slots
                ? "bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] text-maple"
                : successes >= Math.ceil(slots * 0.7)
                ? "bg-green-100 text-green-700"
                : successes >= Math.ceil(slots * 0.4)
                ? "bg-blue-100 text-blue-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {slots}칸 중 {successes}작 성공
            {totalStatGain > 0 && (
              <span className="ml-2 font-bold">
                · {scrollType} +{totalStatGain} 획득
              </span>
            )}
          </div>
        )}

        {/* 버튼 */}
        <div className="flex gap-3 justify-center flex-wrap">
          {running ? (
            <button
              onClick={rollOne}
              className="px-6 py-2.5 pixel-btn text-sm transition-colors"
            >
              바르기 (Space)
            </button>
          ) : (
            <button
              onClick={reset}
              className="px-6 py-2.5 pixel-btn text-sm transition-colors"
            >
              다시하기 (Space)
            </button>
          )}
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-surface2 border-2 border-edge text-dim font-pixel text-sm hover:text-maple transition-colors"
          >
            초기화 (F)
          </button>
          {done && !registerDone && (
            <button
              onClick={() => setShowRegister(true)}
              className="px-6 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
            >
              결과 등록
            </button>
          )}
          {registerDone && (
            <span className="px-4 py-2.5 text-sm text-green-600 font-medium">등록 완료!</span>
          )}
        </div>

        {/* 키보드 안내 */}
        <p className="text-center text-xs text-dim mt-3">
          Space: 바르기 / F: 초기화 / Q·W·E·R·T: 주문서 선택 (10%·30%·60%·70%·100%)
        </p>
      </div>

      {/* 결과 등록 모달 */}
      {showRegister && !registerDone && (
        <div className="pixel-panel p-5">
          <h3 className="font-bold mb-3 font-pixel">랭킹에 결과 등록</h3>
          <div className="space-y-3 mb-4 text-sm text-dim">
            <div className="flex gap-4 flex-wrap">
              <span>장비: <strong>{equipmentType}</strong></span>
              <span>주문서: <strong>{scrollType}</strong></span>
              <span>결과: <strong>{successes}/{slots}작</strong></span>
              {totalStatGain > 0 && (
                <span>스탯: <strong>+{totalStatGain}</strong></span>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="닉네임 입력"
              value={registerNickname}
              onChange={(e) => setRegisterNickname(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleRegister(); }}
              className="flex-1 px-3 py-2 pixel-input text-sm"
              maxLength={20}
            />
            <button
              onClick={handleRegister}
              disabled={registerLoading || !registerNickname.trim()}
              className="px-4 py-2 pixel-btn text-sm transition-colors disabled:opacity-50"
            >
              {registerLoading ? "등록중..." : "등록"}
            </button>
            <button
              onClick={() => setShowRegister(false)}
              className="px-4 py-2 bg-surface2 border-2 border-edge text-dim font-pixel text-sm hover:text-maple transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 시뮬 히스토리 */}
      {history.length > 0 && (
        <div className="pixel-panel p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold font-pixel">시뮬레이션 기록</h2>
            <button
              onClick={() => setHistory([])}
              className="text-xs text-dim hover:text-maple"
            >
              기록 초기화
            </button>
          </div>
          <div className="flex gap-2 flex-wrap mb-3">
            {history.map((h, i) => (
              <div
                key={i}
                className={`inline-flex flex-col items-center justify-center px-2 py-1 rounded-lg text-xs font-bold min-w-[2.5rem] ${
                  h.successCount === h.totalSlots
                    ? "bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] text-maple"
                    : h.successCount >= Math.ceil(h.totalSlots * 0.7)
                    ? "bg-green-100 text-green-600"
                    : h.successCount >= Math.ceil(h.totalSlots * 0.4)
                    ? "bg-blue-100 text-blue-600"
                    : "bg-red-100 text-red-600"
                }`}
              >
                <span>{h.successCount}작</span>
                {h.statGain > 0 && (
                  <span className="font-normal opacity-75">+{h.statGain}</span>
                )}
              </div>
            ))}
          </div>
          <div className="text-sm text-dim">
            총 {history.length}회 · 평균{" "}
            <span className="font-bold text-ink">{histAvg.toFixed(1)}작</span> ·
            올작{" "}
            <span className="font-bold text-maple">
              {history.filter((h) => h.successCount === h.totalSlots).length}회
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  주문서 스탯 참고표 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function RefTab() {
  return (
    <div className="space-y-6">
      <div className="pixel-panel p-5">
        <h2 className="font-bold text-lg mb-1 font-pixel">주문서 확률별 설명</h2>
        <p className="text-sm text-dim mb-4">
          각 확률별 주문서의 특성을 비교해보세요
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SCROLL_TYPES.map((s) => {
            const th = pctTheme(s.pct);
            return (
              <div key={s.pct} className={`p-4 border-2 flex items-center gap-3 ${th.ring} ${th.bg}`}>
                <img
                  src={scrollIconUrl(s.pct)}
                  alt=""
                  onError={hideOnError}
                  className="w-10 h-10 object-contain [image-rendering:pixelated] shrink-0"
                />
                <div>
                  <p className={`text-xl font-bold mb-0.5 ${th.text}`}>{s.label}</p>
                  <p className="text-sm text-dim">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 장비별 업그레이드 횟수 */}
      <div className="pixel-panel overflow-hidden">
        <div className="px-5 py-3 border-b-2 border-edge">
          <h2 className="font-bold">장비별 업그레이드 횟수</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface2 text-dim">
                <th className="text-left px-5 py-2.5 font-medium">장비</th>
                <th className="text-right px-5 py-2.5 font-medium">업그레이드 횟수</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(WEAPON_SLOTS).map(([name, s]) => (
                <tr key={name} className="border-t border-edge/40">
                  <td className="px-5 py-2">{name}</td>
                  <td className="px-5 py-2 text-right font-mono">{s}칸</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 주문서 스탯표 */}
      {SCROLL_STATS.map((cat) => (
        <div
          key={cat.category}
          className="pixel-panel overflow-hidden"
        >
          <div className="px-5 py-3 border-b-2 border-edge">
            <h2 className="font-bold">{cat.category}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface2 text-dim">
                  <th className="text-left px-5 py-2.5 font-medium">주문서</th>
                  {SCROLL_TYPES.map((s) => (
                    <th key={s.pct} className="px-3 py-2.5 font-medium">
                      <span className="flex flex-col items-center gap-0.5">
                        <img src={scrollIconUrl(s.pct)} alt="" onError={hideOnError} className="w-5 h-5 object-contain [image-rendering:pixelated]" />
                        {s.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cat.items.map((item) => (
                  <tr key={item.name} className="border-t border-edge/40">
                    <td className="px-5 py-2 font-medium">{item.name}</td>
                    {SCROLL_TYPES.map((s) => (
                      <td key={s.pct} className="text-center px-3 py-2 font-mono">
                        {item.stats[s.pct] || "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  랭킹 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function RankingTab() {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterEquipment, setFilterEquipment] = useState("");
  const equipmentOptions = ["", ...Object.keys(WEAPON_SLOTS)];

  const fetchRankings = useCallback(async (equipment: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ per_page: "50", page: "1" });
      if (equipment) params.set("equipment_type", equipment);
      const res = await fetch(`/api/scroll-rankings?${params}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setRankings(data.rankings ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setRankings([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRankings(filterEquipment);
  }, [filterEquipment, fetchRankings]);

  const formatDate = (dt: string) => {
    try {
      return new Date(dt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
    } catch {
      return dt.slice(0, 10);
    }
  };

  return (
    <div className="space-y-6">
      {/* 필터 */}
      <div className="pixel-panel p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-dim mb-1">장비 종류 필터</label>
            <select
              value={filterEquipment}
              onChange={(e) => setFilterEquipment(e.target.value)}
              className="px-3 py-2 pixel-input text-sm"
            >
              <option value="">전체</option>
              {Object.keys(WEAPON_SLOTS).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => fetchRankings(filterEquipment)}
            className="mt-5 px-4 py-2 bg-surface2 border-2 border-edge text-dim font-pixel text-sm hover:text-maple transition-colors"
          >
            새로고침
          </button>
          <span className="mt-5 text-sm text-dim">총 {total}건</span>
        </div>
      </div>

      {/* 랭킹 테이블 */}
      <div className="pixel-panel overflow-hidden">
        <div className="px-5 py-3 border-b-2 border-edge">
          <h2 className="font-bold font-pixel">시뮬레이션 랭킹</h2>
          <p className="text-xs text-dim mt-0.5">성공 횟수 기준 내림차순</p>
        </div>
        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-dim">불러오는 중...</div>
        ) : rankings.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-dim">
            아직 등록된 랭킹이 없습니다. 시뮬레이션 후 결과를 등록해보세요!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface2 text-dim">
                  <th className="text-center px-3 py-2.5 font-medium w-12">순위</th>
                  <th className="text-left px-4 py-2.5 font-medium">닉네임</th>
                  <th className="text-left px-4 py-2.5 font-medium">장비</th>
                  <th className="text-left px-4 py-2.5 font-medium">주문서</th>
                  <th className="text-center px-4 py-2.5 font-medium">결과</th>
                  <th className="text-center px-4 py-2.5 font-medium">스탯</th>
                  <th className="text-center px-4 py-2.5 font-medium">날짜</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((r, idx) => {
                  const isAllSuccess = r.success_count === r.slot_count;
                  return (
                    <tr
                      key={r.id}
                      className={`border-t border-edge/40 ${isAllSuccess ? "bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)]" : ""}`}
                    >
                      <td className="px-3 py-2.5 text-center font-bold">
                        {idx + 1 === 1 ? (
                          <span className="text-yellow-500">1</span>
                        ) : idx + 1 === 2 ? (
                          <span className="text-gray-400">2</span>
                        ) : idx + 1 === 3 ? (
                          <span className="text-orange-400">3</span>
                        ) : (
                          <span className="text-dim">{idx + 1}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-medium">{r.nickname}</td>
                      <td className="px-4 py-2.5 text-dim">{r.equipment_type}</td>
                      <td className="px-4 py-2.5 text-dim">{r.scroll_type}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md font-bold text-xs ${
                            isAllSuccess
                              ? "bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] text-maple"
                              : r.success_count >= Math.ceil(r.slot_count * 0.7)
                              ? "bg-green-100 text-green-600"
                              : r.success_count >= Math.ceil(r.slot_count * 0.4)
                              ? "bg-blue-100 text-blue-600"
                              : "bg-red-100 text-red-500"
                          }`}
                        >
                          {r.success_count}/{r.slot_count}작
                          {isAllSuccess && " 올작"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono text-ink">
                        {r.total_stat_gain ?? "-"}
                      </td>
                      <td className="px-4 py-2.5 text-center text-dim text-xs">
                        {formatDate(r.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
