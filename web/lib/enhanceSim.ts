// 아이템 강화 시뮬레이터 모델 — 메이커 제작(보석·편차) · 주문서 강화 · 성장(레벨업).
// 순수 함수 모음으로, /maker 의 ItemEnhanceSimulator 가 소비하고 tests 에서 검증한다.
//
// 수치 출처(전부 커뮤니티 실측 가정 — 공식 공개값 아님):
// - 편차 폭/확률: 테스피아 실측 (maplelog 역설계) — N=min(floor(base/10)+1,5), 이항 기반 분포
// - 촉진제: 편차 하옵 차단(-N~+N → 0~+N), 대가 10% 파괴
// - 보석/크리스탈 수치: arca.live/b/mapleland/171913450 (테스피아 v2.2.30) 상급 기준
// - 성장 실측표: maplestory.pe.kr/1161 (빅뱅 이전 = 메랜 세대)

export type StatKey =
  | "incPAD" | "incMAD" | "incSTR" | "incDEX" | "incINT" | "incLUK"
  | "incMHP" | "incMMP" | "incPDD" | "incMDD" | "incACC" | "incEVA"
  | "incSpeed" | "incJump";

export type Stats = Partial<Record<StatKey, number>>;

export const STAT_LABEL: Record<string, string> = {
  incPAD: "공격력", incMAD: "마력", incSTR: "STR", incDEX: "DEX", incINT: "INT", incLUK: "LUK",
  incMHP: "HP", incMMP: "MP", incPDD: "물리방어", incMDD: "마법방어", incACC: "명중", incEVA: "회피",
  incSpeed: "이동속도", incJump: "점프력",
};

// 표기 우선순위 — 공격/마력 최우선, 방어·이동 계열은 뒤로
const STAT_ORDER: StatKey[] = [
  "incPAD", "incMAD", "incSTR", "incDEX", "incINT", "incLUK",
  "incMHP", "incMMP", "incPDD", "incMDD", "incACC", "incEVA", "incSpeed", "incJump",
];

export function orderedStatEntries(stats: Stats): [StatKey, number][] {
  return STAT_ORDER.filter((k) => (stats[k] ?? 0) !== 0).map((k) => [k, stats[k] as number]);
}

// items.subcategory(영문) → 한글 장비 종류
export const SUBCAT_KIND: Record<string, string> = {
  "One-Handed Sword": "한손검", "Two-Handed Sword": "두손검",
  "One-Handed Axe": "한손도끼", "Two-Handed Axe": "두손도끼",
  "One-Handed Blunt Weapon": "한손둔기", "Two-Handed Blunt": "두손둔기",
  "Spear": "창", "Pole Arm": "폴암", "Dagger": "단검", "Katara": "아대",
  "Claw": "클로", "Knuckle": "너클", "Gun": "건", "Bow": "활", "Crossbow": "석궁",
  "Wand": "완드", "Staff": "스태프",
  "Hat": "모자", "Overall": "전신", "Top": "상의", "Bottom": "하의",
  "Glove": "장갑", "Shoes": "신발", "Shield": "방패", "Cape": "망토",
  "Earrings": "귀걸이", "Face Accessory": "얼굴장식", "Eye Decoration": "눈장식",
};

const WEAPON_KINDS = new Set([
  "한손검", "두손검", "한손도끼", "두손도끼", "한손둔기", "두손둔기", "창", "폴암",
  "단검", "아대", "클로", "너클", "건", "활", "석궁", "완드", "스태프",
]);
export function isWeaponKind(kind: string): boolean {
  return WEAPON_KINDS.has(kind);
}

// ── 보석·크리스탈 (상급 기준) ──────────────────────────────
export interface Gem {
  itemId: number;
  name: string;
  stat: StatKey;
  amount: number; // 상급 수치
  weaponOnly?: boolean;
}
export const GEMS: Gem[] = [
  { itemId: 4021007, name: "다이아몬드", stat: "incPAD", amount: 3, weaponOnly: true },
  { itemId: 4021005, name: "사파이어", stat: "incMAD", amount: 3, weaponOnly: true },
  { itemId: 4005000, name: "힘의 크리스탈", stat: "incSTR", amount: 5 },
  { itemId: 4005002, name: "민첩성의 크리스탈", stat: "incDEX", amount: 5 },
  { itemId: 4005001, name: "지혜의 크리스탈", stat: "incINT", amount: 5 },
  { itemId: 4005003, name: "행운의 크리스탈", stat: "incLUK", amount: 5 },
  { itemId: 4021000, name: "가넷", stat: "incACC", amount: 5 },
  { itemId: 4021004, name: "오팔", stat: "incEVA", amount: 5 },
  { itemId: 4021001, name: "자수정", stat: "incSpeed", amount: 5 },
  { itemId: 4021002, name: "아쿠아마린", stat: "incJump", amount: 3 },
  { itemId: 4021006, name: "토파즈", stat: "incMHP", amount: 30 },
  { itemId: 4021003, name: "에메랄드", stat: "incMMP", amount: 30 },
];
export function gemsForKind(kind: string): Gem[] {
  const weapon = isWeaponKind(kind);
  return GEMS.filter((g) => (weapon ? true : !g.weaponOnly));
}
export function gemIconUrl(itemId: number): string {
  return `https://maplestory.io/api/gms/92/item/${itemId}/icon`;
}

