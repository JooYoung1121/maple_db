"use client";

/* 메이커 보석 가성비 계산기 — 길드원 제작 계산기 이식판.
 * 계산 로직(확률 상수·기대값 모델·판매 경로)은 원본 HTML과 동일하게 유지하고
 * UI만 사이트 디자인 시스템으로 재구성했다. */

import { useState, useEffect, useMemo } from "react";

const SELL_FEE_RATE = 0.05;
const NORMALIZED_INVESTMENT = 1_000_000;

interface GemConfig {
  label: string;
  examples: string;
  rawToLow: number;
  rawToMid: number;
  rawToHigh: number;
  lowToMidSuccess: number;
  midToHighSuccess: number;
  rawFee: number;
  lowToMidFee: number;
  midToHighFee: number;
  batchSize: number;
  lossOnFailure: number;
}

const CONFIGS: Record<"crystal" | "jewel", GemConfig> = {
  crystal: {
    label: "크리스탈",
    examples: "힘·민첩성·지혜·행운·어둠의 크리스탈",
    rawToLow: 0.75, rawToMid: 0.24, rawToHigh: 0.01,
    lowToMidSuccess: 0.70, midToHighSuccess: 0.30,
    rawFee: 110_000, lowToMidFee: 330_000, midToHighFee: 550_000,
    batchSize: 10, lossOnFailure: 1,
  },
  jewel: {
    label: "일반 보석",
    examples: "다이아몬드·사파이어·가넷·오팔·아쿠아마린 등",
    rawToLow: 0.70, rawToMid: 0.25, rawToHigh: 0.05,
    lowToMidSuccess: 0.70, midToHighSuccess: 0.30,
    rawFee: 110_000, lowToMidFee: 330_000, midToHighFee: 550_000,
    batchSize: 10, lossOnFailure: 1,
  },
};

function expectedConsumedPerAttempt(config: GemConfig, successRate: number) {
  return successRate * config.batchSize + (1 - successRate) * config.lossOnFailure;
}

function expectedMaterialPerSuccess(config: GemConfig, successRate: number) {
  return config.batchSize + config.lossOnFailure * ((1 - successRate) / successRate);
}

/* 빈 재고에서 시작해 상급 1개가 처음 완성될 때까지의 기대 시도 횟수 (원본 로직 그대로) */
function calculateRawFirstCompletionExpectation(config: GemConfig) {
  const states: { low: number; mid: number }[] = [];
  const index = new Map<string, number>();
  for (let low = 0; low < 10; low += 1) {
    for (let mid = 0; mid < 10; mid += 1) {
      index.set(`${low},${mid}`, states.length);
      states.push({ low, mid });
    }
  }

  const transitions: { probability: number; next: number }[][] = states.map(() => []);
  const immediateLowAttempts = new Array(states.length).fill(0);
  const immediateMidAttempts = new Array(states.length).fill(0);

  function addBranch(stateIndex: number, probability: number, low: number, mid: number, lowAttempts = 0, midAttempts = 0, absorbed = false) {
    immediateLowAttempts[stateIndex] += probability * lowAttempts;
    immediateMidAttempts[stateIndex] += probability * midAttempts;
    transitions[stateIndex].push({ probability, next: absorbed ? -1 : index.get(`${low},${mid}`)! });
  }

  states.forEach(({ low, mid }, stateIndex) => {
    addBranch(stateIndex, config.rawToHigh, low, mid, 0, 0, true);

    if (low < 9) {
      addBranch(stateIndex, config.rawToLow, low + 1, mid);
    } else {
      addBranch(stateIndex, config.rawToLow * (1 - config.lowToMidSuccess), 9, mid, 1, 0, false);
      if (mid < 9) {
        addBranch(stateIndex, config.rawToLow * config.lowToMidSuccess, 0, mid + 1, 1, 0, false);
      } else {
        addBranch(stateIndex, config.rawToLow * config.lowToMidSuccess * (1 - config.midToHighSuccess), 0, 9, 1, 1, false);
        addBranch(stateIndex, config.rawToLow * config.lowToMidSuccess * config.midToHighSuccess, 0, 0, 1, 1, true);
      }
    }

    if (mid < 9) {
      addBranch(stateIndex, config.rawToMid, low, mid + 1);
    } else {
      addBranch(stateIndex, config.rawToMid * (1 - config.midToHighSuccess), low, 9, 0, 1, false);
      addBranch(stateIndex, config.rawToMid * config.midToHighSuccess, 0, 0, 0, 1, true);
    }
  });

  function solve(immediateReward: number[]) {
    let values = new Array(states.length).fill(0);
    for (let iteration = 0; iteration < 5000; iteration += 1) {
      const nextValues = new Array(states.length).fill(0);
      let maxDelta = 0;
      for (let i = 0; i < states.length; i += 1) {
        let value = immediateReward[i];
        for (const branch of transitions[i]) {
          if (branch.next >= 0) value += branch.probability * values[branch.next];
        }
        nextValues[i] = value;
        maxDelta = Math.max(maxDelta, Math.abs(value - values[i]));
      }
      values = nextValues;
      if (maxDelta < 1e-12) break;
    }
    return values[index.get("0,0")!];
  }

  return {
    rawAttempts: solve(new Array(states.length).fill(1)),
    lowToMidAttempts: solve(immediateLowAttempts),
    midToHighAttempts: solve(immediateMidAttempts),
  };
}

