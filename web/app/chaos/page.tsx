"use client";

/* 혼줌 시뮬레이터 — 혼돈의 주문서 60% (메랜 10/8 패치 신규)
 *
 * 수치 근거:
 * - 혼돈의 주문서(2049100): 10/8 공식 패치노트로 등장 확정 (maple.land/board/notices/h0ifyesthgb4e79hecngkcgh)
 *   메랜은 악세서리에만 사용 가능 — 커뮤니티 확인 기준 (원작 GMS는 전 장비)
 * - 허리띠 기본 스탯: DB items 1132000~1132004 (maplestory.io GMS v92 원본)
 *   무릉도장 필요 점수(140/1,300/2,800/6,400/12,000)는 10/8 공지 확정값
 * - 성공률 60%·변동폭 ±5는 원작 통용값, 변동폭 내 가중치는 공식 미공개 —
 *   기본 균등 가정이며 화면에서 조정 가능 (리버스 기대값 시뮬과 같은 방침)
 */

import { useEffect, useMemo, useState } from "react";
import { getItems } from "@/lib/api";
import type { Item } from "@/lib/types";
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
}

/* 무릉도장 허리띠 5종 — 스탯: DB items(GMS v92) · 필요 점수: 10/8 공지 */
const BELTS: TargetItem[] = [
  { id: "white", name: "흰색 허리띠", itemId: 1132000, lines: { STR: 1, DEX: 1, INT: 1, LUK: 1, 물리방어: 10, 마법방어: 10, 회피: 3 }, slots: 3, note: "무릉 140점" },
  { id: "yellow", name: "노란색 허리띠", itemId: 1132001, lines: { STR: 2, DEX: 2, INT: 2, LUK: 2, 물리방어: 20, 마법방어: 20, 회피: 6 }, slots: 3, note: "무릉 1,300점" },
  { id: "blue", name: "파란색 허리띠", itemId: 1132002, lines: { STR: 3, DEX: 3, INT: 3, LUK: 3, 물리방어: 30, 마법방어: 30, 회피: 9 }, slots: 3, note: "무릉 2,800점" },
  { id: "red", name: "빨간색 허리띠", itemId: 1132003, lines: { STR: 4, DEX: 4, INT: 4, LUK: 4, 물리방어: 40, 마법방어: 40, 회피: 12 }, slots: 3, note: "무릉 6,400점" },
  { id: "black", name: "검은색 허리띠", itemId: 1132004, lines: { STR: 5, DEX: 5, INT: 5, LUK: 5, 물리방어: 50, 마법방어: 50, 회피: 15 }, slots: 3, note: "무릉 12,000점 ★기대값 최고" },
];

const DEFAULT_SUCCESS = 60; // %
const DEFAULT_DELTA_WEIGHTS = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]; // -5 ~ +5 균등 가정
const MC_TRIALS = 40000;

