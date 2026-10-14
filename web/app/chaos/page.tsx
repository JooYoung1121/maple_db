"use client";

/* 혼줌 시뮬레이터 — 혼돈의 주문서 60% (메랜 10/8 패치 신규)
 *
 * 수치 근거:
 * - 혼돈의 주문서(2049100): 10/8 공식 패치노트로 등장 확정 (maple.land/board/notices/h0ifyesthgb4e79hecngkcgh)
 *   메랜은 악세서리에만 사용 가능 — 커뮤니티 확인 기준 (원작 GMS는 전 장비)
 * - 허리띠 기본 스탯: 흰~빨간색은 DB items 1132000~1132003 (maplestory.io GMS v92 원본)과 동일,
 *   검은색 허리띠(1132004)는 메랜 전용 수치 — 올스탯 +3 · 공격력 +1 · 마력 +4 · 물/마방 +50 · 회피 +15
 *   (원작은 올스탯 +5, 공/마 없음. canonDiffs "dojo.black-belt" 참조)
 *   무릉도장 필요 점수(140/1,300/2,800/6,400/12,000)는 10/8 공지 확정값
 * - 성공률 60%·변동폭 ±5는 원작 통용값, 변동폭 내 가중치는 공식 미공개 —
 *   기본 균등 가정이며 화면에서 조정 가능 (리버스 기대값 시뮬과 같은 방침)
 *
 * 화면 구성(v4.15.0): 공용 시뮬 키트(components/sim/SimKit) — 왼쪽 아이템 카드 · ① 주문서 강화(카드형 버튼+무대)
 * · ② 사용 내역(개수×단가, 거래소 시세 자동 단가) · 기록 로그(단축키 A/Space 바르기, F/R 새 악세서리, V 전체 리셋, M 사운드)
 * · URL ?item=black|1132004 로 대상 공유. 기대값·분포·일괄 작은 아래 '기대값 분석'으로 이동.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getItem, getItems } from "@/lib/api";
import type { Item } from "@/lib/types";
import { entityIconUrl } from "@/lib/icons";
import { useMarketPrices } from "@/lib/useMarketPrice";
import {
  SimActionCard, SimItemCard, SimLedger, SimLog, SimToolbar, formatMeso,
  useSimHotkeys, useSimLog, useSimSound, type SimStatLine,
} from "@/components/sim/SimKit";
import PageGuide from "@/components/PageGuide";
import { PAGE_GUIDES } from "@/lib/pageGuides";
import ChaosStage, { type StageRoll } from "./ChaosStage";

type LineKey =
  | "STR" | "DEX" | "INT" | "LUK"
  | "HP" | "MP" | "공격력" | "마력"
  | "물리방어" | "마법방어" | "명중" | "회피"
  | "이동속도" | "점프";

const LINE_KEYS: LineKey[] = [
  "STR", "DEX", "INT", "LUK", "HP", "MP", "공격력", "마력", "물리방어", "마법방어", "명중", "회피", "이동속도", "점프",
];
const MAIN_STATS: LineKey[] = ["STR", "DEX", "INT", "LUK"];
const GAIN_KEYS: LineKey[] = [...MAIN_STATS, "공격력", "마력"]; // 연출 이름 색 단계 기준

/* DB items.stats(JSON 키) → 시뮬 옵션 줄 매핑 */
const STAT_TO_LINE: Record<string, LineKey> = {
  incSTR: "STR", incDEX: "DEX", incINT: "INT", incLUK: "LUK",
  incMHP: "HP", incMMP: "MP", incPAD: "공격력", incMAD: "마력",
  incPDD: "물리방어", incMDD: "마법방어", incACC: "명중", incEVA: "회피",
  incSpeed: "이동속도", incJump: "점프",
};

const SUBCAT_KR: Record<string, string> = {
  Belt: "허리띠", "Face Accessory": "얼굴장식", "Eye Decoration": "눈장식",
  Earrings: "귀고리", Pendant: "펜던트", Ring: "반지", Medal: "훈장", "Shoulder Accessory": "어깨장식",
};

function linesFromStats(statsJson: string | null | undefined): Lines {
  const lines: Lines = {};
  if (!statsJson) return lines;
  try {
    const stats = JSON.parse(statsJson) as Record<string, number>;
    for (const [key, value] of Object.entries(stats)) {
      const line = STAT_TO_LINE[key];
      if (line && typeof value === "number" && value > 0) lines[line] = (lines[line] ?? 0) + value;
    }
  } catch { /* 손상된 stats JSON은 빈 줄로 */ }
  return lines;
}

type Lines = Partial<Record<LineKey, number>>;

interface TargetItem {
  id: string;
  name: string;
  itemId: number | null; // 아이콘 프록시용 (커스텀은 null)
  lines: Lines;
  slots: number;
  note: string;
  reqLevel?: number; // 상세 API가 레퍼런스 밖 아이템(무릉 허리띠)에 404를 주므로 카드용 REQ 레벨을 직접 둔다 (DB level_req)
}

/* 무릉도장 허리띠 5종 — 스탯: 흰~빨강 DB items(GMS v92), 검은띠 메랜 실측 · 필요 점수: 10/8 공지 */
const BELTS: TargetItem[] = [
  { id: "white", name: "흰색 허리띠", itemId: 1132000, lines: { STR: 1, DEX: 1, INT: 1, LUK: 1, 물리방어: 10, 마법방어: 10, 회피: 3 }, slots: 3, note: "무릉 140점", reqLevel: 25 },
  { id: "yellow", name: "노란색 허리띠", itemId: 1132001, lines: { STR: 2, DEX: 2, INT: 2, LUK: 2, 물리방어: 20, 마법방어: 20, 회피: 6 }, slots: 3, note: "무릉 1,300점", reqLevel: 35 },
  { id: "blue", name: "파란색 허리띠", itemId: 1132002, lines: { STR: 3, DEX: 3, INT: 3, LUK: 3, 물리방어: 30, 마법방어: 30, 회피: 9 }, slots: 3, note: "무릉 2,800점", reqLevel: 45 },
  { id: "red", name: "빨간색 허리띠", itemId: 1132003, lines: { STR: 4, DEX: 4, INT: 4, LUK: 4, 물리방어: 40, 마법방어: 40, 회피: 12 }, slots: 3, note: "무릉 6,400점", reqLevel: 60 },
  { id: "black", name: "검은색 허리띠", itemId: 1132004, lines: { STR: 3, DEX: 3, INT: 3, LUK: 3, 공격력: 1, 마력: 4, 물리방어: 50, 마법방어: 50, 회피: 15 }, slots: 3, note: "무릉 12,000점 ★기대값 최고", reqLevel: 75 },
];