// ── 편차(옵션) ────────────────────────────────────────────
// 편차 폭 N = min(floor(base/10)+1, 5)  (base>0)
export function optRange(base: number): number {
  const k = Number(base) || 0;
  return k <= 0 ? 0 : Math.min(Math.floor(k / 10) + 1, 5);
}
// 편차 롤: 동전 N+2개 → 앞면 수 ones, n=max(0,ones-2), 방향 ±. 촉진제 시 음수(하옵)는 0.
export function rollDeviation(base: number, accel: boolean, rnd: () => number = Math.random): number {
  const N = optRange(base);
  if (!N) return 0;
  let ones = 0;
  for (let i = 0; i < N + 2; i++) if (rnd() < 0.5) ones++;
  const n = Math.max(0, ones - 2);
  if (n === 0) return 0;
  let d = rnd() < 0.5 ? n : -n;
  if (accel && d < 0) d = 0;
  return d;
}
// 편차 스탯 대상 — 편차가 붙는 능력치(방어/이동/점프 제외)
const DEVIATION_STATS = new Set<StatKey>([
  "incPAD", "incMAD", "incSTR", "incDEX", "incINT", "incLUK", "incMHP", "incMMP", "incPDD", "incMDD",
]);
export function deviationStats(base: Stats): StatKey[] {
  return (Object.keys(base) as StatKey[]).filter((k) => DEVIATION_STATS.has(k) && (base[k] ?? 0) > 0);
}

// ── 주문서 ────────────────────────────────────────────────
export interface ScrollSeries {
  id: string;
  name: string;
  stat: StatKey;
  byPct: Record<number, number>; // % → 성공 시 증가량
}
const WEAPON_ATK: Record<number, number> = { 10: 5, 60: 2, 100: 1 };
const WEAPON_MAG: Record<number, number> = { 10: 5, 60: 2, 100: 1 };
const ARMOR_STAT: Record<number, number> = { 10: 3, 60: 2, 100: 1 };
const ARMOR_HP: Record<number, number> = { 10: 30, 60: 15, 100: 5 };
const ARMOR_MOVE: Record<number, number> = { 10: 3, 60: 2, 100: 1 };
const ARMOR_DEF: Record<number, number> = { 10: 7, 60: 4, 100: 2 };

export function scrollSeriesFor(kind: string): ScrollSeries[] {
  if (kind === "완드" || kind === "스태프") {
    return [
      { id: "mag", name: `${kind} 마력 주문서`, stat: "incMAD", byPct: WEAPON_MAG },
      { id: "atk", name: `${kind} 공격력 주문서`, stat: "incPAD", byPct: WEAPON_ATK },
    ];
  }
  if (isWeaponKind(kind)) {
    return [{ id: "atk", name: `${kind} 공격력 주문서`, stat: "incPAD", byPct: WEAPON_ATK }];
  }
  // 방어구
  if (kind === "신발") {
    return [
      { id: "spd", name: "신발 이동속도 주문서", stat: "incSpeed", byPct: ARMOR_MOVE },
      { id: "jmp", name: "신발 점프력 주문서", stat: "incJump", byPct: ARMOR_MOVE },
    ];
  }
  if (kind === "망토") {
    return [
      { id: "pdd", name: "망토 물리방어 주문서", stat: "incPDD", byPct: ARMOR_DEF },
      { id: "mdd", name: "망토 마법방어 주문서", stat: "incMDD", byPct: ARMOR_DEF },
    ];
  }
  if (kind === "장갑") {
    return [
      { id: "atk", name: "장갑 공격력 주문서", stat: "incPAD", byPct: ARMOR_STAT },
      { id: "mag", name: "장갑 마력 주문서", stat: "incMAD", byPct: ARMOR_STAT },
      { id: "dex", name: "장갑 DEX 주문서", stat: "incDEX", byPct: ARMOR_STAT },
    ];
  }
  // 모자·상의·하의·전신·방패 — 주스탯 + HP
  return [
    { id: "str", name: `${kind} STR 주문서`, stat: "incSTR", byPct: ARMOR_STAT },
    { id: "dex", name: `${kind} DEX 주문서`, stat: "incDEX", byPct: ARMOR_STAT },
    { id: "int", name: `${kind} INT 주문서`, stat: "incINT", byPct: ARMOR_STAT },
    { id: "luk", name: `${kind} LUK 주문서`, stat: "incLUK", byPct: ARMOR_STAT },
    { id: "hp", name: `${kind} HP 주문서`, stat: "incMHP", byPct: ARMOR_HP },
  ];
}

