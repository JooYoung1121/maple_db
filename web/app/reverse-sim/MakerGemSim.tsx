"use client";

/* 메이커 보석 가공·장비 제작 시뮬 — /maker 의 '보석 시뮬' 탭에 있던 코드를 v4.13.0에서
 * 시뮬레이터 메뉴(/reverse-sim)로 옮겼다. 확률 가정·수수료 출처는 MakerData(meta) 그대로. */

import { useMemo, useState } from "react";
import type { MakerData, MakerEquipGrade } from "@/lib/types";

type Grade = "하급" | "중급" | "상급";
const won = (n: number) => n.toLocaleString("ko-KR");

/* ─────────────────────────── 시뮬레이터 탭 ─────────────────────────── */
export default function MakerGemSim({ data }: { data: MakerData }) {
  const [mode, setMode] = useState<"gem" | "equip">("gem");
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([["gem", "보석 가공"], ["equip", "장비 제작"]] as [typeof mode, string][]).map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-3 py-1.5 text-sm border-2 ${mode === m ? "pixel-btn font-pixel" : "font-pixel bg-surface2 border-edge text-dim"}`}>
            {label}
          </button>
        ))}
      </div>
      {mode === "gem" ? <GemSim data={data} /> : <EquipSim data={data} />}
    </div>
  );
}

const GRADE_STYLE: Record<Grade, string> = {
  하급: "bg-surface2 text-dim",
  중급: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  상급: "bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] text-maple font-bold",
};

function rollGrade(grades: Record<string, number>): Grade {
  const r = Math.random();
  let acc = 0;
  for (const g of ["상급", "중급", "하급"] as Grade[]) {
    acc += grades[g] ?? 0;
    if (r < acc) return g;
  }
  return "하급";
}

function GemSim({ data }: { data: MakerData }) {
  const fee = data.gem_process.fee;
  const grades = data.gem_process.grades;
  const [target, setTarget] = useState<Grade>("상급");
  const [priceInput, setPriceInput] = useState("");  // 원석 시세 — 문자열로 보관해 지워도 안전
  const [log, setLog] = useState<Grade[]>([]);

  const gemPrice = Math.max(0, parseInt(priceInput.replace(/[^0-9]/g, ""), 10) || 0);
  const p = grades[target] ?? 0;
  const costPerTry = fee + gemPrice;

  const counts = useMemo(() => {
    const c: Record<Grade, number> = { 하급: 0, 중급: 0, 상급: 0 };
    for (const g of log) c[g]++;
    return c;
  }, [log]);
  const attempts = log.length;
  const firstHit = log.indexOf(target); // -1이면 아직
  const totalCost = attempts * costPerTry;

  const roll = (n: number) => {
    const next: Grade[] = [];
    for (let i = 0; i < n; i++) next.push(rollGrade(grades));
    setLog((prev) => [...prev, ...next]);
  };
  const rollUntilTarget = () => {
    const next: Grade[] = [];
    for (let i = 0; i < 1000; i++) {
      const g = rollGrade(grades);
      next.push(g);
      if (g === target) break;
    }
    setLog((prev) => [...prev, ...next]);
  };

  return (
    <div className="space-y-4">
      <div className="pixel-panel p-4 space-y-4">
        {/* 설정 */}
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="block text-dim mb-1">목표 등급</span>
            <div className="flex gap-1">
              {(["하급", "중급", "상급"] as Grade[]).map((g) => (
                <button key={g} onClick={() => setTarget(g)}
                  className={`px-3 py-1.5 border-2 text-sm ${target === g ? "pixel-btn font-pixel" : "bg-surface2 border-edge text-dim"}`}>
                  {g} <span className="text-xs opacity-70">{((grades[g] ?? 0) * 100).toFixed(0)}%</span>
                </button>
              ))}
            </div>
          </label>
          <label className="text-sm">
            <span className="block text-dim mb-1">원석(일반 보석) 시세 — 1개당 메소</span>
            <input type="text" inputMode="numeric" placeholder="예: 1000000" value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              className="pixel-input w-36 px-3 py-1.5 text-sm" />
          </label>
        </div>
        <div className="text-xs text-dim">
          1회 비용 = 수수료 {won(fee)} {gemPrice > 0 && <>+ 원석 {won(gemPrice)}</>} = <b>{won(costPerTry)} 메소</b>
          {p > 0 && <> · {target} 1개 기대: 약 {Math.ceil(1 / p)}회 / {won(Math.round(costPerTry / p))} 메소</>}
        </div>

        {/* 가공 버튼 */}
        <div className="flex flex-wrap gap-2">
          {[1, 10, 100].map((n) => (
            <button key={n} onClick={() => roll(n)}
              className="pixel-btn font-pixel px-4 py-2 text-sm">
              {n}회 가공
            </button>
          ))}
          <button onClick={rollUntilTarget}
            className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold">
            {target} 나올 때까지
          </button>
          <button onClick={() => setLog([])}
            className="px-4 py-2 border-2 border-edge bg-surface2 text-sm text-dim">
            초기화
          </button>
        </div>

        {/* 결과 */}
        {attempts > 0 && (
          <div className="bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] border-2 border-edge p-3 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <Stat label="총 가공 횟수" value={`${attempts}회`} />
              <Stat label="결과" value={`하급 ${counts.하급} · 중급 ${counts.중급} · 상급 ${counts.상급}`} />
              <Stat label="총 비용 (수수료+원석)" value={`${won(totalCost)} 메소`} />
              <Stat
                label={`첫 ${target}`}
                value={firstHit >= 0 ? `${firstHit + 1}번째 (${won((firstHit + 1) * costPerTry)} 메소)` : "아직 ❌"}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {log.slice(-40).map((g, i) => (
                <span key={i} className={`px-1.5 py-0.5 rounded text-xs ${GRADE_STYLE[g]}`}>{g}</span>
              ))}
              {attempts > 40 && <span className="text-xs text-dim self-center">… 최근 40개만 표시</span>}
            </div>
          </div>
        )}

        {/* 제련 안내 */}
        <div className="text-xs text-dim border-t border-edge/40 pt-2">
          상위 등급 제련: 동일 하급 10개 + {won(data.gem_refine[0]?.fee ?? 330000)} 메소 → 중급, 동일 중급 10개 + {won(data.gem_refine[1]?.fee ?? 550000)} 메소 → 상급 (성공률 미공개)
        </div>
        <p className="text-xs text-dim">
          ※ 수수료({won(fee)} 등)는 2.0 기준 확인값이지만, 등급 확률(하급 {((grades["하급"] ?? 0) * 100).toFixed(0)}% / 중급 {((grades["중급"] ?? 0) * 100).toFixed(0)}% / 상급 {((grades["상급"] ?? 0) * 100).toFixed(0)}%)은 <b>공식 미공개 커뮤니티 추정치</b>라 실제와 다를 수 있습니다.
        </p>
      </div>
    </div>
  );
}

function EquipSim({ data }: { data: MakerData }) {
  const [name, setName] = useState(data.equipment[0]?.name ?? "");
  const [grade, setGrade] = useState<"reverse" | "timeless">("timeless");
  const e = data.equipment.find((x) => x.name === name);
  const g: MakerEquipGrade | undefined = e?.[grade];

  return (
    <div className="pixel-panel p-4 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-dim mb-1">장비</span>
          <select value={name} onChange={(ev) => setName(ev.target.value)}
            className="pixel-input px-3 py-1.5 text-sm max-w-[14rem]">
            {data.equipment.map((x) => <option key={x.name} value={x.name}>{x.job} · {x.slot} · {x.name}</option>)}
          </select>
        </label>
        <div className="flex gap-1">
          {(["reverse", "timeless"] as const).map((gr) => (
            <button key={gr} disabled={!e?.[gr]} onClick={() => setGrade(gr)}
              className={`px-3 py-1.5 border-2 text-sm disabled:opacity-30 ${grade === gr ? "pixel-btn font-pixel" : "bg-surface2 border-edge text-dim"}`}>
              {gr === "reverse" ? "리버스" : "타임리스"}
            </button>
          ))}
        </div>
      </div>

      {g ? (
        <div className="space-y-2">
          <div className="text-sm">
            <span className="text-dim">옵션: </span>
            {Object.entries(g.stats).map(([k, v]) => `${k} +${v}`).join(", ")}
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-dim border-b border-edge"><th className="py-1.5">재료</th><th className="text-right">수량</th></tr></thead>
            <tbody>
              {g.materials.map((m) => (
                <tr key={m.name} className="border-b border-edge/40">
                  <td className="py-1.5">{m.name}{m.note && <span className="text-xs text-dim"> ({m.note})</span>}</td>
                  <td className="text-right">{m.qty}</td>
                </tr>
              ))}
              <tr className="font-bold"><td className="py-1.5">제작 수수료(메소)</td><td className="text-right text-maple">{won(g.fee)}</td></tr>
            </tbody>
          </table>
          <p className="text-xs text-dim">
            ※ 몬스터 결정류 재료는 각 1개당 전리품 100개가 추가로 필요합니다. (재료 획득 탭 참고)
          </p>
        </div>
      ) : <p className="text-sm text-dim">해당 등급 제작 정보가 없습니다.</p>}
    </div>
  );
}


function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-pixel text-xs text-dim">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}