function buildModel(config: GemConfig) {
  const lowConsumedPerAttempt = expectedConsumedPerAttempt(config, config.lowToMidSuccess);
  const midConsumedPerAttempt = expectedConsumedPerAttempt(config, config.midToHighSuccess);
  const lowPerMid = expectedMaterialPerSuccess(config, config.lowToMidSuccess);
  const midPerHigh = expectedMaterialPerSuccess(config, config.midToHighSuccess);
  const lowPerHigh = lowPerMid * midPerHigh;
  const lowToMidAttemptsPerHigh = midPerHigh / config.lowToMidSuccess;
  const midToHighAttemptsPerHigh = 1 / config.midToHighSuccess;
  const lowFeePerHigh = lowToMidAttemptsPerHigh * config.lowToMidFee + midToHighAttemptsPerHigh * config.midToHighFee;
  const midFeePerHigh = midToHighAttemptsPerHigh * config.midToHighFee;

  const first = calculateRawFirstCompletionExpectation(config);
  const firstRawFeePerHigh =
    first.rawAttempts * config.rawFee +
    first.lowToMidAttempts * config.lowToMidFee +
    first.midToHighAttempts * config.midToHighFee;

  const lowAttemptsPerRaw = config.rawToLow / lowConsumedPerAttempt;
  const midProducedPerRawAtMidStop = config.rawToMid + lowAttemptsPerRaw * config.lowToMidSuccess;
  const midAttemptsPerRaw = midProducedPerRawAtMidStop / midConsumedPerAttempt;
  const highProducedPerRaw = config.rawToHigh + midAttemptsPerRaw * config.midToHighSuccess;

  const lowAttemptsPerLow = 1 / lowConsumedPerAttempt;
  const midProducedPerLow = lowAttemptsPerLow * config.lowToMidSuccess;
  const midAttemptsPerLowToHigh = midProducedPerLow / midConsumedPerAttempt;
  const highProducedPerLow = midAttemptsPerLowToHigh * config.midToHighSuccess;

  const midAttemptsPerMid = 1 / midConsumedPerAttempt;
  const highProducedPerMid = midAttemptsPerMid * config.midToHighSuccess;

  return {
    config,
    lowPerHigh, midPerHigh,
    lowToMidAttemptsPerHigh, midToHighAttemptsPerHigh,
    lowFeePerHigh, midFeePerHigh,
    firstRawAttemptsPerHigh: first.rawAttempts,
    firstRawLowToMidAttemptsPerHigh: first.lowToMidAttempts,
    firstRawMidToHighAttemptsPerHigh: first.midToHighAttempts,
    firstRawFeePerHigh,
    lowAttemptsPerRaw, midProducedPerRawAtMidStop, midAttemptsPerRaw, highProducedPerRaw,
    lowAttemptsPerLow, midProducedPerLow, midAttemptsPerLowToHigh, highProducedPerLow,
    midAttemptsPerMid, highProducedPerMid,
  };
}

