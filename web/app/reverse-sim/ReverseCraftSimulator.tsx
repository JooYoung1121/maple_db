"use client";

import { useEffect, useMemo, useState } from "react";

import { getReverseWeapons } from "@/lib/api";
import { type Weapon, attackDistribution } from "@/lib/reverseCraft";

function weaponIconUrl(itemId: number): string {
  return `/api/icon/item/${itemId}`; // 서버 프록시
}

type CraftResult = {
  destroyed: boolean;
  attack?: number;
  main?: number;
  sub?: number;
};

type BatchState = {
  attempts: number;
  successes: number;
  destroyed: number;
  best: number | null;
  recent: CraftResult[];
};

type ManualState = {
  phase: "ready" | "destroyed" | "level" | "scroll" | "complete";
  attack: number;
  main: number;
  sub: number;
  bonus: number;
  levels: number;
  scrolls: number;
  message: string;
};

// 공식 확률이 아닌 공개 실측 가정. 화면에서 사용자가 직접 조정할 수 있다.
const DEFAULT_BONUS_WEIGHTS = [60, 17.6, 12.1, 6.4, 2.7, 1.1];
const CATALYST_DESTROY_RATE = 0.1;
const LEVEL_MAIN_WEIGHTS = [60, 40]; // 주스탯 +1/+2
const LEVEL_SUB_WEIGHTS = [60, 40]; // 부스탯 +0/+1
const EMPTY_BATCH: BatchState = { attempts: 0, successes: 0, destroyed: 0, best: null, recent: [] };

function emptyManual(weapon: Weapon): ManualState {
  return {
    phase: "ready",
    attack: weapon.baseAtk,
    main: weapon.mainBase,
    sub: weapon.subBase,
    bonus: 0,
    levels: 0,
    scrolls: 0,
    message: "제작을 시작하면 촉매 실패 판정부터 진행합니다.",
  };
}

function normalized(values: number[]): number[] {
  const safe = values.map((v) => Math.max(0, Number.isFinite(v) ? v : 0));
  const total = safe.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return safe.map((_, index) => (index === 0 ? 1 : 0));
  return safe.map((value) => value / total);
}

function rollWeighted(weights: number[]): number {
  const probabilities = normalized(weights);
  const roll = Math.random();
  let acc = 0;
  for (let i = 0; i < probabilities.length; i++) {
    acc += probabilities[i];
    if (roll < acc) return i;
  }
  return probabilities.length - 1;
}

function simulateCraft(weapon: Weapon, bonusWeights: number[]): CraftResult {
  if (Math.random() < CATALYST_DESTROY_RATE) return { destroyed: true };

  let attack = weapon.baseAtk + rollWeighted(bonusWeights);
  let main = weapon.mainBase;
  let sub = weapon.subBase;
  for (let i = 0; i < 3; i++) {
    attack += weapon.levelMin + rollWeighted(weapon.levelWeights);
    main += 1 + rollWeighted(LEVEL_MAIN_WEIGHTS);
    sub += rollWeighted(LEVEL_SUB_WEIGHTS);
  }
  for (let i = 0; i < 7; i++) {
    if (Math.random() < 0.6) {
      attack += 2;
      main += weapon.scroll60Main;
    }
  }
  return { destroyed: false, attack, main, sub };
}

function percent(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "-";
  if (value > 0 && value < 0.0001) return "0.01% 미만";
  return `${(value * 100).toFixed(digits)}%`;
}

function number(value: number, digits = 2): string {
  return value.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

export default function ReverseCraftSimulator() {
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    getReverseWeapons().then(data => { if (active) { setWeapons(data.weapons); setError(!data.weapons.length); } })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [retry]);
  if (error) return <div className="pixel-panel p-4 text-sm">무기 목록을 불러오지 못했습니다. <button className="text-maple underline" onClick={() => setRetry(v => v + 1)}>다시 시도</button></div>;
  if (!weapons.length) return <p className="text-dim py-8 text-center">리버스 무기 목록을 불러오는 중…</p>;
  return <Simulator weapons={weapons} />;
}