// % → 대표 주문서 아이콘 (상의 힘 주문서 계열, 등급 색이 실제 %와 일치)
const SCROLL_PCT_ICON: Record<number, number> = { 10: 2040419, 30: 2040407, 60: 2040418, 70: 2040406, 100: 2040417 };
export function scrollIconUrl(pct: number): string {
  return `https://maplestory.io/api/gms/92/item/${SCROLL_PCT_ICON[pct] ?? SCROLL_PCT_ICON[60]}/icon`;
}
export function rollScroll(pct: number, rnd: () => number = Math.random): boolean {
  return rnd() * 100 < pct;
}

// ── 성장(레벨업) 실측표 ────────────────────────────────────
// 각 항목 [stat, min, max] — 레벨업 1회당 각 stat 을 [min,max] 정수 롤로 가산
type GrowEntry = [StatKey, number, number];
const GROW_W_STR: GrowEntry[] = [["incPAD", 0, 2], ["incSTR", 1, 2], ["incDEX", 0, 1]];
const GROW_W_DEX: GrowEntry[] = [["incPAD", 0, 2], ["incDEX", 1, 2], ["incSTR", 0, 1]];
const GROW_W_INT: GrowEntry[] = [["incMAD", 1, 4], ["incINT", 1, 2], ["incLUK", 0, 1]];
const GROW_W_LUK: GrowEntry[] = [["incPAD", 0, 2], ["incLUK", 1, 2], ["incDEX", 0, 1]];
const GROW_W_DAG_STR: GrowEntry[] = [["incPAD", 0, 2], ["incLUK", 1, 2], ["incSTR", 0, 1]];

const GROW_WEAPON: Record<string, GrowEntry[]> = {
  한손검: GROW_W_STR, 두손검: GROW_W_STR, 한손도끼: GROW_W_STR, 두손도끼: GROW_W_STR,
  한손둔기: GROW_W_STR, 두손둔기: GROW_W_STR, 창: GROW_W_STR, 폴암: GROW_W_STR, 너클: GROW_W_STR,
  활: GROW_W_DEX, 석궁: GROW_W_DEX, 건: GROW_W_DEX,
  완드: GROW_W_INT, 스태프: GROW_W_INT,
  아대: GROW_W_LUK, 단검: GROW_W_LUK,
};