type Model = ReturnType<typeof buildModel>;

const MODELS: Record<"crystal" | "jewel", Model> = {
  crystal: buildModel(CONFIGS.crystal),
  jewel: buildModel(CONFIGS.jewel),
};

/* ── 표시 유틸 ── */
function parseMoney(value: string): number | null {
  const digits = value.replace(/[^0-9]/g, "");
  return digits ? Number(digits) : null;
}

function formatMoney(value: number | null, signed = false): string {
  if (value === null || !Number.isFinite(value)) return "-";
  const rounded = Math.round(value);
  const sign = signed && rounded > 0 ? "+" : "";
  return `${sign}${rounded.toLocaleString("ko-KR")} 메소`;
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 100_000_000) return `${sign}약 ${(abs / 100_000_000).toFixed(2).replace(/\.?0+$/, "")}억 메소`;
  if (abs >= 10_000) return `${sign}약 ${(abs / 10_000).toFixed(1).replace(/\.?0+$/, "")}만 메소`;
  return `${sign}${Math.round(abs).toLocaleString("ko-KR")} 메소`;
}

function formatPercent(rate: number | null, signed = false): string {
  if (rate === null || !Number.isFinite(rate)) return "-";
  const value = rate * 100;
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(Math.abs(value) >= 10 ? 1 : 2).replace(/\.?0+$/, "")}%`;
}

const PRICE_FIELDS = [
  { id: "raw", label: "원본 보석" },
  { id: "low", label: "하급 보석" },
  { id: "mid", label: "중급 보석" },
  { id: "high", label: "상급 보석" },
] as const;

type PriceId = (typeof PRICE_FIELDS)[number]["id"];

interface TradeRoute {
  id: string;
  name: string;
  cost: number;
  netSale: number;
  profit: number;
  roi: number | null;
  normalizedProfit: number | null;
  outputText: string;
}

function makeRoute(id: string, name: string, cost: number, grossSale: number, outputText: string): TradeRoute | null {
  if (!Number.isFinite(cost) || !Number.isFinite(grossSale)) return null;
  const netSale = grossSale * (1 - SELL_FEE_RATE);
  const profit = netSale - cost;
  const roi = cost > 0 ? profit / cost : null;
  return { id, name, cost, netSale, profit, roi, normalizedProfit: roi !== null ? roi * NORMALIZED_INVESTMENT : null, outputText };
}

export default function GemCalculator() {
  const [mode, setMode] = useState<"crystal" | "jewel">("crystal");
  const [purpose, setPurpose] = useState<"acquire" | "trade">("acquire");
  const [priceText, setPriceText] = useState<Record<PriceId, string>>({ raw: "", low: "", mid: "", high: "" });
  const [detailOpen, setDetailOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("maker_gem_calc_v1") ?? "{}");
      if (saved.mode === "crystal" || saved.mode === "jewel") setMode(saved.mode);
      if (saved.purpose === "acquire" || saved.purpose === "trade") setPurpose(saved.purpose);
      if (saved.prices) {
        setPriceText((prev) => {
          const next = { ...prev };
          for (const f of PRICE_FIELDS) {
            if (Number.isFinite(saved.prices[f.id])) next[f.id] = Number(saved.prices[f.id]).toLocaleString("ko-KR");
          }
          return next;
        });
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  const prices = useMemo(() => {
    const out: Record<PriceId, number | null> = { raw: null, low: null, mid: null, high: null };
    for (const f of PRICE_FIELDS) out[f.id] = parseMoney(priceText[f.id]);
    return out;
  }, [priceText]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem("maker_gem_calc_v1", JSON.stringify({ mode, purpose, prices }));
    } catch { /* ignore */ }
  }, [mode, purpose, prices, loaded]);

  const model = MODELS[mode];
  const c = model.config;

  /* 획득 비용 */
  const acquireCosts = useMemo(() => ({
    raw: prices.raw === null ? null : model.firstRawAttemptsPerHigh * prices.raw + model.firstRawFeePerHigh,
    low: prices.low === null ? null : model.lowPerHigh * prices.low + model.lowFeePerHigh,
    mid: prices.mid === null ? null : model.midPerHigh * prices.mid + model.midFeePerHigh,
    high: prices.high,
  }), [prices, model]);

  const bestAcquire = useMemo(() => {
    const entries = Object.entries(acquireCosts).filter(([, v]) => v !== null && Number.isFinite(v)) as [string, number][];
    if (entries.length === 0) return null;
    const min = Math.min(...entries.map(([, v]) => v));
    return { min, ids: entries.filter(([, v]) => Math.abs(v - min) < 0.5).map(([k]) => k) };
  }, [acquireCosts]);

  /* 판매 경로 */
  const tradeRoutes = useMemo(() => {
    const r: (TradeRoute | null)[] = [];
    const p = prices;
    r.push(
      [p.raw, p.low, p.mid, p.high].every((v) => v !== null)
        ? makeRoute("rawLow", "원본 구매 → 하급까지만 가공·판매",
            p.raw! + c.rawFee,
            c.rawToLow * p.low! + c.rawToMid * p.mid! + c.rawToHigh * p.high!,
            `기대 판매물: 하급 ${c.rawToLow.toFixed(3)}개 · 중급 ${c.rawToMid.toFixed(3)}개 · 상급 ${c.rawToHigh.toFixed(3)}개`)
        : null,
      [p.raw, p.mid, p.high].every((v) => v !== null)
        ? makeRoute("rawMid", "원본 구매 → 중급까지 가공·판매",
            p.raw! + c.rawFee + model.lowAttemptsPerRaw * c.lowToMidFee,
            model.midProducedPerRawAtMidStop * p.mid! + c.rawToHigh * p.high!,
            `기대 판매물: 중급 ${model.midProducedPerRawAtMidStop.toFixed(4)}개 · 상급 ${c.rawToHigh.toFixed(3)}개`)
        : null,
      [p.raw, p.high].every((v) => v !== null)
        ? makeRoute("rawHigh", "원본 구매 → 상급까지 가공·판매",
            p.raw! + c.rawFee + model.lowAttemptsPerRaw * c.lowToMidFee + model.midAttemptsPerRaw * c.midToHighFee,
            model.highProducedPerRaw * p.high!,
            `기대 판매물: 상급 ${model.highProducedPerRaw.toFixed(5)}개`)
        : null,
      [p.low, p.mid].every((v) => v !== null)
        ? makeRoute("lowMid", "하급 구매 → 중급까지 가공·판매",
            p.low! + model.lowAttemptsPerLow * c.lowToMidFee,
            model.midProducedPerLow * p.mid!,
            `기대 판매물: 중급 ${model.midProducedPerLow.toFixed(5)}개`)
        : null,
      [p.low, p.high].every((v) => v !== null)
        ? makeRoute("lowHigh", "하급 구매 → 상급까지 가공·판매",
            p.low! + model.lowAttemptsPerLow * c.lowToMidFee + model.midAttemptsPerLowToHigh * c.midToHighFee,
            model.highProducedPerLow * p.high!,
            `기대 판매물: 상급 ${model.highProducedPerLow.toFixed(6)}개`)
        : null,
      [p.mid, p.high].every((v) => v !== null)
        ? makeRoute("midHigh", "중급 구매 → 상급까지 가공·판매",
            p.mid! + model.midAttemptsPerMid * c.midToHighFee,
            model.highProducedPerMid * p.high!,
            `기대 판매물: 상급 ${model.highProducedPerMid.toFixed(5)}개`)
        : null,
    );
    return r;
  }, [prices, model, c]);

  const acquireNames: Record<string, string> = {
    raw: "원본 보석부터 제작", low: "하급 보석부터 제작", mid: "중급 보석부터 제작", high: "상급 보석 직접 구매",
  };

  return (
    <div>
      {/* 모드/목적 선택 */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex gap-1">
          {(["crystal", "jewel"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-sm transition-colors ${mode === m ? "pixel-btn" : "bg-surface2 font-pixel text-dim hover:text-maple"}`}
            >
              {CONFIGS[m].label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {([["acquire", "최저가 획득"], ["trade", "가공 판매 수익"]] as const).map(([p, label]) => (
            <button
              key={p}
              onClick={() => setPurpose(p)}
              className={`px-3 py-1.5 text-sm transition-colors ${purpose === p ? "pixel-btn" : "bg-surface2 font-pixel text-dim hover:text-maple"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 확률 프리셋 안내 */}
      <div className="bg-surface2 border-2 border-edge p-3 mb-4 text-xs text-dim leading-relaxed">
        <strong className="text-ink">옛날 메이플 {c.label} 기준 적용값</strong> — {c.examples}<br />
        원본 1개 + 11만 메소 → 하급 {formatPercent(c.rawToLow)} · 중급 {formatPercent(c.rawToMid)} · 상급 {formatPercent(c.rawToHigh)}<br />
        하급 10개 + 33만 메소 → 중급 성공 {formatPercent(c.lowToMidSuccess)} (실패 시 9개 반환) · 중급 10개 + 55만 메소 → 상급 성공 {formatPercent(c.midToHighSuccess)} (실패 시 9개 반환)
        {purpose === "trade" && <><br /><strong className="text-ink">판매 정산:</strong> 모든 판매 금액에서 거래 수수료 5% 차감</>}
      </div>

      {/* 시세 입력 */}
      <div className="pixel-panel p-4 mb-4">
        <h3 className="font-pixel font-bold text-sm mb-3">시세 입력</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {PRICE_FIELDS.map((f) => (
            <div key={f.id}>
              <label className="block text-xs text-dim mb-1">{f.label}</label>
              <input
                type="text"
                inputMode="numeric"
                value={priceText[f.id]}
                onChange={(e) => {
                  const n = parseMoney(e.target.value);
                  setPriceText((prev) => ({ ...prev, [f.id]: n === null ? "" : n.toLocaleString("ko-KR") }));
                }}
                placeholder="메소"
                className="w-full pixel-input px-3 py-2 text-sm font-mono"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 결과 — 획득 */}
      {purpose === "acquire" && (
        <div className="pixel-panel p-4 mb-4">
          <h3 className="font-pixel font-bold text-sm mb-1">상급 보석 1개당 평균 비용</h3>
          <p className="text-[11px] text-dim mb-3">
            빈 재고에서 시작해 상급 1개를 처음 완성할 때까지의 기대 지출 (완성 시 남는 하급·중급 부산물 가치는 차감하지 않음)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PRICE_FIELDS.map((f) => {
              const cost = acquireCosts[f.id];
              const isBest = bestAcquire?.ids.includes(f.id);
              return (
                <div key={f.id} className={`border-2 p-3 ${isBest ? "border-maple bg-[color-mix(in_srgb,var(--c-maple)_8%,transparent)]" : "border-edge"}`}>
                  <p className="text-xs text-dim mb-0.5">
                    {acquireNames[f.id]}
                    {isBest && <span className="text-maple font-pixel ml-1.5">★ 최저가</span>}
                  </p>
                  <p className={`font-mono font-bold ${isBest ? "text-maple" : "text-ink"}`}>{formatMoney(cost)}</p>
                  <p className="text-[10px] text-dim mt-1">
                    {f.id === "raw" && cost !== null && `원본 평균 ${model.firstRawAttemptsPerHigh.toFixed(3)}개 + 누적 수수료 ${formatCompact(model.firstRawFeePerHigh)}`}
                    {f.id === "low" && cost !== null && `하급 약 ${model.lowPerHigh.toFixed(3)}개 + 누적 수수료 ${formatCompact(model.lowFeePerHigh)}`}
                    {f.id === "mid" && cost !== null && `중급 약 ${model.midPerHigh.toFixed(3)}개 + 누적 수수료 ${formatCompact(model.midFeePerHigh)}`}
                    {f.id === "high" && cost !== null && "제작 실패 위험·수수료 없는 즉시 구매가"}
                    {cost === null && `${f.label} 가격을 입력하세요`}
                  </p>
                </div>
              );
            })}
          </div>
          {bestAcquire && (
            <p className="text-sm mt-3">
              <strong className="text-maple">{bestAcquire.ids.map((id) => acquireNames[id]).join(", ")}</strong>
              이(가) 현재 입력 기준 최저가입니다 — {formatMoney(bestAcquire.min)}
            </p>
          )}
        </div>
      )}

      {/* 결과 — 판매 */}
      {purpose === "trade" && (
        <div className="pixel-panel p-4 mb-4">
          <h3 className="font-pixel font-bold text-sm mb-1">구입 → 단계별 가공 → 판매 기대수익</h3>
          <p className="text-[11px] text-dim mb-3">
            반복 가공·부산물 이월 전제, 판매액에서 수수료 5% 차감. 수익률은 투입 원가 대비입니다.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tradeRoutes.map((route, i) =>
              route === null ? (
                <div key={i} className="border-2 border-dashed border-edge p-3 text-xs text-dim">
                  이 경로 계산에 필요한 시세를 입력하세요
                </div>
              ) : (
                <div
                  key={route.id}
                  className={`border-2 p-3 ${route.profit >= 0 ? "border-green-500/60" : "border-red-400/60"}`}
                >
                  <p className="text-xs text-dim mb-0.5">{route.name}</p>
                  <p className={`font-mono font-bold ${route.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                    {formatPercent(route.roi, true)}
                  </p>
                  <p className="text-[10px] text-dim mt-1 leading-relaxed">
                    원가 {formatCompact(route.cost)} · 판매 정산 {formatCompact(route.netSale)} · 순이익 {formatMoney(route.profit, true)}<br />
                    100만 메소 투입당 {formatMoney(route.normalizedProfit, true)} · {route.outputText}
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* 계산 검증 상세 */}
      <div className="pixel-panel overflow-hidden mb-4">
        <button
          onClick={() => setDetailOpen(!detailOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <span className="font-pixel font-bold text-sm">계산 방식 상세</span>
          <svg className={`w-4 h-4 text-dim transition-transform ${detailOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {detailOpen && (
          <ul className="px-4 pb-4 pt-1 space-y-1.5 text-xs text-dim border-t border-edge/60">
            <li>• 원본 경로: 원본 제련 {model.firstRawAttemptsPerHigh.toFixed(3)}회, 하급→중급 {model.firstRawLowToMidAttemptsPerHigh.toFixed(3)}회, 중급→상급 {model.firstRawMidToHighAttemptsPerHigh.toFixed(3)}회 — 상급 1개 첫 완성까지의 기대값(재고 상태 마르코프 모델)</li>
            <li>• 하급 경로: 하급 {model.lowPerHigh.toFixed(3)}개, 하급→중급 {model.lowToMidAttemptsPerHigh.toFixed(3)}회, 중급→상급 {model.midToHighAttemptsPerHigh.toFixed(3)}회</li>
            <li>• 중급 경로: 중급 {model.midPerHigh.toFixed(3)}개, 중급→상급 {model.midToHighAttemptsPerHigh.toFixed(3)}회</li>
            <li>• 판매 경로는 장기 반복 운용 기준 — 원본 1개당 상급 기대 생산 {model.highProducedPerRaw.toFixed(6)}개, 하급 1개당 {model.highProducedPerLow.toFixed(7)}개, 중급 1개당 {model.highProducedPerMid.toFixed(6)}개</li>
            <li>• 실패 시 재료 {c.batchSize}개 중 {c.batchSize - c.lossOnFailure}개 반환(1개 소실) 규칙이 모든 기대값에 반영되어 있습니다</li>
          </ul>
        )}
      </div>

      <p className="text-[11px] text-dim">
        이 계산기는 추억길드 길드원이 제작해 기증한 것을 사이트에 이식한 것입니다. 확률·수수료는 옛날 메이플 기준값이며, 메이플랜드 실측과 다르면 알려주세요.
      </p>
    </div>
  );
}
