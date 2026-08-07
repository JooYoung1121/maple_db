"use client";

import { useMemo, useState } from "react";

type Mode = "solo" | "party";

type Target = {
  stage: number;
  floor: number;
  boss: string;
  solo: number;
  party: number;
  note: string;
};

const TARGETS: Target[] = [
  { stage: 5, floor: 5, boss: "대왕지네", solo: 10, party: 5, note: "5분 구간" },
  { stage: 10, floor: 11, boss: "타이머", solo: 25, party: 15, note: "6분 구간까지" },
  { stage: 15, floor: 17, boss: "데비존", solo: 45, party: 30, note: "7분 구간까지" },
  { stage: 20, floor: 23, boss: "주니어 발록", solo: 70, party: 50, note: "8분 구간까지" },
  { stage: 25, floor: 29, boss: "스노우맨", solo: 100, party: 75, note: "9분 구간까지" },
  { stage: 27, floor: 32, boss: "크림슨 발록", solo: 114, party: 87, note: "점수런 권장선" },
  { stage: 30, floor: 35, boss: "레비아탄", solo: 135, party: 105, note: "10분 구간 완료" },
  { stage: 32, floor: 38, boss: "무공", solo: 151, party: 119, note: "최상층 완주" },
];

const BELTS = [
  { name: "흰색 허리띠", points: 200 },
  { name: "노란색 허리띠", points: 1800 },
  { name: "파란색 허리띠", points: 4000 },
  { name: "빨간색 허리띠", points: 9200 },
  { name: "검은색 허리띠", points: 17000 },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

export default function DojoCalculator() {
  const [mode, setMode] = useState<Mode>("solo");
  const [targetIndex, setTargetIndex] = useState(5);
  const [minutes, setMinutes] = useState(8);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [runsPerDay, setRunsPerDay] = useState(10);

  const result = useMemo(() => {
    const target = TARGETS[targetIndex];
    const score = mode === "solo" ? target.solo : target.party;
    const safeMinutes = clamp(minutes, 0.5, 180);
    const safeCurrent = clamp(currentPoints, 0, 17000);
    const safeRuns = Math.round(clamp(runsPerDay, 1, 1000));
    const remaining = Math.max(0, 17000 - safeCurrent);
    const runs = score > 0 ? Math.ceil(remaining / score) : 0;
    const hours = runs * safeMinutes / 60;
    const days = safeRuns > 0 ? Math.ceil(runs / safeRuns) : 0;
    const fullScore = mode === "solo" ? 151 : 119;
    const nextTarget = TARGETS[targetIndex + 1];
    const nextScore = nextTarget ? (mode === "solo" ? nextTarget.solo : nextTarget.party) : null;
    const breakEvenMinutes = nextScore === null ? null : safeMinutes * (nextScore - score) / score;
    const nextBelt = BELTS.find((belt) => belt.points > safeCurrent) ?? BELTS[BELTS.length - 1];
    const nextBeltRuns = Math.ceil(Math.max(0, nextBelt.points - safeCurrent) / score);

    return {
      target, score, safeMinutes, safeCurrent, safeRuns, runs, hours, days,
      fullShare: score / fullScore * 100,
      perHour: score / safeMinutes * 60,
      nextTarget, breakEvenMinutes, nextBelt, nextBeltRuns,
    };
  }, [mode, targetIndex, minutes, currentPoints, runsPerDay]);

  return (
    <section className="pixel-panel p-5 space-y-4" id="calculator">
      <div>
        <h2 className="font-pixel text-base text-ink">🧮 수련 점수 효율 계산기</h2>
        <p className="text-xs text-dim mt-1">
          직업·스펙에 따라 실제 시간이 크게 달라집니다. 목표 보스와 본인의 실측 한 판 시간을 넣어 계산하세요.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-4">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(["solo", "party"] as Mode[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={`px-3 py-2 font-pixel text-xs border-2 transition-colors ${mode === item ? "border-maple bg-maple/10 text-maple" : "border-edge text-dim"}`}
              >
                {item === "solo" ? "혼자 점수런" : "파티 점수런"}
              </button>
            ))}
          </div>

          <label className="block text-xs text-dim">
            종료 목표
            <select
              value={targetIndex}
              onChange={(event) => setTargetIndex(Number(event.target.value))}
              className="pixel-input w-full mt-1 px-3 py-2 text-sm text-ink"
            >
              {TARGETS.map((target, index) => (
                <option key={target.stage} value={index}>
                  {target.floor}층 {target.boss} · {mode === "solo" ? target.solo : target.party}P · {target.note}
                </option>
              ))}
            </select>
          </label>

          <div className="grid sm:grid-cols-3 gap-2">
            <NumberField label="한 판 실측 시간(분)" value={minutes} min={0.5} max={180} step={0.5} onChange={setMinutes} />
            <NumberField label="현재 누적 점수" value={currentPoints} min={0} max={17000} step={1} onChange={setCurrentPoints} />
            <NumberField label="하루 목표 판수" value={runsPerDay} min={1} max={1000} step={1} onChange={setRunsPerDay} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <ResultCard label="한 판 점수" value={`${result.score}P`} note={`전체의 ${result.fullShare.toFixed(1)}%`} />
          <ResultCard label="시간당 점수" value={`${Math.round(result.perHour).toLocaleString()}P`} note={`${result.safeMinutes}분 실측 기준`} />
          <ResultCard label="검은 띠까지" value={`${result.runs.toLocaleString()}판`} note={`순수 플레이 약 ${result.hours.toFixed(1)}시간`} />
          <ResultCard label="예상 일수" value={`${result.days.toLocaleString()}일`} note={`하루 ${result.safeRuns}판 기준`} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-2 text-xs">
        <div className="pixel-card p-3">
          <b className="text-ink">다음 보상: {result.nextBelt.name}</b>
          <p className="text-dim mt-1">
            현재 {result.safeCurrent.toLocaleString()}P에서 {result.nextBelt.points.toLocaleString()}P까지 이 코스로 {result.nextBeltRuns.toLocaleString()}판 필요합니다.
          </p>
        </div>
        <div className="pixel-card p-3">
          <b className="text-ink">더 깊게 갈 손익분기</b>
          {result.nextTarget && result.breakEvenMinutes !== null ? (
            <p className="text-dim mt-1">
              {result.nextTarget.floor}층 {result.nextTarget.boss}까지 추가 시간이 <b className="text-maple">{result.breakEvenMinutes.toFixed(1)}분 이하</b>면 현재 코스보다 점수/시간 효율이 좋아집니다.
            </p>
          ) : (
            <p className="text-dim mt-1">최상층 완주 코스입니다. 점수 효율보다 훈장·기록 도전 목적에 맞습니다.</p>
          )}
        </div>
      </div>

      <p className="text-[11px] text-dim leading-relaxed">
        ※ 누적 점수는 허리띠 교환 후에도 유지되는 방식으로 계산합니다. 다음 허리띠는 이전 단계 허리띠를 먼저 받아야 합니다.
        일일 입장 제한은 공식 패치노트에 별도 표기되지 않았으므로 계산기에서는 판수를 자유롭게 입력합니다.
      </p>
    </section>
  );
}

function NumberField({ label, value, min, max, step, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-xs text-dim">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="pixel-input w-full mt-1 px-3 py-2 text-sm text-ink"
      />
    </label>
  );
}

function ResultCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="pixel-card p-3">
      <div className="font-pixel text-[10px] text-dim">{label}</div>
      <div className="font-bold text-lg text-maple mt-1">{value}</div>
      <div className="text-[11px] text-dim mt-0.5">{note}</div>
    </div>
  );
}