const GROW_ARMOR: Record<string, Record<string, GrowEntry[]>> = {
  전사: {
    모자: [["incSTR", 0, 1], ["incDEX", 0, 1], ["incMHP", 10, 20]],
    전신: [["incSTR", 0, 1], ["incDEX", 0, 1], ["incEVA", 1, 2]],
    상의: [["incSTR", 0, 1], ["incDEX", 0, 1], ["incEVA", 1, 2]],
    장갑: [["incSTR", 0, 1], ["incDEX", 0, 1], ["incACC", 1, 2]],
    신발: [["incSTR", 0, 1], ["incDEX", 0, 1], ["incSpeed", 0, 1], ["incJump", 0, 1]],
    방패: [["incPDD", 5, 10], ["incSTR", 0, 1], ["incDEX", 0, 1]],
  },
  마법사: {
    모자: [["incINT", 0, 1], ["incLUK", 0, 1], ["incMHP", 5, 10], ["incMMP", 5, 10]],
    전신: [["incINT", 0, 1], ["incLUK", 0, 1], ["incEVA", 1, 2]],
    상의: [["incINT", 0, 1], ["incLUK", 0, 1], ["incEVA", 1, 2]],
    장갑: [["incMAD", 0, 1], ["incINT", 0, 1], ["incLUK", 0, 1]],
    신발: [["incINT", 0, 1], ["incLUK", 0, 1], ["incSpeed", 0, 1], ["incJump", 0, 1]],
    방패: [["incPDD", 5, 10], ["incMDD", 5, 10], ["incINT", 0, 1], ["incLUK", 0, 1]],
  },
  궁수: {
    모자: [["incSTR", 0, 1], ["incDEX", 0, 1], ["incMHP", 20, 30]],
    전신: [["incSTR", 0, 1], ["incDEX", 0, 1], ["incEVA", 1, 3]],
    상의: [["incSTR", 0, 1], ["incDEX", 0, 1], ["incEVA", 1, 3]],
    장갑: [["incSTR", 0, 1], ["incDEX", 0, 1], ["incMHP", 5, 10]],
    신발: [["incSTR", 0, 1], ["incDEX", 0, 1], ["incSpeed", 0, 1], ["incJump", 0, 1]],
  },
  도적: {
    모자: [["incSTR", 0, 1], ["incDEX", 0, 1], ["incLUK", 0, 1], ["incMHP", 20, 30]],
    전신: [["incSTR", 0, 1], ["incDEX", 0, 1], ["incLUK", 0, 1], ["incEVA", 1, 3]],
    상의: [["incSTR", 0, 1], ["incDEX", 0, 1], ["incLUK", 0, 1], ["incEVA", 1, 3]],
    장갑: [["incSTR", 0, 1], ["incDEX", 0, 1], ["incLUK", 0, 1], ["incMHP", 5, 10]],
    신발: [["incSTR", 0, 1], ["incDEX", 0, 1], ["incLUK", 0, 1], ["incSpeed", 0, 1], ["incJump", 0, 1]],
    방패: [["incPDD", 5, 10], ["incSTR", 0, 1], ["incDEX", 0, 1], ["incLUK", 1, 1]],
  },
  해적: {
    모자: [["incSTR", 0, 1], ["incDEX", 0, 1], ["incMHP", 10, 20]],
    전신: [["incSTR", 0, 1], ["incDEX", 0, 1], ["incEVA", 1, 3]],
    상의: [["incSTR", 0, 1], ["incDEX", 0, 1], ["incEVA", 1, 3]],
    장갑: [["incSTR", 0, 1], ["incDEX", 0, 1], ["incMHP", 5, 10]],
    신발: [["incSTR", 0, 1], ["incDEX", 0, 1], ["incSpeed", 0, 1], ["incJump", 0, 1]],
  },
};

// 직업명(job_req 문자열) → 성장표 직업 계열
function jobFamily(jobReq: string | undefined): string | null {
  const j = jobReq || "";
  if (j.includes("전사")) return "전사";
  if (j.includes("마법")) return "마법사";
  if (j.includes("궁수")) return "궁수";
  if (j.includes("도적")) return "도적";
  if (j.includes("해적")) return "해적";
  return null;
}

// 단검 힘단검(페스카즈 등, 전사 착용) 분기
export function growTableFor(kind: string, jobReq: string | undefined): GrowEntry[] | null {
  if (isWeaponKind(kind)) {
    if (kind === "단검" && (jobReq || "").includes("전사")) return GROW_W_DAG_STR;
    return GROW_WEAPON[kind] ?? null;
  }
  const fam = jobFamily(jobReq);
  if (!fam) return null;
  return GROW_ARMOR[fam]?.[kind] ?? null;
}

export function rollGrowth(table: GrowEntry[], rnd: () => number = Math.random): Stats {
  const add: Stats = {};
  for (const [k, lo, hi] of table) {
    const v = lo + Math.floor(rnd() * (hi - lo + 1));
    if (v) add[k] = (add[k] ?? 0) + v;
  }
  return add;
}

export const MAX_GROW_LEVEL = 3; // 리버스·타임리스 = 레벨업 3회로 MAX
export const EXP_PER_LEVEL = 70; // "0/70" — 사냥 더미 경험치 요구량
export function huntExp(rnd: () => number = Math.random): number {
  return 12 + Math.floor(rnd() * 17); // 12~28 더미
}

// ── 합산 ──────────────────────────────────────────────────
export function mergeStats(...parts: Stats[]): Stats {
  const out: Stats = {};
  for (const p of parts) {
    for (const k of Object.keys(p) as StatKey[]) {
      const v = p[k] ?? 0;
      if (v) out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

export function isGrowthItemName(nameKr: string): boolean {
  return /^(리버스|타임리스)\s/.test(nameKr.trim());
}