/* DB(GMS 원본) 수치가 메랜과 다른 아이템 — 전체 선택기에서 골라도 메랜 수치로 덮어쓴다 */
const MAPLELAND_LINE_OVERRIDES: Record<number, Lines> = Object.fromEntries(
  BELTS.filter((b) => b.id === "black" && b.itemId !== null).map((b) => [b.itemId as number, b.lines]),
);

const CHAOS_SCROLL_ITEM_ID = 2049100;
const CHAOS_SCROLL_NAME = "혼돈의 주문서 60%";
const DEFAULT_SUCCESS = 60; // %
const DEFAULT_DELTA_WEIGHTS = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]; // -5 ~ +5 균등 가정
const MC_TRIALS = 40000;
const HOTKEY_LEGEND = "A/Space 바르기 · F/R 새 악세서리 · V 전체 리셋 · M 사운드";

function iconUrl(itemId: number): string {
  return entityIconUrl("item", itemId);
}

function normalized(values: number[]): number[] {
  const safe = values.map((v) => Math.max(0, Number.isFinite(v) ? v : 0));
  const total = safe.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return safe.map((_, i) => (i === 5 ? 1 : 0)); // 전부 0이면 ±0 고정
  return safe.map((v) => v / total);
}

/* 한 스탯 줄의 정확 분포 — 매 장: 실패(1-p)면 그대로, 성공(p)이면 -5~+5 변동.
 * 0 밑으로는 못 내려가고, '0줄 소멸' 가정이 켜져 있으면 0이 된 줄은 이후 변동 없음 */
function lineDistribution(
  base: number, scrolls: number, successRate: number, weights: number[], lineVanish: boolean,
): Map<number, number> {
  let dist = new Map<number, number>([[base, 1]]);
  const w = normalized(weights);
  for (let i = 0; i < scrolls; i++) {
    const next = new Map<number, number>();
    const add = (v: number, p: number) => next.set(v, (next.get(v) ?? 0) + p);
    for (const [v, p] of dist) {
      if (lineVanish && v === 0 && base > 0) { add(0, p); continue; }
      add(v, p * (1 - successRate));
      for (let d = -5; d <= 5; d++) add(Math.max(0, v + d), p * successRate * w[d + 5]);
    }
    dist = next;
  }
  return dist;
}

function rollDelta(weights: number[]): number {
  const w = normalized(weights);
  const roll = Math.random();
  let acc = 0;
  for (let i = 0; i < w.length; i++) {
    acc += w[i];
    if (roll < acc) return i - 5;
  }
  return 5;
}

/* 혼줌 1장 적용 — 성공 시 존재하는 모든 줄이 함께 굴려진다 (성공 판정은 장당 1회 공유) */
function applyChaos(
  lines: Lines, successRate: number, weights: number[], lineVanish: boolean, baseLines: Lines,
): { lines: Lines; success: boolean; deltas: Partial<Record<LineKey, number>> } {
  if (Math.random() >= successRate) return { lines, success: false, deltas: {} };
  const next: Lines = { ...lines };
  const deltas: Partial<Record<LineKey, number>> = {};
  for (const key of LINE_KEYS) {
    const v = lines[key] ?? 0;
    if ((baseLines[key] ?? 0) <= 0) continue; // 원래 없던 줄엔 안 붙음
    if (lineVanish && v === 0) continue; // 0으로 소멸한 줄
    const d = rollDelta(weights);
    next[key] = Math.max(0, v + d);
    deltas[key] = d;
  }
  return { lines: next, success: true, deltas };
}

/* 허리띠 1개에 혼줌을 끝까지(업횟만큼) 바르는 풀 시도 */
function simulateAttempt(item: TargetItem, successRate: number, weights: number[], lineVanish: boolean): Lines {
  let lines: Lines = { ...item.lines };
  for (let i = 0; i < item.slots; i++) {
    lines = applyChaos(lines, successRate, weights, lineVanish, item.lines).lines;
  }
  return lines;
}

function percent(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "-";
  if (value > 0 && value < 0.0001) return "0.01% 미만";
  return `${(value * 100).toFixed(digits)}%`;
}

function number(value: number, digits = 2): string {
  return value.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

function deltaText(deltas: Partial<Record<LineKey, number>>): string {
  return LINE_KEYS.filter((k) => deltas[k] !== undefined)
    .map((k) => `${k} ${deltas[k]! >= 0 ? "+" : ""}${deltas[k]}`)
    .join(", ");
}

interface ManualState {
  lines: Lines;
  used: number;
  history: boolean[]; // 장별 성공 여부 (업횟 게이지 표시)
}

/* 트(완작 1회) 기록 — 직접 발라보기에서 업횟을 다 쓸 때마다 쌓인다 */
interface AttemptRecord {
  n: number;
  lines: Lines;
  successes: number;
}

interface BatchState {
  attempts: number;
  reached: number;
  bestFocus: number | null;
  recent: { focus: number; anyMain: number }[];
}

const EMPTY_BATCH: BatchState = { attempts: 0, reached: 0, bestFocus: null, recent: [] };

/* 사용 내역 — 전체 리셋(V) 전까지 누적 */
interface Usage { items: number; scrolls: number }
const EMPTY_USAGE: Usage = { items: 0, scrolls: 0 };

function replaceItemParam(value: string | null) {
  try {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("item", value); else url.searchParams.delete("item");
    window.history.replaceState(null, "", url.toString());
  } catch { /* ignore */ }
}

export default function ChaosSimPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-dim">로딩 중...</div>}>
      <ChaosSim />
    </Suspense>
  );
}