function iconUrl(itemId: number): string {
  return `/api/icon/item/${itemId}`; // 서버 프록시
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

interface ManualState {
  lines: Lines;
  used: number;
  history: boolean[]; // 장별 성공 여부 (업횟 게이지 표시)
  log: string[];
}

interface BatchState {
  attempts: number;
  reached: number;
  bestFocus: number | null;
  recent: { focus: number; anyMain: number }[];
}

const EMPTY_BATCH: BatchState = { attempts: 0, reached: 0, bestFocus: null, recent: [] };

export default function ChaosSimPage() {
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

  const [focusStat, setFocusStat] = useState<LineKey>("STR");
  const [target, setTarget] = useState(10);
  const [successPct, setSuccessPct] = useState(DEFAULT_SUCCESS);
  const [deltaWeights, setDeltaWeights] = useState([...DEFAULT_DELTA_WEIGHTS]);
  const [lineVanish, setLineVanish] = useState(true);
  const [scrollPrice, setScrollPrice] = useState(0); // 만 메소
  const [itemPrice, setItemPrice] = useState(0); // 만 메소
  const [showAssumptions, setShowAssumptions] = useState(false);

  const [manual, setManual] = useState<ManualState | null>(null);
  const [batch, setBatch] = useState<BatchState>(EMPTY_BATCH);

  const successRate = Math.min(100, Math.max(0, successPct)) / 100;
  const focusBase = item.lines[focusStat] ?? 0;

  /* 선택 스탯의 정확 분포 */
  const distribution = useMemo(
    () => [...lineDistribution(focusBase, item.slots, successRate, deltaWeights, lineVanish)].sort((a, b) => a[0] - b[0]),
    [focusBase, item.slots, successRate, deltaWeights, lineVanish],
  );

  const metrics = useMemo(() => {
    const expected = distribution.reduce((sum, [v, p]) => sum + v * p, 0);
    const variance = distribution.reduce((sum, [v, p]) => sum + (v - expected) ** 2 * p, 0);
    const targetP = distribution.filter(([v]) => v >= target).reduce((sum, [, p]) => sum + p, 0);
    const attemptCost = itemPrice + item.slots * scrollPrice;
    return {
      expected,
      deviation: Math.sqrt(variance),
      targetP,
      expectedAttempts: targetP > 0 ? 1 / targetP : Infinity,
      expectedCost: targetP > 0 ? attemptCost / targetP : Infinity,
      attemptCost,
    };
  }, [distribution, target, itemPrice, scrollPrice, item.slots]);

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

  const switchItem = (id: string) => {
    setItemId(id);
    setManual(null);
    setBatch(EMPTY_BATCH);
    if (id !== "custom") {
      const belt = BELTS.find((b) => b.id === id);
      if (belt && (belt.lines[focusStat] ?? 0) === 0) setFocusStat("STR");
    }
  };

  const pickDbItem = (it: Item) => {
    const lines = linesFromStats(it.stats);
    const next: TargetItem = {
      id: "db",
      name: it.name_kr || it.name,
      itemId: it.id,
      lines,
      slots: Math.max(1, it.upgrade_slots ?? 1),
      note: `${SUBCAT_KR[it.subcategory ?? ""] ?? it.subcategory ?? "악세서리"} · 업횟 ${it.upgrade_slots}`,
    };
    setDbItem(next);
    setItemId("db");
    setManual(null);
    setBatch(EMPTY_BATCH);
    if ((lines[focusStat] ?? 0) === 0) {
      const first = LINE_KEYS.find((k) => (lines[k] ?? 0) > 0);
      if (first) setFocusStat(first);
    }
  };

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

  const applyManual = (): StageRoll | null => {
    if (manualDone) return null;
    const current = manual ?? { lines: { ...item.lines }, used: 0, history: [], log: [] };
    const { lines, success, deltas } = applyChaos(current.lines, successRate, deltaWeights, lineVanish, item.lines);
    const used = current.used + 1;
    const text = success
      ? `${used}장째 성공 · ${LINE_KEYS.filter((k) => deltas[k] !== undefined)
          .map((k) => `${k} ${deltas[k]! >= 0 ? "+" : ""}${deltas[k]}`)
          .join(", ")}`
      : `${used}장째 실패 — 변동 없이 업그레이드 횟수만 소모`;
    setManual({ lines, used, history: [...current.history, success], log: [text, ...current.log].slice(0, 8) });
    return { success, deltas };
  };

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
  };

  const maxProbability = Math.max(...distribution.map(([, p]) => p), 1e-9);
  const normalizedWeights = normalized(deltaWeights);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold font-pixel">🌀 혼줌 시뮬레이터</h1>
        <p className="text-sm text-dim mt-1">
          10/8 패치로 추가된 <b className="text-ink">혼돈의 주문서 60%</b>는 성공 시 장비에 <b className="text-ink">이미 붙어 있는 모든 옵션을 각각 -5 ~ +5</b> 범위로
          다시 굴립니다. 메이플랜드에서는 <b className="text-maple">악세서리에만</b> 사용할 수 있어, 올스탯 5로 시작하고 굴릴 줄이 7개인{" "}
          <b className="text-maple">검은색 허리띠</b>(무릉도장 12,000점)가 기대값이 가장 좋은 대상으로 꼽힙니다.
        </p>
      </div>

      {/* ── 대상 선택 ── */}
      <div className="pixel-panel p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="font-pixel text-sm text-ink">대상 악세서리</h2>
          <button type="button" onClick={() => setShowAssumptions((v) => !v)} className="pixel-card px-3 py-1.5 font-pixel text-[11px] text-dim">
            {showAssumptions ? "확률 설정 닫기" : "확률 가정 보기·조정"}
          </button>
        </div>
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
                    onChange={(e) => { setCustomLines((prev) => ({ ...prev, [k]: Math.max(0, Number(e.target.value) || 0) })); setManual(null); setBatch(EMPTY_BATCH); }}
                    className="pixel-input w-full px-1.5 py-1.5 mt-1 text-center text-ink" />
                </label>
              ))}
              <label className="text-[11px] text-maple text-center">
                업그레이드 횟수
                <input type="number" min="1" max="10" value={customSlots}
                  onChange={(e) => { setCustomSlots(Math.min(10, Math.max(1, Math.floor(Number(e.target.value) || 1)))); setManual(null); setBatch(EMPTY_BATCH); }}
                  className="pixel-input w-full px-1.5 py-1.5 mt-1 text-center text-ink" />
              </label>
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-4 gap-3">
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
          <label className="text-xs text-dim">
            혼줌 1장 가격 (만 메소)
            <input type="number" min="0" value={scrollPrice} onChange={(e) => setScrollPrice(Math.max(0, Number(e.target.value) || 0))}
              className="pixel-input w-full px-3 py-2 mt-1 text-sm text-ink" />
          </label>
          <label className="text-xs text-dim">
            깨끗한 악세서리 가격 (만 메소)
            <input type="number" min="0" value={itemPrice} onChange={(e) => setItemPrice(Math.max(0, Number(e.target.value) || 0))}
              className="pixel-input w-full px-3 py-2 mt-1 text-sm text-ink" />
          </label>
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

      {/* ── 기대값 ── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <Metric label={`${item.slots}장 후 ${focusStat} 기대값`} value={number(metrics.expected)} sub={`기본 ${focusBase} · 표준편차 ${number(metrics.deviation)}`} />
        <Metric label={`${focusStat} ${target}+ 확률 (1개 완작)`} value={percent(metrics.targetP)} sub={mcMetrics ? `아무 주스탯이나 ${target}+: ${percent(mcMetrics.anyP)}` : "주스탯 없음"} />
        <Metric
          label="목표 기대 비용"
          value={metrics.attemptCost > 0 && Number.isFinite(metrics.expectedCost) ? `${number(metrics.expectedCost)}만` : Number.isFinite(metrics.expectedAttempts) ? "가격 입력" : "도달 불가"}
          sub={Number.isFinite(metrics.expectedAttempts) ? `평균 ${number(metrics.expectedAttempts)}개 완작` : "확률 설정 확인"}
        />
        <Metric
          label="주스탯 4줄 합 기대값"
          value={mcMetrics ? number(mcMetrics.expectedMainTotal) : "-"}
          sub={mcMetrics ? `시뮬 ${MC_TRIALS.toLocaleString()}회 평균 (줄 ${mcMetrics.mainCount}개)` : "주스탯 줄 없음"}
        />
      </div>

      {/* ── 분포 차트 ── */}
      <div className="pixel-panel p-4">
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <h2 className="font-pixel text-sm text-ink">{focusStat} 최종 분포 — 혼줌 {item.slots}장 전부 사용 기준</h2>
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

      {/* ── 직접 발라보기 (연출) ── */}
      <div className="pixel-panel p-4 space-y-3">
        <div>
          <h2 className="font-pixel text-sm text-ink">직접 발라보기</h2>
          <p className="text-xs text-dim mt-1">한 장씩 바르며 성공·실패 연출과 옵션 변동을 확인합니다.</p>
        </div>
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
          onReset={() => setManual(null)}
        />
        {manual && manual.log.length > 0 && (
          <div className="border-t border-edge pt-2 space-y-0.5">
            {manual.log.map((text, i) => (
              <p key={`${manual.used}-${i}`} className={`text-[11px] ${i === 0 ? "text-ink" : "text-dim"}`}>{text}</p>
            ))}
          </div>
        )}
      </div>

      {/* ── 일괄 작 ── */}
      <div className="pixel-panel p-4 space-y-3">
        <div>
          <h2 className="font-pixel text-sm text-ink">일괄 작 체험</h2>
          <p className="text-xs text-dim mt-1">깨끗한 {item.name} 1개마다 혼줌 {item.slots}장을 전부 바릅니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[1, 10, 100, 1000].map((count) => (
            <button key={count} type="button" onClick={() => runBatch(count)} className="pixel-btn px-3 py-2 font-pixel text-xs">{count.toLocaleString()}개</button>
          ))}
          <button type="button" onClick={() => setBatch(EMPTY_BATCH)} className="pixel-card px-3 py-2 font-pixel text-xs text-dim">초기화</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SmallStat label="완작 개수" value={`${batch.attempts.toLocaleString()}개`} />
          <SmallStat label={`${focusStat} ${target}+ 달성`} value={`${batch.reached.toLocaleString()}개`} />
          <SmallStat label={`최고 ${focusStat}`} value={batch.bestFocus === null ? "-" : String(batch.bestFocus)} />
          <SmallStat label="누적 비용" value={`${number(batch.attempts * metrics.attemptCost)}만`} />
        </div>
        {batch.recent.length > 0 && (
          <div className="flex flex-wrap gap-1 border-t border-edge pt-2">
            {batch.recent.map((r, i) => (
              <span key={`${batch.attempts}-${i}`} className={`px-1.5 py-0.5 text-[10px] border ${r.focus >= target ? "border-maple text-maple" : "border-edge text-dim"}`}>
                {focusStat} {r.focus}
              </span>
            ))}
          </div>
        )}
    </div>

      {/* ── 안내 ── */}
      <div className="pixel-panel p-5">
        <h2 className="font-bold mb-3 font-pixel">혼돈의 주문서 알아두기</h2>
        <ul className="space-y-1.5">
          <li className="text-sm text-dim flex gap-2"><span className="text-maple flex-shrink-0">-</span>
            <span><b className="text-ink">기존 옵션만 다시 굴립니다</b> — 성공하면 장비에 붙어 있는 모든 옵션이 각각 -5~+5 범위로 변동합니다. 0인 옵션에는 새로 붙지 않습니다.</span></li>
          <li className="text-sm text-dim flex gap-2"><span className="text-maple flex-shrink-0">-</span>
            <span><b className="text-ink">메이플랜드는 악세서리 한정</b> — 원작(GMS)과 달리 무기·방어구에는 사용할 수 없습니다. 올스탯 5 + 방어·회피까지 굴릴 줄이 7개인 검은색 허리띠(무릉도장 12,000점)가 기대값이 가장 좋고, 같은 이유로 빨간색 이하 허리띠는 시작점이 낮아 효율이 떨어집니다.</span></li>
          <li className="text-sm text-dim flex gap-2"><span className="text-maple flex-shrink-0">-</span>
            <span><b className="text-ink">획득처</b> — 인게임 드랍 전용(공지 확정 33종). <a href="/drop-search" className="text-maple underline">획득 경로</a>에서 &ldquo;혼돈의 주문서&rdquo;를 검색하면 드랍 몬스터를 볼 수 있습니다.</span></li>
          <li className="text-sm text-dim flex gap-2"><span className="text-maple flex-shrink-0">-</span>
            <span><b className="text-ink">확률 가정 주의</b> — 성공률 60%와 변동폭 ±5는 원작 통용값이지만, 변동폭 안에서 어떤 수치가 잘 나오는지(가중치)는 공식적으로 공개된 적이 없습니다. 기본값은 균등 가정이며 메랜 실측이 쌓이면 &lsquo;확률 가정 보기·조정&rsquo;에서 바꿔 쓰세요.</span></li>
        </ul>
      </div>

      <div className="text-[11px] text-dim bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2 leading-relaxed">
        ⚠️ 허리띠 기본 수치는 원본(GMS v92) 데이터, 무릉도장 필요 점수와 혼줌 등장·드랍 몹은 메랜 10/8 공식 패치노트 기준입니다.
        변동폭 가중치·악세서리 사용 제한의 세부 규칙은 인게임 실측 제보에 따라 갱신됩니다.
      </div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="pixel-panel p-3">
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
      <div className="font-bold text-sm mt-0.5">{value}</div>
    </div>
  );
}