function Simulator({ weapons }: { weapons: Weapon[] }) {
  const [weaponId, setWeaponId] = useState(weapons[0].id);
  const selected = weapons.find((item) => item.id === weaponId) ?? weapons[0];
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [growthWeights, setGrowthWeights] = useState([...selected.levelWeights]);
  const weapon = useMemo(() => ({ ...selected, levelWeights: growthWeights }), [selected, growthWeights]);
  const visibleWeapons = weapons.filter(item => (!kind || item.kind === kind) && (item.name + item.kind).replace(/\s/g, "").includes(query.replace(/\s/g, "")));
  const [bonusWeights, setBonusWeights] = useState([...DEFAULT_BONUS_WEIGHTS]);
  const [targetAttack, setTargetAttack] = useState(weapon.baseAtk + 14);
  const [costPerAttempt, setCostPerAttempt] = useState(1);
  const [bestOf, setBestOf] = useState(10);
  const [batch, setBatch] = useState<BatchState>(EMPTY_BATCH);
  const [manual, setManual] = useState<ManualState>(() => emptyManual(weapon));
  const [showAssumptions, setShowAssumptions] = useState(false);

  const distribution = useMemo(
    () => [...attackDistribution(weapon, bonusWeights)].sort((a, b) => a[0] - b[0]),
    [weapon, bonusWeights],
  );

  const metrics = useMemo(() => {
    const expected = distribution.reduce((sum, [attack, probability]) => sum + attack * probability, 0);
    const variance = distribution.reduce((sum, [attack, probability]) => sum + ((attack - expected) ** 2) * probability, 0);
    const conditionalTargetP = distribution
      .filter(([attack]) => attack >= targetAttack)
      .reduce((sum, [, probability]) => sum + probability, 0);
    const perAttemptTargetP = (1 - CATALYST_DESTROY_RATE) * conditionalTargetP;

    const count = Math.max(1, Math.floor(bestOf || 1));
    let cdf = 0;
    let previousAllCdf = CATALYST_DESTROY_RATE ** count;
    let expectedBestTotal = 0;
    for (const [attack, probability] of distribution) {
      cdf += probability;
      const allCdf = (CATALYST_DESTROY_RATE + (1 - CATALYST_DESTROY_RATE) * cdf) ** count;
      expectedBestTotal += attack * (allCdf - previousAllCdf);
      previousAllCdf = allCdf;
    }
    const atLeastOneSuccess = 1 - CATALYST_DESTROY_RATE ** count;

    return {
      expected,
      deviation: Math.sqrt(variance),
      conditionalTargetP,
      perAttemptTargetP,
      expectedAttempts: perAttemptTargetP > 0 ? 1 / perAttemptTargetP : Infinity,
      expectedCost: perAttemptTargetP > 0 ? costPerAttempt / perAttemptTargetP : Infinity,
      expectedBest: atLeastOneSuccess > 0 ? expectedBestTotal / atLeastOneSuccess : 0,
      allDestroyedP: CATALYST_DESTROY_RATE ** count,
    };
  }, [bestOf, costPerAttempt, distribution, targetAttack]);

  const switchWeapon = (id: string) => {
    const next = weapons.find((item) => item.id === id) ?? weapons[0];
    setWeaponId(id);
    setGrowthWeights([...next.levelWeights]);
    setTargetAttack(next.baseAtk + 14);
    setBatch(EMPTY_BATCH);
    setManual(emptyManual(next));
  };

  const updateBonusWeight = (index: number, value: number) => {
    setBonusWeights((previous) => previous.map((weight, i) => i === index ? Math.max(0, value || 0) : weight));
    setBatch(EMPTY_BATCH);
    setManual(emptyManual(weapon));
  };

  const resetBonusWeights = () => {
    setBonusWeights([...DEFAULT_BONUS_WEIGHTS]);
    setGrowthWeights([...selected.levelWeights]);
    setBatch(EMPTY_BATCH);
    setManual(emptyManual(weapon));
  };

  const runBatch = (count: number) => {
    const results: CraftResult[] = [];
    for (let i = 0; i < count; i++) results.push(simulateCraft(weapon, bonusWeights));
    const attacks = results.flatMap((result) => result.attack === undefined ? [] : [result.attack]);
    setBatch((previous) => ({
      attempts: previous.attempts + count,
      successes: previous.successes + attacks.length,
      destroyed: previous.destroyed + count - attacks.length,
      best: attacks.length > 0 ? Math.max(previous.best ?? 0, ...attacks) : previous.best,
      recent: [...previous.recent, ...results].slice(-30),
    }));
  };

  const startManual = () => {
    if (Math.random() < CATALYST_DESTROY_RATE) {
      setManual({ ...emptyManual(weapon), phase: "destroyed", message: "촉매 판정으로 장비 제작에 실패했습니다." });
      return;
    }
    const bonus = rollWeighted(bonusWeights);
    setManual({
      ...emptyManual(weapon),
      phase: "level",
      attack: weapon.baseAtk + bonus,
      bonus,
      message: `제작 성공 · ${weapon.attackLabel} 보너스 +${bonus}`,
    });
  };

  const levelManual = () => {
    if (manual.phase !== "level") return;
    const attackGain = weapon.levelMin + rollWeighted(weapon.levelWeights);
    const mainGain = 1 + rollWeighted(LEVEL_MAIN_WEIGHTS);
    const subGain = rollWeighted(LEVEL_SUB_WEIGHTS);
    const levels = manual.levels + 1;
    setManual({
      ...manual,
      phase: levels >= 3 ? "scroll" : "level",
      attack: manual.attack + attackGain,
      main: manual.main + mainGain,
      sub: manual.sub + subGain,
      levels,
      message: `${levels}차 성장 · ${weapon.attackLabel} +${attackGain}, ${weapon.mainName} +${mainGain}, ${weapon.subName} +${subGain}`,
    });
  };

  const scrollManual = (rate: 60 | 10) => {
    if (manual.phase !== "scroll") return;
    const succeeded = Math.random() < rate / 100;
    const attackGain = succeeded ? (rate === 60 ? 2 : 5) : 0;
    const mainGain = succeeded ? (rate === 60 ? weapon.scroll60Main : weapon.scroll10Main) : 0;
    const scrolls = manual.scrolls + 1;
    setManual({
      ...manual,
      phase: scrolls >= 7 ? "complete" : "scroll",
      attack: manual.attack + attackGain,
      main: manual.main + mainGain,
      scrolls,
      message: `${rate}% 주문서 ${succeeded ? `성공 · ${weapon.attackLabel} +${attackGain}${mainGain ? `, ${weapon.mainName} +${mainGain}` : ""}` : "실패"}`,
    });
  };

  const maxProbability = Math.max(...distribution.map(([, probability]) => probability));
  const normalizedBonus = normalized(bonusWeights);

  return (
    <div className="space-y-5">
      <div className="pixel-panel p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-pixel text-sm text-ink">리버스 무기 제작 기대값</h2>
            <p className="text-xs text-dim mt-1">촉매 실패 판정 → 제작 보너스 → 3회 성장 → 무기 {weapon.attackLabel} 60% 주문서 7장을 순서대로 계산합니다.</p>
          </div>
          <button type="button" onClick={() => setShowAssumptions((value) => !value)} className="pixel-card px-3 py-1.5 font-pixel text-[11px] text-dim">
            {showAssumptions ? "확률 설정 닫기" : "확률 가정 보기·조정"}
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          <label className="text-xs text-dim">무기 검색 ({visibleWeapons.length}/{weapons.length}종)
            <input aria-label="리버스 무기 검색" placeholder="이름 또는 무기 종류" value={query} onChange={e => setQuery(e.target.value)} className="pixel-input w-full px-3 py-2 mt-1" />
          </label>
          <label className="text-xs text-dim">무기 종류
            <select aria-label="무기 종류" value={kind} onChange={e => setKind(e.target.value)} className="pixel-input w-full px-3 py-2 mt-1"><option value="">전체</option>{[...new Set(weapons.map(w => w.kind))].map(k => <option key={k}>{k}</option>)}</select>
          </label>
        </div>
        {!visibleWeapons.length && <p className="text-sm text-dim">검색 결과가 없습니다. 이름이나 종류를 바꿔 보세요.</p>}
        <div className="flex flex-wrap gap-1.5">
          {visibleWeapons.map((item) => {
            const active = weapon.id === item.id;
            return (
              <button key={item.id} type="button" aria-pressed={weapon.id === item.id} onClick={() => switchWeapon(item.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 border-2 text-xs transition-colors ${active ? "border-maple bg-[color-mix(in_srgb,var(--c-maple)_12%,transparent)] text-maple font-pixel" : "bg-surface2 border-edge text-dim hover:border-maple/60"}`}>
                <img
                  src={weaponIconUrl(item.itemId)}
                  alt=""
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                  className="w-6 h-6 object-contain [image-rendering:pixelated]"
                />
                <span>{item.name.replace("리버스 ", "")} <span className="opacity-60">{item.kind}</span></span>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-dim">선택: <b className="text-ink">{weapon.name}</b> · 기본 {weapon.attackLabel} {weapon.baseItemAtk} + 상급 보석 3 = {weapon.baseAtk} · {weapon.mainName}/{weapon.subName} 크리스탈 각 +5 가정. 성장 범위는 원작 참고이며 확률은 공식값이 아닙니다.</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-xs text-dim">
            목표 {weapon.attackLabel} 이상
            <input type="number" min={weapon.baseAtk} value={targetAttack} onChange={(event) => setTargetAttack(Number(event.target.value) || weapon.baseAtk)} className="pixel-input w-full px-3 py-2 mt-1 text-sm text-ink" />
          </label>
          <label className="text-xs text-dim">
            1회 제작 총비용 (억 메소)
            <input type="number" min="0" step="0.1" value={costPerAttempt} onChange={(event) => setCostPerAttempt(Math.max(0, Number(event.target.value) || 0))} className="pixel-input w-full px-3 py-2 mt-1 text-sm text-ink" />
          </label>
          <label className="text-xs text-dim">
            최고 기대값 비교 횟수
            <input type="number" min="1" max="10000" value={bestOf} onChange={(event) => setBestOf(Math.min(10000, Math.max(1, Math.floor(Number(event.target.value) || 1))))} className="pixel-input w-full px-3 py-2 mt-1 text-sm text-ink" />
          </label>
        </div>

        {showAssumptions && (
          <div className="border-t-2 border-edge pt-3 space-y-3">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-pixel text-[11px] text-ink">제작 {weapon.attackLabel} 보너스 가정 가중치</span>
                <button type="button" onClick={resetBonusWeights} className="text-[11px] text-maple underline">기본값 복원</button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {bonusWeights.map((weight, index) => (
                  <label key={index} className="text-[11px] text-dim text-center">
                    {weapon.attackLabel} +{index}
                    <input type="number" min="0" step="0.1" value={weight}
                      onChange={(event) => updateBonusWeight(index, Number(event.target.value))}
                      className="pixel-input w-full px-2 py-1.5 mt-1 text-center text-ink" />
                    <span className="block mt-0.5">정규화 {percent(normalizedBonus[index], 1)}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2"><p className="text-xs text-dim">성장 가중치 · 마력/너클/건은 균등 가정으로 시작합니다. 실측 확률이 아닙니다.</p><div className="flex gap-2">{growthWeights.map((weight, i) => <label key={i} className="text-xs text-dim">+{weapon.levelMin + i}<input aria-label={`성장 +${weapon.levelMin + i} 가중치`} type="number" min="0" value={weight} onChange={e => { setGrowthWeights(v => v.map((w, j) => j === i ? Math.max(0, Number(e.target.value) || 0) : w)); setBatch(EMPTY_BATCH); setManual(emptyManual(weapon)); }} className="pixel-input w-full px-2 py-1 mt-1" /></label>)}</div></div>
            <div className="grid sm:grid-cols-3 gap-2 text-[11px] text-dim">
              <div className="pixel-card p-2">촉매 제작 실패 <b className="text-ink">10%</b></div>
              <div className="pixel-card p-2">성장 {weapon.attackLabel} +{weapon.levelMin}~+{weapon.levelMin + weapon.levelWeights.length - 1}<br />확률 미공개 · 아래 가중치로 계산</div>
              <div className="pixel-card p-2">성장 주스탯 +1/+2 · 부스탯 +0/+1 <b className="text-ink">60/40%</b></div>
            </div>
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <Metric label={`완성품 기대 ${weapon.attackLabel}`} value={number(metrics.expected)} sub={`표준편차 ${number(metrics.deviation)}`} />
        <Metric label={`${weapon.attackLabel} ${targetAttack}+ · 1트 확률`} value={percent(metrics.perAttemptTargetP)} sub={`제작 성공 후 ${percent(metrics.conditionalTargetP)}`} />
        <Metric label="목표 기대 비용" value={Number.isFinite(metrics.expectedCost) ? `${number(metrics.expectedCost)}억` : "도달 불가"} sub={Number.isFinite(metrics.expectedAttempts) ? `평균 ${number(metrics.expectedAttempts)}회` : "확률 설정 확인"} />
        <Metric label={`${bestOf}회 중 최고 기대`} value={number(metrics.expectedBest)} sub={`전부 제작 실패 ${percent(metrics.allDestroyedP)}`} />
      </div>

      <div className="pixel-panel p-4">
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <h2 className="font-pixel text-sm text-ink">완성 {weapon.attackLabel} 분포</h2>
          <span className="text-[11px] text-dim">촉매 제작 실패 10% 제외 · 60% 주문서 7장 기준</span>
        </div>
        <div className="overflow-x-auto pb-1">
          <div className="flex items-end gap-1 h-36 min-w-max border-b-2 border-edge px-1">
            {distribution.map(([attack, probability]) => (
              <div key={attack} className="w-7 h-full flex flex-col justify-end items-center group" title={`${weapon.attackLabel} ${attack}: ${percent(probability)}`}>
                <span className="hidden group-hover:block text-[9px] text-maple mb-1">{(probability * 100).toFixed(1)}</span>
                <div className={`w-4 ${attack >= targetAttack ? "bg-maple" : "bg-edge"}`} style={{ height: `${Math.max(2, (probability / maxProbability) * 100)}%` }} />
                <span className="text-[9px] text-dim mt-1">{attack}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-dim mt-2">주황 막대는 목표 {weapon.attackLabel} 이상입니다. 기대값은 난수 실행이 아니라 각 단계의 확률 분포를 합성해 계산합니다.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="pixel-panel p-4 space-y-3">
          <div>
            <h2 className="font-pixel text-sm text-ink">일괄 제작 체험</h2>
            <p className="text-xs text-dim mt-1">모든 완성품에 60% 주문서 7장을 사용합니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[1, 10, 100, 1000].map((count) => (
              <button key={count} type="button" onClick={() => runBatch(count)} className="pixel-btn px-3 py-2 font-pixel text-xs">{count.toLocaleString()}회</button>
            ))}
            <button type="button" onClick={() => setBatch(EMPTY_BATCH)} className="pixel-card px-3 py-2 font-pixel text-xs text-dim">초기화</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-2 gap-2">
            <SmallStat label="시도" value={`${batch.attempts.toLocaleString()}회`} />
            <SmallStat label="완성" value={`${batch.successes.toLocaleString()}회`} />
            <SmallStat label="제작 실패" value={`${batch.destroyed.toLocaleString()}회`} />
            <SmallStat label={`최고 ${weapon.attackLabel}`} value={batch.best === null ? "-" : String(batch.best)} />
            <SmallStat label="누적 비용" value={`${number(batch.attempts * costPerAttempt)}억`} />
          </div>
          {batch.recent.length > 0 && (
            <div className="flex flex-wrap gap-1 border-t border-edge pt-2">
              {batch.recent.map((result, index) => (
                <span key={`${batch.attempts}-${index}`} className={`px-1.5 py-0.5 text-[10px] border ${result.destroyed ? "border-red-300 text-red-500" : (result.attack ?? 0) >= targetAttack ? "border-maple text-maple" : "border-edge text-dim"}`}>
                  {result.destroyed ? "실패" : `${weapon.attackLabel} ${result.attack}`}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="pixel-panel p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-pixel text-sm text-ink">단계별 제작 체험</h2>
              <p className="text-xs text-dim mt-1">성장 후 주문서 60% 또는 10%를 직접 선택합니다.</p>
            </div>
            <button type="button" onClick={() => setManual(emptyManual(weapon))} className="text-[11px] text-dim underline">리셋</button>
          </div>
          <div className={`pixel-card p-3 flex items-start gap-3 ${manual.phase === "destroyed" ? "border-red-400" : ""}`}>
            <div className={`w-12 h-12 flex items-center justify-center border-2 bg-surface2 shrink-0 ${manual.phase === "destroyed" ? "border-red-400" : "border-edge"}`}>
              {manual.phase === "destroyed" ? (
                <span className="text-red-500 text-xl leading-none">✕</span>
              ) : (
                <img
                  src={weaponIconUrl(weapon.itemId)}
                  alt=""
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                  className="w-9 h-9 object-contain [image-rendering:pixelated]"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm">{manual.phase === "destroyed" ? "제작 실패 — 재료 소멸" : weapon.name}</div>
              {manual.phase !== "destroyed" && (
                <div className="flex flex-wrap gap-x-3 text-xs mt-1">
                  <b className="text-maple">{weapon.attackLabel} {manual.attack}</b>
                  <span>{weapon.mainName} {manual.main}</span>
                  <span>{weapon.subName} {manual.sub}</span>
                  <span className="text-dim">성장 {manual.levels}/3 · 주문서 {manual.scrolls}/7</span>
                </div>
              )}
              <p className="text-[11px] text-dim mt-2 min-h-4">{manual.message}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(manual.phase === "ready" || manual.phase === "destroyed" || manual.phase === "complete") && (
              <button type="button" onClick={startManual} className="pixel-btn px-4 py-2 font-pixel text-xs">새로 제작</button>
            )}
            {manual.phase === "level" && (
              <button type="button" onClick={levelManual} className="pixel-btn px-4 py-2 font-pixel text-xs">{manual.levels + 1}차 성장</button>
            )}
            {manual.phase === "scroll" && (
              <>
                <button type="button" onClick={() => scrollManual(60)} className="pixel-btn px-4 py-2 font-pixel text-xs">{weapon.attackLabel} 60%</button>
                <button type="button" onClick={() => scrollManual(10)} className="pixel-card px-4 py-2 font-pixel text-xs text-maple">{weapon.attackLabel} 10%</button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="text-[11px] text-dim bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2 leading-relaxed">
        ⚠️ 제작 보너스·성장 확률은 공식 공개값이 아니라 계산 가정입니다. 무기별 원작 성장 범위를 사용하며, 특히 마력·너클·건의 기본 성장 가중치는 균등 가정입니다. 게임 패치나 표본에 따라 실제 결과와 다를 수 있습니다. 규칙과 확률 가정은 윌키의{` `}
        <a href="https://www.youtube.com/watch?v=z9_H63k_ypM" target="_blank" rel="noopener noreferrer" className="underline text-maple">리버스 제작 영상</a> 및{` `}
        <a href="https://drive.google.com/drive/folders/1Ce2BPTzDKPQGnIiaL0maSzCASb1zj7K2?usp=sharing" target="_blank" rel="noopener noreferrer" className="underline text-maple">공개 시뮬레이터 자료</a>를 참고했으며, 이 도구의 코드와 계산 로직은 사이트용으로 독립 구현했습니다.
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