function ChaosSim() {
  const searchParams = useSearchParams();
  const [itemId, setItemId] = useState("black");
  const [customLines, setCustomLines] = useState<Lines>({ STR: 0, DEX: 0, INT: 0, LUK: 0 });
  const [customSlots, setCustomSlots] = useState(3);
  const [dbItem, setDbItem] = useState<TargetItem | null>(null); // 전체 악세서리에서 고른 아이템

  // 전체 악세서리 목록 (메랜 노출 아이템, DB items) — 업횟 있고 혼줌이 굴릴 옵션이 있는 것만
  const [accessories, setAccessories] = useState<Item[]>([]);
  const [accLoading, setAccLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSubcat, setPickerSubcat] = useState<string>("전체");
  const [pickerQuery, setPickerQuery] = useState("");

  // 아이템 카드용 DB 정보 (REQ 레벨·직업·분류) — itemId 별 1회 조회
  const [itemMeta, setItemMeta] = useState<Record<number, Item | null>>({});

  const log = useSimLog();
  const sound = useSimSound();

  useEffect(() => {
    if (!pickerOpen || accessories.length > 0 || accLoading) return;
    setAccLoading(true);
    Promise.all([
      getItems({ category: "Accessory", per_page: 100, page: 1 }),
      getItems({ category: "Accessory", per_page: 100, page: 2 }),
    ])
      .then(([a, b]) => {
        const all = [...a.items, ...(b?.items ?? [])];
        // 귀고리는 메랜에서 혼줌 사용 불가(인게임 실측) → 대상에서 제외
        const usable = all.filter(
          (it) =>
            it.subcategory !== "Earrings" &&
            (it.upgrade_slots ?? 0) > 0 &&
            Object.keys(linesFromStats(it.stats)).length > 0,
        );
        usable.sort((x, y) => (x.subcategory ?? "").localeCompare(y.subcategory ?? "") || (x.level_req - y.level_req) || x.id - y.id);
        setAccessories(usable);
      })
      .catch(() => setAccessories([]))
      .finally(() => setAccLoading(false));
  }, [pickerOpen, accessories.length, accLoading]);

  const item: TargetItem = useMemo(() => {
    if (itemId === "custom") {
      return { id: "custom", name: "커스텀 악세서리", itemId: null, lines: customLines, slots: customSlots, note: "직접 입력" };
    }
    if (itemId === "db" && dbItem) return dbItem;
    return BELTS.find((b) => b.id === itemId) ?? BELTS[4];
  }, [itemId, customLines, customSlots, dbItem]);

  // 아이템 카드 메타 조회
  useEffect(() => {
    const id = item.itemId;
    if (id === null || itemMeta[id] !== undefined) return;
    let cancelled = false;
    getItem(id)
      .then((d) => { if (!cancelled) setItemMeta((prev) => ({ ...prev, [id]: d.item })); })
      .catch(() => { if (!cancelled) setItemMeta((prev) => ({ ...prev, [id]: null })); });
    return () => { cancelled = true; };
  }, [item.itemId, itemMeta]);

  const [focusStat, setFocusStat] = useState<LineKey>("STR");
  const [target, setTarget] = useState(10);
  const [successPct, setSuccessPct] = useState(DEFAULT_SUCCESS);
  const [deltaWeights, setDeltaWeights] = useState([...DEFAULT_DELTA_WEIGHTS]);
  const [lineVanish, setLineVanish] = useState(true);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(true);

  // 사용 내역 단가 (메소) — 거래소 시세가 있으면 자동 채움, 없으면 직접 입력
  const [scrollUnit, setScrollUnit] = useState<number | null>(null);
  const [itemUnit, setItemUnit] = useState<number | null>(null);
  const [usage, setUsage] = useState<Usage>(EMPTY_USAGE);
  const market = useMarketPrices([CHAOS_SCROLL_NAME, item.name]);
  const scrollMarket = market[CHAOS_SCROLL_NAME] ?? null;
  const itemMarket = market[item.name] ?? null;
  const autoFilled = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (scrollMarket && scrollUnit === null && !autoFilled.current[CHAOS_SCROLL_NAME]) {
      autoFilled.current[CHAOS_SCROLL_NAME] = true;
      setScrollUnit(scrollMarket.price);
    }
  }, [scrollMarket, scrollUnit]);
  useEffect(() => {
    if (itemMarket && itemUnit === null && !autoFilled.current[item.name]) {
      autoFilled.current[item.name] = true;
      setItemUnit(itemMarket.price);
    }
  }, [itemMarket, itemUnit, item.name]);

  const [manual, setManual] = useState<ManualState | null>(null);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [batch, setBatch] = useState<BatchState>(EMPTY_BATCH);

  const successRate = Math.min(100, Math.max(0, successPct)) / 100;
  const focusBase = item.lines[focusStat] ?? 0;

  /* 선택 스탯의 정확 분포 */
  const distribution = useMemo(
    () => [...lineDistribution(focusBase, item.slots, successRate, deltaWeights, lineVanish)].sort((a, b) => a[0] - b[0]),
    [focusBase, item.slots, successRate, deltaWeights, lineVanish],
  );

  const attemptCost = (itemUnit ?? 0) + item.slots * (scrollUnit ?? 0); // 메소

  const metrics = useMemo(() => {
    const expected = distribution.reduce((sum, [v, p]) => sum + v * p, 0);
    const variance = distribution.reduce((sum, [v, p]) => sum + (v - expected) ** 2 * p, 0);
    const targetP = distribution.filter(([v]) => v >= target).reduce((sum, [, p]) => sum + p, 0);
    return {
      expected,
      deviation: Math.sqrt(variance),
      targetP,
      expectedAttempts: targetP > 0 ? 1 / targetP : Infinity,
      expectedCost: targetP > 0 ? attemptCost / targetP : Infinity,
    };
  }, [distribution, target, attemptCost]);

  /* 주스탯 4줄 합산·'아무 주스탯이나 목표 이상' — 성공 판정이 줄끼리 공유돼 독립이 아니므로 몬테카를로 */
  const mcMetrics = useMemo(() => {
    const mains = MAIN_STATS.filter((k) => (item.lines[k] ?? 0) > 0);
    if (mains.length === 0) return null;
    let anyHit = 0;
    let sumTotal = 0;
    for (let i = 0; i < MC_TRIALS; i++) {
      const result = simulateAttempt(item, successRate, deltaWeights, lineVanish);
      let total = 0;
      let any = false;
      for (const k of mains) {
        const v = result[k] ?? 0;
        total += v;
        if (v >= target) any = true;
      }
      sumTotal += total;
      if (any) anyHit += 1;
    }
    return { anyP: anyHit / MC_TRIALS, expectedMainTotal: sumTotal / MC_TRIALS, mainCount: mains.length };
  }, [item, successRate, deltaWeights, lineVanish, target]);

  const activeLines = useMemo(
    () => LINE_KEYS.filter((k) => (item.lines[k] ?? 0) > 0),
    [item],
  );

  const resetRun = useCallback(() => {
    setManual(null);
    setAttempts([]);
    setBatch(EMPTY_BATCH);
    setUsage(EMPTY_USAGE);
  }, []);

  const switchItem = useCallback((id: string, opts?: { silent?: boolean }) => {
    setItemId(id);
    resetRun();
    if (id !== "custom") {
      const belt = BELTS.find((b) => b.id === id);
      if (belt && (belt.lines[focusStat] ?? 0) === 0) setFocusStat("STR");
      if (belt && !opts?.silent) log.push(`대상 변경 → ${belt.name} (업횟 ${belt.slots})`, "info");
    } else if (!opts?.silent) {
      log.push("대상 변경 → 커스텀 악세서리 (옵션 직접 입력)", "info");
    }
    replaceItemParam(id === "custom" ? null : id);
  }, [focusStat, log, resetRun]);

  const pickDbItem = useCallback((it: Item, opts?: { silent?: boolean }) => {
    const lines = MAPLELAND_LINE_OVERRIDES[it.id] ?? linesFromStats(it.stats);
    const next: TargetItem = {
      id: "db",
      name: it.name_kr || it.name,
      itemId: it.id,
      lines,
      slots: Math.max(1, it.upgrade_slots ?? 1),
      note: `${SUBCAT_KR[it.subcategory ?? ""] ?? it.subcategory ?? "악세서리"} · 업횟 ${it.upgrade_slots}`,
      reqLevel: it.level_req,
    };
    setDbItem(next);
    setItemId("db");
    setItemMeta((prev) => (prev[it.id] === undefined ? { ...prev, [it.id]: it } : prev));
    resetRun();
    if ((lines[focusStat] ?? 0) === 0) {
      const first = LINE_KEYS.find((k) => (lines[k] ?? 0) > 0);
      if (first) setFocusStat(first);
    }
    if (!opts?.silent) log.push(`대상 변경 → ${next.name} (업횟 ${next.slots})`, "info");
    replaceItemParam(String(it.id));
  }, [focusStat, log, resetRun]);

  // URL ?item= 초기 적용 (허리띠 id 또는 DB 아이템 번호)
  const urlApplied = useRef(false);
  useEffect(() => {
    if (urlApplied.current) return;
    urlApplied.current = true;
    const raw = searchParams.get("item");
    if (!raw) return;
    if (BELTS.some((b) => b.id === raw)) { if (raw !== "black") switchItem(raw, { silent: true }); return; }
    if (/^\d+$/.test(raw)) {
      const belt = BELTS.find((b) => b.itemId === Number(raw));
      if (belt) { switchItem(belt.id, { silent: true }); return; }
      getItem(Number(raw)).then((d) => { if (d?.item) pickDbItem(d.item, { silent: true }); }).catch(() => { /* 없는 아이템은 무시 */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickerItems = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase().replace(/\s+/g, "");
    return accessories.filter((it) => {
      if (pickerSubcat !== "전체" && it.subcategory !== pickerSubcat) return false;
      if (!q) return true;
      const hay = `${it.name_kr ?? ""}${it.name}`.toLowerCase().replace(/\s+/g, "");
      return hay.includes(q);
    });
  }, [accessories, pickerSubcat, pickerQuery]);

  const pickerSubcats = useMemo(
    () => ["전체", ...Array.from(new Set(accessories.map((it) => it.subcategory ?? ""))).filter(Boolean)],
    [accessories],
  );

  /* ── 직접 발라보기 ── */
  const manualLines = manual?.lines ?? item.lines;
  const manualUsed = manual?.used ?? 0;
  const manualDone = manualUsed >= item.slots;
  const currentTry = attempts.length + (manualDone ? 0 : 1);

  const applyManual = (): StageRoll | null => {
    if (manualDone) return null;
    const current = manual ?? { lines: { ...item.lines }, used: 0, history: [] };
    const { lines, success, deltas } = applyChaos(current.lines, successRate, deltaWeights, lineVanish, item.lines);
    const used = current.used + 1;
    const history = [...current.history, success];
    setManual({ lines, used, history });
    setUsage((u) => ({ items: u.items + (current.used === 0 ? 1 : 0), scrolls: u.scrolls + 1 }));
    const prefix = `${currentTry}트 ${used}/${item.slots}장`;
    if (success) {
      log.push(`${prefix} 성공 · ${deltaText(deltas)}`, "ok");
      sound.play("success");
    } else {
      log.push(`${prefix} 실패 — 변동 없이 업횟만 소모`, "fail");
      sound.play("fail");
    }
    if (used >= item.slots) {
      const successes = history.filter(Boolean).length;
      setAttempts((prev) => [...prev, { n: prev.length + 1, lines, successes }]);
      const focus = lines[focusStat] ?? 0;
      const summary = activeLines.map((k) => `${k} ${lines[k] ?? 0}`).join(" · ");
      const hit = focus >= target;
      log.push(`${currentTry}트 완료 — ${successes}/${item.slots}작 · ${summary}${hit ? ` ★ ${focusStat} ${target}+ 달성` : ""}`, hit ? "best" : "warn");
      if (hit) sound.play("fanfare");
    }
    return { success, deltas };
  };

  const newAccessory = useCallback(() => {
    if (manual && manual.used > 0 && manual.used < item.slots) log.push(`${attempts.length + 1}트 중단 (${manual.used}/${item.slots}장) — 새 악세서리`, "info");
    setManual(null);
  }, [manual, attempts.length, item.slots, log]);

  const resetAll = useCallback(() => {
    resetRun();
    log.clear();
    log.push("전체 리셋 — 사용 내역·시도 기록 초기화", "info");
  }, [log, resetRun]);

  useSimHotkeys({
    KeyV: resetAll,
    KeyM: sound.toggle,
  });

  const runBatch = (count: number) => {
    let reached = 0;
    let best: number | null = batch.bestFocus;
    const recent: { focus: number; anyMain: number }[] = [];
    for (let i = 0; i < count; i++) {
      const result = simulateAttempt(item, successRate, deltaWeights, lineVanish);
      const focus = result[focusStat] ?? 0;
      const anyMain = Math.max(...MAIN_STATS.map((k) => result[k] ?? 0), 0);
      if (focus >= target) reached += 1;
      best = best === null ? focus : Math.max(best, focus);
      recent.push({ focus, anyMain });
    }
    setBatch((prev) => ({
      attempts: prev.attempts + count,
      reached: prev.reached + reached,
      bestFocus: best,
      recent: [...prev.recent, ...recent].slice(-30),
    }));
    log.push(`일괄 작 ${count.toLocaleString()}개 — ${focusStat} ${target}+ ${reached}개 (${percent(reached / count, 1)}) · 최고 ${best}`, "info");
  };

  /* 트 기록 요약 — 최고는 선택 스탯 값, 같으면 주스탯·공/마 합 변화량 */
  const attemptSummary = useMemo(() => {
    if (attempts.length === 0) return null;
    const gainOf = (a: AttemptRecord) => GAIN_KEYS.reduce((sum, k) => sum + ((a.lines[k] ?? 0) - (item.lines[k] ?? 0)), 0);
    const best = attempts.reduce((b, a) => {
      const av = a.lines[focusStat] ?? 0;
      const bv = b.lines[focusStat] ?? 0;
      return av > bv || (av === bv && gainOf(a) > gainOf(b)) ? a : b;
    }, attempts[0]);
    const hits = attempts.filter((a) => (a.lines[focusStat] ?? 0) >= target).length;
    return { total: attempts.length, hits, best };
  }, [attempts, focusStat, target, item]);

  const maxProbability = Math.max(...distribution.map(([, p]) => p), 1e-9);
  const normalizedWeights = normalized(deltaWeights);

  const meta = item.itemId !== null ? itemMeta[item.itemId] : null;
  const cardStats: SimStatLine[] = activeLines.map((k) => ({ label: k, base: item.lines[k] ?? 0, current: manualLines[k] ?? 0 }));
  const stageIcon = item.itemId !== null ? iconUrl(item.itemId) : null;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <SimToolbar
        backHref="/scroll-sim"
        backLabel="주문서 시뮬"
        title={<span>🌀 혼줌 시뮬레이터 <span className="text-dim text-sm font-normal">— {item.name}</span></span>}
        right={
          <>
            {PAGE_GUIDES["/chaos"] && <PageGuide guide={PAGE_GUIDES["/chaos"]} />}
            <button type="button" onClick={() => setShowAssumptions((v) => !v)} className="pixel-card px-3 py-1.5 font-pixel text-xs text-dim hover:text-maple">
              {showAssumptions ? "확률 설정 닫기" : "확률 가정"}
            </button>
          </>
        }
      />
      <p className="text-sm text-dim">
        10/8 패치로 추가된 <b className="text-ink">혼돈의 주문서 60%</b>는 성공 시 장비에 <b className="text-ink">이미 붙어 있는 모든 옵션을 각각 -5 ~ +5</b> 범위로
        다시 굴립니다. 메이플랜드에서는 <b className="text-maple">악세서리에만</b> 사용할 수 있어 올스탯 3 + 공격력 1·마력 4로 시작하는{" "}
        <b className="text-maple">검은색 허리띠</b>(무릉도장 12,000점)가 기대값이 가장 좋은 대상으로 꼽힙니다.
      </p>

      {/* ── 대상 선택 ── */}
      <div className="pixel-panel p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {[...BELTS.map((b) => ({ id: b.id, name: b.name, itemId: b.itemId as number | null, note: b.note })), { id: "custom", name: "직접 입력", itemId: null, note: "커스텀" }].map((entry) => {
            const active = itemId === entry.id;
            return (
              <button key={entry.id} type="button" onClick={() => switchItem(entry.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 border-2 text-xs transition-colors ${active ? "border-maple bg-[color-mix(in_srgb,var(--c-maple)_12%,transparent)] text-maple font-pixel" : "bg-surface2 border-edge text-dim hover:border-maple/60"}`}>
                {entry.itemId && (
                  <img src={iconUrl(entry.itemId)} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }}
                    className="w-6 h-6 object-contain [image-rendering:pixelated]" />
                )}
                <span>{entry.name} <span className="opacity-60">{entry.note}</span></span>
              </button>
            );
          })}
          <button type="button" onClick={() => setPickerOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 border-2 text-xs transition-colors ${itemId === "db" ? "border-maple bg-[color-mix(in_srgb,var(--c-maple)_12%,transparent)] text-maple font-pixel" : "bg-surface2 border-edge text-dim hover:border-maple/60"}`}>
            {itemId === "db" && dbItem?.itemId ? (
              <>
                <img src={iconUrl(dbItem.itemId)} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }}
                  className="w-6 h-6 object-contain [image-rendering:pixelated]" />
                <span>{dbItem.name} <span className="opacity-60">{pickerOpen ? "목록 닫기" : "변경"}</span></span>
              </>
            ) : (
              <span>🔎 전체 악세서리 {pickerOpen ? "닫기" : "찾기"}</span>
            )}
          </button>
        </div>

        {pickerOpen && (
          <div className="border-t-2 border-edge pt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {pickerSubcats.map((sc) => (
                <button key={sc} type="button" onClick={() => setPickerSubcat(sc)}
                  className={`px-2 py-1 text-[11px] border transition-colors ${pickerSubcat === sc ? "border-maple text-maple" : "border-edge text-dim hover:text-maple hover:border-maple"}`}>
                  {sc === "전체" ? "전체" : SUBCAT_KR[sc] ?? sc}
                </button>
              ))}
              <input
                type="text"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="이름 검색 (예: 단풍잎)"
                className="pixel-input px-2 py-1 text-xs w-40 ml-auto"
              />
            </div>
            {accLoading ? (
              <p className="text-xs text-dim py-3">악세서리 목록 불러오는 중…</p>
            ) : pickerItems.length === 0 ? (
              <p className="text-xs text-dim py-3">조건에 맞는 악세서리가 없습니다. (업그레이드 횟수가 있고 옵션이 등록된 메랜 아이템만 노출 — 없으면 &lsquo;직접 입력&rsquo;을 쓰세요)</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-72 overflow-y-auto pr-1">
                {pickerItems.map((it) => {
                  const lines = linesFromStats(it.stats);
                  const summary = LINE_KEYS.filter((k) => (lines[k] ?? 0) > 0)
                    .map((k) => `${k}+${lines[k]}`)
                    .join(" ");
                  const active = itemId === "db" && dbItem?.itemId === it.id;
                  return (
                    <button key={it.id} type="button" onClick={() => pickDbItem(it)}
                      className={`flex items-center gap-2 px-2 py-1.5 border text-left transition-colors ${active ? "border-maple text-maple" : "border-edge bg-surface2 hover:border-maple/60"}`}>
                      <img src={iconUrl(it.id)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }}
                        className="w-7 h-7 object-contain [image-rendering:pixelated] shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-xs font-bold truncate">{it.name_kr || it.name}</span>
                        <span className="block text-[10px] text-dim truncate">
                          {SUBCAT_KR[it.subcategory ?? ""] ?? it.subcategory} · 업횟 {it.upgrade_slots} · {summary}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-[10px] text-dim">
              메랜에 노출되는 악세서리 중 업그레이드 횟수가 있고 옵션이 등록된 {accessories.length}개를 보여줍니다.
              귀고리는 메랜에서 혼줌을 사용할 수 없어 제외했습니다.
              메랜 커스텀 옵션이 아직 DB에 없는 아이템(예: 금이 간 안경)은 &lsquo;직접 입력&rsquo;으로 수치를 넣어 시뮬할 수 있습니다.
            </p>
          </div>
        )}

        {itemId === "custom" && (
          <div className="border-t-2 border-edge pt-3">
            <p className="text-[11px] text-dim mb-2">악세서리의 기본 옵션을 그대로 입력하세요 (0인 줄에는 혼줌이 붙지 않습니다).</p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {LINE_KEYS.map((k) => (
                <label key={k} className="text-[11px] text-dim text-center">
                  {k}
                  <input type="number" min="0" value={customLines[k] ?? 0}
                    onChange={(e) => { setCustomLines((prev) => ({ ...prev, [k]: Math.max(0, Number(e.target.value) || 0) })); resetRun(); }}
                    className="pixel-input w-full px-1.5 py-1.5 mt-1 text-center text-ink" />
                </label>
              ))}
              <label className="text-[11px] text-maple text-center">
                업그레이드 횟수
                <input type="number" min="1" max="10" value={customSlots}
                  onChange={(e) => { setCustomSlots(Math.min(10, Math.max(1, Math.floor(Number(e.target.value) || 1)))); resetRun(); }}
                  className="pixel-input w-full px-1.5 py-1.5 mt-1 text-center text-ink" />
              </label>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="text-xs text-dim">
            관심 스탯
            <select value={focusStat} onChange={(e) => { setFocusStat(e.target.value as LineKey); setBatch(EMPTY_BATCH); }}
              className="pixel-input w-full px-3 py-2 mt-1 text-sm text-ink">
              {(activeLines.length > 0 ? activeLines : MAIN_STATS).map((k) => (
                <option key={k} value={k}>{k} (기본 {item.lines[k] ?? 0})</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-dim">
            목표 수치 이상
            <input type="number" min="0" value={target} onChange={(e) => setTarget(Math.max(0, Number(e.target.value) || 0))}
              className="pixel-input w-full px-3 py-2 mt-1 text-sm text-ink" />
          </label>
          <div className="col-span-2 text-[11px] text-dim self-end pb-2">
            혼줌·악세서리 단가는 아래 <b className="text-ink">② 사용 내역</b>에서 입력하거나 거래소 시세로 채웁니다. 기대 비용 계산에도 같은 단가를 씁니다.
          </div>
        </div>

        {showAssumptions && (
          <div className="border-t-2 border-edge pt-3 space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="text-xs text-dim">
                성공률 (%)
                <input type="number" min="0" max="100" value={successPct}
                  onChange={(e) => { setSuccessPct(Math.min(100, Math.max(0, Number(e.target.value) || 0))); setBatch(EMPTY_BATCH); }}
                  className="pixel-input w-full px-3 py-2 mt-1 text-sm text-ink" />
              </label>
              <label className="text-xs text-dim flex items-end gap-2 pb-2">
                <input type="checkbox" checked={lineVanish} onChange={(e) => { setLineVanish(e.target.checked); setBatch(EMPTY_BATCH); }} className="accent-[var(--c-maple)]" />
                <span>0이 된 옵션 줄은 소멸 (이후 혼줌 영향 없음)</span>
              </label>
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-pixel text-[11px] text-ink">변동폭(-5~+5) 가중치 — 공식 미공개, 기본 균등 가정</span>
                <button type="button" onClick={() => { setDeltaWeights([...DEFAULT_DELTA_WEIGHTS]); setBatch(EMPTY_BATCH); }} className="text-[11px] text-maple underline">기본값 복원</button>
              </div>
              <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
                {deltaWeights.map((w, i) => (
                  <label key={i} className="text-[10px] text-dim text-center">
                    {i - 5 >= 0 ? `+${i - 5}` : i - 5}
                    <input type="number" min="0" step="0.1" value={w}
                      onChange={(e) => { const v = Number(e.target.value); setDeltaWeights((prev) => prev.map((x, j) => (j === i ? Math.max(0, v || 0) : x))); setBatch(EMPTY_BATCH); }}
                      className="pixel-input w-full px-1 py-1.5 mt-1 text-center text-ink" />
                    <span className="block mt-0.5">{percent(normalizedWeights[i], 1)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 아이템 카드 + ① 주문서 강화 ── */}
      <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-4 items-start">
        <SimItemCard
          name={item.name}
          subName={meta?.name && meta.name !== item.name ? meta.name : null}
          icon={stageIcon}
          reqLevel={meta?.level_req ?? item.reqLevel ?? null}
          jobReq={meta?.job_req ?? (item.itemId !== null ? "공용" : null)}
          category={item.itemId !== null ? (SUBCAT_KR[meta?.subcategory ?? ""] ?? meta?.subcategory ?? (item.id === "db" ? "악세서리" : "허리띠")) : "커스텀"}
          stats={cardStats}
          slotsTotal={item.slots}
          slotsUsed={manualUsed}
          note={<span>{item.note}{item.id === "black" && " · 메랜 전용 수치 (원작 올스탯 +5)"}</span>}
        />

        <div className="space-y-4 min-w-0">
          <section className="pixel-panel p-4 space-y-3" aria-label="주문서 강화">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-pixel text-sm text-ink">① 주문서 강화 <span className="text-dim font-normal">— {currentTry}트</span></h2>
              <span className="text-[11px] text-dim">남은 횟수 <b className={manualDone ? "text-red-500" : "text-maple"}>{Math.max(0, item.slots - manualUsed)}</b> / {item.slots}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <SimActionCard
                icon={<img src={iconUrl(CHAOS_SCROLL_ITEM_ID)} alt="" className="w-9 h-9 object-contain [image-rendering:pixelated]" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                hotkey="A"
                title={`혼돈 ${successPct}%`}
                subtitle="가진 스탯마다 -5 ~ +5"
                active
                disabled={manualDone}
                onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyA", bubbles: true }))}
              />
              <SimActionCard
                icon="↺"
                hotkey="R"
                title="새 악세서리"
                subtitle={manual && manual.used > 0 ? `${currentTry}트 중단하고 처음부터` : "처음부터"}
                onClick={newAccessory}
                disabled={!manual}
              />
              <SimActionCard
                icon="🧹"
                hotkey="V"
                title="전체 리셋"
                subtitle="사용 내역·기록 초기화"
                tone="danger"
                onClick={resetAll}
              />
            </div>
            {/* 무대 내부 폭(이미지+툴팁)이 좁은 화면보다 넓을 수 있어 가로 스크롤로 감싼다 */}
            <div className="overflow-x-auto">
              <ChaosStage
                name={item.name}
                itemId={item.itemId}
                slots={item.slots}
                used={manualUsed}
                slotHistory={manual?.history ?? []}
                baseLines={item.lines}
                lines={manualLines}
                activeLines={activeLines}
                gainKeys={GAIN_KEYS}
                successPct={successPct}
                focusStat={focusStat}
                target={target}
                onApply={applyManual}
                onReset={newAccessory}
              />
            </div>
            <p className="text-[11px] text-dim">스탯별 변동 확률은 원작 통용 가정(성공 {successPct}% · ±5 균등)입니다 — 메랜 공지 미기재. &lsquo;확률 가정&rsquo;에서 조정할 수 있습니다.</p>
          </section>

          <SimLedger
            rows={[
              { key: "item", icon: stageIcon, label: item.name, count: usage.items, unitPrice: itemUnit, market: itemMarket },
              { key: "scroll", icon: iconUrl(CHAOS_SCROLL_ITEM_ID), label: CHAOS_SCROLL_NAME, count: usage.scrolls, unitPrice: scrollUnit, market: scrollMarket },
            ]}
            onUnitPriceChange={(key, price) => (key === "item" ? setItemUnit(price) : setScrollUnit(price))}
            onResetAll={resetAll}
            resetHotkey="V"
            footnote="단가는 메소 단위. '시세' 버튼은 거래소 최근 일봉 판매 매물 평균가(아이템 시세 메뉴와 동일 출처)이며, 매물이 없는 아이템은 직접 입력합니다."
          />
        </div>
      </div>

      {/* ── 기록 로그 ── */}
      <SimLog entries={log.entries} hotkeyLegend={HOTKEY_LEGEND} soundOn={sound.enabled} onToggleSound={sound.toggle} onClear={log.clear} />

      {/* ── 트 기록 ── */}
      <div className="pixel-panel p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-pixel text-sm text-ink">시도 기록</h2>
          {attempts.length > 0 && (
            <button type="button" onClick={() => setAttempts([])} className="text-[11px] text-dim hover:text-maple">기록 초기화</button>
          )}
        </div>
        {attemptSummary ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <SmallStat label="총 트" value={`${attemptSummary.total}트`} />
              <SmallStat label={`${focusStat} ${target}+ 달성`} value={`${attemptSummary.hits}트`} />
              <SmallStat label={`최고 ${focusStat}`} value={`${attemptSummary.best.n}트 · ${attemptSummary.best.lines[focusStat] ?? 0}`} />
              <SmallStat label="누적 비용" value={attemptCost > 0 ? `${formatMeso(attemptSummary.total * attemptCost)} 메소` : "단가 입력"} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface2 text-dim">
                    <th className="text-left px-2 py-1.5 font-medium w-12">트</th>
                    <th className="text-center px-2 py-1.5 font-medium w-16">성공</th>
                    <th className="text-left px-2 py-1.5 font-medium">최종 옵션 (기본 대비)</th>
                    <th className="text-center px-2 py-1.5 font-medium w-20">{focusStat}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...attempts].reverse().map((a) => {
                    const focus = a.lines[focusStat] ?? 0;
                    const isBest = a.n === attemptSummary.best.n;
                    return (
                      <tr key={a.n} className={`border-t border-edge/40 ${isBest ? "bg-[color-mix(in_srgb,var(--c-maple)_8%,transparent)]" : ""}`}>
                        <td className="px-2 py-1.5 font-pixel">{a.n}트{isBest && <span className="text-maple ml-1">★</span>}</td>
                        <td className="px-2 py-1.5 text-center">{a.successes}/{item.slots}</td>
                        <td className="px-2 py-1.5">
                          <span className="inline-flex flex-wrap gap-x-2 gap-y-0.5">
                            {activeLines.map((k) => {
                              const base = item.lines[k] ?? 0;
                              const v = a.lines[k] ?? 0;
                              const d = v - base;
                              return (
                                <span key={k} className={d > 0 ? "text-green-600" : d < 0 ? "text-red-500" : "text-dim"}>
                                  {k} {v}{d !== 0 && <span className="opacity-80">({d > 0 ? "+" : ""}{d})</span>}
                                </span>
                              );
                            })}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`inline-block px-1.5 py-0.5 font-bold ${focus >= target ? "bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] text-maple" : "text-ink"}`}>{focus}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-dim">★ 표시가 {focusStat} 기준 가장 잘 나온 트입니다. 비용은 ② 사용 내역의 단가(악세서리 + 혼줌 {item.slots}장)로 계산합니다.</p>
          </>
        ) : (
          <p className="text-[11px] text-dim">아직 완작한 악세서리가 없습니다. 혼줌 {item.slots}장을 다 바르면 1트로 기록됩니다.</p>
        )}
      </div>

      {/* ── 기대값 분석 (접이식) ── */}
      <div className="pixel-panel p-4 space-y-3">
        <button type="button" onClick={() => setShowAnalysis((v) => !v)} className="w-full flex items-center justify-between gap-2 text-left">
          <h2 className="font-pixel text-sm text-ink">기대값 분석 — {focusStat} {target}+ 확률 {percent(metrics.targetP)} · 기대값 {number(metrics.expected)}</h2>
          <span className="text-[11px] text-dim">{showAnalysis ? "접기 ▲" : "펼치기 ▼"}</span>
        </button>
        {showAnalysis && (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <Metric label={`${item.slots}장 후 ${focusStat} 기대값`} value={number(metrics.expected)} sub={`기본 ${focusBase} · 표준편차 ${number(metrics.deviation)}`} />
              <Metric label={`${focusStat} ${target}+ 확률 (1개 완작)`} value={percent(metrics.targetP)} sub={mcMetrics ? `아무 주스탯이나 ${target}+: ${percent(mcMetrics.anyP)}` : "주스탯 없음"} />
              <Metric
                label="목표 기대 비용"
                value={attemptCost > 0 && Number.isFinite(metrics.expectedCost) ? `${formatMeso(metrics.expectedCost)} 메소` : Number.isFinite(metrics.expectedAttempts) ? "단가 입력" : "도달 불가"}
                sub={Number.isFinite(metrics.expectedAttempts) ? `평균 ${number(metrics.expectedAttempts)}개 완작` : "확률 설정 확인"}
              />
              <Metric
                label="주스탯 4줄 합 기대값"
                value={mcMetrics ? number(mcMetrics.expectedMainTotal) : "-"}
                sub={mcMetrics ? `시뮬 ${MC_TRIALS.toLocaleString()}회 평균 (줄 ${mcMetrics.mainCount}개)` : "주스탯 줄 없음"}
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <h3 className="font-pixel text-xs text-ink">{focusStat} 최종 분포 — 혼줌 {item.slots}장 전부 사용 기준</h3>
                <span className="text-[11px] text-dim">성공 {successPct}% · 변동 ±5 정확 계산</span>
              </div>
              <div className="overflow-x-auto pb-1">
                <div className="flex items-end gap-1 h-36 min-w-max border-b-2 border-edge px-1">
                  {distribution.map(([v, p]) => (
                    <div key={v} className="w-7 h-full flex flex-col justify-end items-center group" title={`${focusStat} ${v}: ${percent(p)}`}>
                      <span className="hidden group-hover:block text-[9px] text-maple mb-1">{(p * 100).toFixed(1)}</span>
                      <div className={`w-4 ${v >= target ? "bg-maple" : "bg-edge"}`} style={{ height: `${Math.max(2, (p / maxProbability) * 100)}%` }} />
                      <span className="text-[9px] text-dim mt-1">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-dim mt-2">주황 막대가 목표({target}) 이상 구간입니다. 실패한 장은 수치 변동 없이 업그레이드 횟수만 소모한 것으로 계산합니다.</p>
            </div>

            <div className="border-t border-edge pt-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-pixel text-xs text-ink">일괄 작 체험 — 깨끗한 {item.name} 1개마다 혼줌 {item.slots}장</h3>
                <div className="flex flex-wrap gap-1.5">
                  {[1, 10, 100, 1000].map((count) => (
                    <button key={count} type="button" onClick={() => runBatch(count)} className="pixel-btn px-2.5 py-1.5 font-pixel text-[11px]">{count.toLocaleString()}개</button>
                  ))}
                  <button type="button" onClick={() => setBatch(EMPTY_BATCH)} className="pixel-card px-2.5 py-1.5 font-pixel text-[11px] text-dim">초기화</button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <SmallStat label="완작 개수" value={`${batch.attempts.toLocaleString()}개`} />
                <SmallStat label={`${focusStat} ${target}+ 달성`} value={`${batch.reached.toLocaleString()}개`} />
                <SmallStat label={`최고 ${focusStat}`} value={batch.bestFocus === null ? "-" : String(batch.bestFocus)} />
                <SmallStat label="누적 비용" value={attemptCost > 0 ? `${formatMeso(batch.attempts * attemptCost)} 메소` : "단가 입력"} />
              </div>
              {batch.recent.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {batch.recent.map((r, i) => (
                    <span key={`${batch.attempts}-${i}`} className={`px-1.5 py-0.5 text-[10px] border ${r.focus >= target ? "border-maple text-maple" : "border-edge text-dim"}`}>
                      {focusStat} {r.focus}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── 안내 ── */}
      <div className="pixel-panel p-5">
        <h2 className="font-bold mb-3 font-pixel">혼돈의 주문서 알아두기</h2>
        <ul className="space-y-1.5">
          <li className="text-sm text-dim flex gap-2"><span className="text-maple flex-shrink-0">-</span>
            <span><b className="text-ink">기존 옵션만 다시 굴립니다</b> — 성공하면 장비에 붙어 있는 모든 옵션이 각각 -5~+5 범위로 변동합니다. 0인 옵션에는 새로 붙지 않습니다.</span></li>
          <li className="text-sm text-dim flex gap-2"><span className="text-maple flex-shrink-0">-</span>
            <span><b className="text-ink">메이플랜드는 악세서리 한정</b> — 원작(GMS)과 달리 무기·방어구에는 사용할 수 없습니다. 올스탯 3 + 공격력 1·마력 4 + 방어·회피까지 굴릴 줄이 9개인 검은색 허리띠(무릉도장 12,000점)가 기대값이 가장 좋고, 같은 이유로 빨간색 이하 허리띠는 시작점이 낮아 효율이 떨어집니다.</span></li>
          <li className="text-sm text-dim flex gap-2"><span className="text-maple flex-shrink-0">-</span>
            <span><b className="text-ink">획득처</b> — 인게임 드랍 전용(공지 확정 33종). <a href="/drop-search" className="text-maple underline">획득 경로</a>에서 &ldquo;혼돈의 주문서&rdquo;를 검색하면 드랍 몬스터를 볼 수 있습니다.</span></li>
          <li className="text-sm text-dim flex gap-2"><span className="text-maple flex-shrink-0">-</span>
            <span><b className="text-ink">확률 가정 주의</b> — 성공률 60%와 변동폭 ±5는 원작 통용값이지만, 변동폭 안에서 어떤 수치가 잘 나오는지(가중치)는 공식적으로 공개된 적이 없습니다. 기본값은 균등 가정이며 메랜 실측이 쌓이면 &lsquo;확률 가정&rsquo;에서 바꿔 쓰세요.</span></li>
          <li className="text-sm text-dim flex gap-2"><span className="text-maple flex-shrink-0">-</span>
            <span><b className="text-ink">단축키</b> — {HOTKEY_LEGEND}. 링크 복사로 지금 고른 악세서리를 그대로 공유할 수 있습니다.</span></li>
        </ul>
      </div>

      <div className="text-[11px] text-dim bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2 leading-relaxed">
        ⚠️ 흰~빨간색 허리띠 기본 수치는 원본(GMS v92) 데이터이며, 검은색 허리띠는 메이플랜드 전용 수치(올스탯 +3 · 공격력 +1 · 마력 +4, 원작은 올스탯 +5)를 적용했습니다.
        무릉도장 필요 점수와 혼줌 등장·드랍 몹은 메랜 10/8 공식 패치노트 기준입니다.
        변동폭 가중치·악세서리 사용 제한의 세부 규칙은 인게임 실측 제보에 따라 갱신됩니다.
      </div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="pixel-card p-3">
      <div className="font-pixel text-[10px] text-dim">{label}</div>
      <div className="text-lg font-bold text-maple mt-1">{value}</div>
      <div className="text-[11px] text-dim">{sub}</div>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="pixel-card p-2">
      <div className="font-pixel text-[10px] text-dim">{label}</div>
      <div className="font-bold text-sm mt-0.5 truncate" title={value}>{value}</div>
    </div>
  );
}
