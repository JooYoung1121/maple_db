"use client";

import { useMemo, useState } from "react";
import { EXP_TABLE } from "@/lib/expTable";

// 등급별 최고 효율 맵 기준 클리어 경험치 (길드원 실측 계산기 이식)
const DUNGEONS = [
  { name: "까막산", tier: "초급", min: 50, max: 70, exp: 628_260 },
  { name: "자동경비구역", tier: "중급", min: 71, max: 100, exp: 4_347_000 },
  { name: "용의 둥지", tier: "고급", min: 101, max: 119, exp: 9_434_000 },
];

// 버닝 월드 종료: 2026-09-11(금) 05:59 KST
const EVENT_END = new Date("2026-09-11T05:59:00+09:00");
const TICKETS_PER_DAY = 2;

function dungeonFor(level: number) {
  return DUNGEONS.find((d) => level >= d.min && level <= d.max) || null;
}

export default function MonsterParkCalc() {
  const [levelStr, setLevelStr] = useState("74");
  const [expStr, setExpStr] = useState("");

  const result = useMemo(() => {
    const level = Number(levelStr);
    const curExp = Math.max(0, Number(expStr.replace(/[,\s]/g, "")) || 0);
    if (!Number.isInteger(level) || level < 50 || level > 119) return null;

    const cur = dungeonFor(level)!;
    const needThisLevel = Math.max(0, EXP_TABLE[level] - curExp);
    const perDungeon = new Map<string, number>(DUNGEONS.map((d) => [d.name, 0]));

    let total = needThisLevel / cur.exp;
    perDungeon.set(cur.name, total);
    for (let lv = level + 1; lv <= 119; lv++) {
      const d = dungeonFor(lv)!;
      const runs = EXP_TABLE[lv] / d.exp;
      total += runs;
      perDungeon.set(d.name, (perDungeon.get(d.name) || 0) + runs);
    }

    const ceilRuns = Math.ceil(total);
    const daysNeeded = ceilRuns / TICKETS_PER_DAY;
    const finishDate = new Date(Date.now() + daysNeeded * 86400_000);
    const daysLeft = Math.max(0, Math.ceil((EVENT_END.getTime() - Date.now()) / 86400_000));
    const ticketsLeft = daysLeft * TICKETS_PER_DAY;

    return {
      level, cur, needThisLevel,
      runsThisLevel: needThisLevel / cur.exp,
      total, ceilRuns, daysNeeded, finishDate, daysLeft, ticketsLeft,
      perDungeon,
      feasible: ceilRuns <= ticketsLeft,
      perDayNeeded: daysLeft > 0 ? ceilRuns / daysLeft : Infinity,
    };
  }, [levelStr, expStr]);

  const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return (
    <section className="pixel-panel p-4 border-maple">
      <h2 className="font-pixel text-sm text-maple mb-1">🧮 남은 횟수 계산기 — 120레벨까지</h2>
      <p className="text-[11px] text-dim mb-3">
        길드원 실측 계산기 이식 · 등급별 최고 효율 맵(까막산·자동경비구역·용의 둥지) 기준
      </p>

      <div className="flex flex-wrap gap-3 mb-4">
        <label className="text-sm text-ink flex items-center gap-2">
          현재 레벨
          <input
            type="number" min={50} max={119} value={levelStr}
            onChange={(e) => setLevelStr(e.target.value)}
            className="pixel-input w-20 px-2 py-1.5 text-center"
          />
        </label>
        <label className="text-sm text-ink flex items-center gap-2">
          현재 경험치
          <input
            inputMode="numeric" value={expStr} placeholder="0"
            onChange={(e) => setExpStr(e.target.value)}
            className="pixel-input w-36 px-2 py-1.5 text-right"
          />
        </label>
      </div>

      {!result ? (
        <p className="text-sm text-dim">레벨은 50~119 사이로 입력하세요.</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="bg-surface2 border-2 border-edge p-2.5">
              <div className="text-[11px] text-dim">현재 던전</div>
              <div className="font-medium text-ink">{result.cur.name} <span className="text-[11px] text-dim">({result.cur.tier})</span></div>
            </div>
            <div className="bg-surface2 border-2 border-edge p-2.5">
              <div className="text-[11px] text-dim">이번 레벨 남은 횟수</div>
              <div className="font-medium text-ink">{result.runsThisLevel.toFixed(2)}회</div>
            </div>
            <div className="bg-surface2 border-2 border-edge p-2.5">
              <div className="text-[11px] text-dim">120까지 총 필요</div>
              <div className="font-medium text-maple">{result.ceilRuns}회 <span className="text-[11px] text-dim">({result.total.toFixed(1)})</span></div>
            </div>
            <div className="bg-surface2 border-2 border-edge p-2.5">
              <div className="text-[11px] text-dim">하루 2회 기준</div>
              <div className="font-medium text-ink">{Math.ceil(result.daysNeeded)}일 · {fmtDate(result.finishDate)} 달성</div>
            </div>
          </div>

          <div className={`border-2 p-3 text-sm ${result.feasible ? "border-green-600/60 bg-green-600/10" : "border-red-500/60 bg-red-500/10"}`}>
            {result.feasible ? (
              <>✅ <b>달성 가능</b> — 이벤트 종료(9/11 05:59)까지 {result.daysLeft}일, 티켓 최대 {result.ticketsLeft}매 &gt; 필요 {result.ceilRuns}회.
                하루 평균 <b>{result.perDayNeeded.toFixed(1)}회</b>만 돌면 됩니다.</>
            ) : (
              <>⚠️ <b>티켓 부족</b> — 남은 {result.daysLeft}일 동안 티켓을 다 써도 최대 {result.ticketsLeft}회로, 필요 {result.ceilRuns}회에 못 미칩니다.
                도달 가능 지점까지만 계산하거나 사냥 병행이 필요해요.</>
            )}
          </div>

          <div>
            <div className="font-pixel text-xs text-ink mb-1.5">🗺️ 던전별 남은 횟수</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              {DUNGEONS.map((d) => {
                const runs = result.perDungeon.get(d.name) || 0;
                return (
                  <div key={d.name} className="bg-surface2 border-2 border-edge p-2.5 flex items-center justify-between">
                    <span className="text-ink">{d.name} <span className="text-[11px] text-dim">Lv.{d.min}~{d.max}</span></span>
                    <span className={runs > 0 ? "font-medium text-maple" : "text-dim"}>{runs > 0 ? `${runs.toFixed(1)}회` : "-"}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-[11px] text-dim">
            ※ 하루 티켓 2매(계정당 1캐릭터) 기준. 던전 전환 레벨 부근에서는 남은 경험치 반올림 오차가 있을 수 있습니다.
            같은 등급이라도 다른 맵을 돌면 횟수가 늘어납니다 (아래 맵별 경험치 표 참고).
          </p>
        </div>
      )}
    </section>
  );
}
