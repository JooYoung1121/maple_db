"use client";

import { useState, useEffect, useMemo } from "react";
import { getMakerData, getMakerMaterialSources } from "@/lib/api";
import type { MakerData, MakerEquipment, MakerEquipGrade, MakerMobSource } from "@/lib/types";

type Tab = "info" | "sim" | "material";
type Grade = "하급" | "중급" | "상급";

const won = (n: number) => n.toLocaleString("ko-KR");

/* 음이항분포 몬테카를로: 확률 p 사건을 need번 성공할 때까지의 시도 횟수 분포 */
function simulateAttempts(p: number, need: number, trials = 20000): number[] {
  const results: number[] = [];
  for (let t = 0; t < trials; t++) {
    let success = 0;
    let attempts = 0;
    // 안전장치: 너무 큰 경우 컷
    while (success < need && attempts < 2_000_000) {
      attempts++;
      if (Math.random() < p) success++;
    }
    results.push(attempts);
  }
  results.sort((a, b) => a - b);
  return results;
}
const percentile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];

export default function MakerPage() {
  const [tab, setTab] = useState<Tab>("info");
  const [data, setData] = useState<MakerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMakerData()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-4xl mx-auto py-10 text-center text-gray-500">불러오는 중...</div>;
  if (!data) return <div className="max-w-4xl mx-auto py-10 text-center text-gray-500">메이커 데이터를 불러올 수 없습니다.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">메이커 (전문기술)</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          메이플랜드 2.0(테스피아)에 추가되는 메이커 제작 정보·시뮬레이터·재료 획득 가이드입니다.
        </p>
      </div>

      {/* 디스클레이머 */}
      <div className="text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300 rounded-lg px-3 py-2">
        ⚠️ {data.meta.note} · 출처:{" "}
        {data.meta.sources.slice(0, 3).map((s, i) => (
          <a key={s} href={s} target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-900 dark:hover:text-amber-100">
            [{i + 1}]
          </a>
        ))}
      </div>

      {/* 탭 */}
      <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        {([["info", "제작 정보"], ["sim", "시뮬레이터"], ["material", "재료 획득"]] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
              tab === t ? "bg-orange-500 text-white" : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-orange-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "info" && <InfoTab data={data} />}
      {tab === "sim" && <SimTab data={data} />}
      {tab === "material" && <MaterialTab data={data} />}
    </div>
  );
}

/* ─────────────────────────── 제작 정보 탭 ─────────────────────────── */
function InfoTab({ data }: { data: MakerData }) {
  const jobs = useMemo(() => ["전체", ...Array.from(new Set(data.equipment.map((e) => e.job)))], [data]);
  const [job, setJob] = useState("전체");
  const equips = data.equipment.filter((e) => job === "전체" || e.job === job);

  return (
    <div className="space-y-6">
      {data.meta.tespia_functions && data.meta.tespia_functions.length > 0 && (
        <Section title="테스피아 메이커 기능">
          <div className="flex flex-wrap gap-1.5">
            {data.meta.tespia_functions.map((f) => (
              <span key={f} className="px-2.5 py-1 text-xs rounded-full bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 text-sky-700 dark:text-sky-300">{f}</span>
            ))}
          </div>
        </Section>
      )}

      {/* 스킬 습득 */}
      <Section title="스킬 습득 (스탠 NPC)">
        <div className="grid sm:grid-cols-3 gap-3">
          {data.skill_quests.map((q) => (
            <div key={q.skill_level} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="text-xs text-orange-500 font-bold">메이커 Lv.{q.skill_level}</div>
              <div className="font-bold text-sm mt-0.5">{q.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">필요 레벨 {q.req_level}</div>
              {q.cost_meso > 0 && <div className="text-xs text-gray-500">메소 {won(q.cost_meso)}</div>}
              {q.materials.map((m) => (
                <div key={m.name} className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                  · {m.name} ×{m.qty}
                  {m.note && <span className="text-gray-400"> ({m.note})</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Section>

      {/* 보석/크리스탈 스탯 */}
      <Section title="보석 · 크리스탈 능력치 (하급 / 중급 / 상급)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 pr-3">이름</th><th className="pr-3">능력치</th>
                <th className="pr-3 text-center">하급</th><th className="pr-3 text-center">중급</th><th className="text-center">상급</th>
              </tr>
            </thead>
            <tbody>
              {data.gems.map((g) => (
                <tr key={g.name} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-1.5 pr-3 font-medium">{g.name}{g.weapon_only && <span className="ml-1 text-[10px] text-red-400">무기전용</span>}</td>
                  <td className="pr-3 text-gray-600 dark:text-gray-300">{g.stat}</td>
                  <td className="pr-3 text-center">{g.values["하급"] ?? "-"}</td>
                  <td className="pr-3 text-center">{g.values["중급"] ?? "-"}</td>
                  <td className="text-center">{g.values["상급"] ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 몬스터 결정 */}
      <Section title="몬스터 결정 (전리품 100개 → 1개)">
        <div className="grid grid-cols-3 gap-2 text-sm">
          {data.monster_crystals.map((c) => (
            <div key={c.grade + c.sub} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-center">
              <div className="font-bold">{c.grade} {c.sub}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Lv.{c.level_min}~{c.level_max}</div>
              <div className="text-[11px] text-gray-400">전리품 {c.loot_qty}개</div>
            </div>
          ))}
        </div>
      </Section>

      {/* 주문서 */}
      <Section title="제작 주문서">
        <div className="grid sm:grid-cols-2 gap-3">
          {data.scrolls.map((s) => (
            <div key={s.name} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="font-bold text-sm">{s.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{s.effect}</div>
              <div className="text-xs text-gray-600 dark:text-gray-300 mt-1.5">
                {s.materials.map((m) => <div key={m.name}>· {m.name} ×{m.qty}</div>)}
                <div>· 메소 {won(s.fee)}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 장비 */}
      <Section title="장비 제작 (리버스 / 타임리스)">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {jobs.map((j) => (
            <button key={j} onClick={() => setJob(j)}
              className={`px-2.5 py-1 text-xs rounded-full border ${job === j ? "bg-orange-500 text-white border-orange-500" : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"}`}>
              {j}
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {equips.map((e) => <EquipCard key={e.name} e={e} />)}
        </div>
      </Section>
    </div>
  );
}

function EquipCard({ e }: { e: MakerEquipment }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <div className="flex items-baseline justify-between">
        <span className="font-bold text-sm">{e.name}</span>
        <span className="text-xs text-gray-400">{e.job} · {e.slot}</span>
      </div>
      {(["reverse", "timeless"] as const).map((g) => {
        const grade = e[g];
        if (!grade) return null;
        return (
          <div key={g} className="mt-2 border-t border-gray-100 dark:border-gray-800 pt-1.5">
            <div className="text-xs font-bold text-orange-500">{g === "reverse" ? "리버스" : "타임리스"}</div>
            <div className="text-[11px] text-gray-600 dark:text-gray-300">
              {Object.entries(grade.stats).map(([k, v]) => `${k} +${v}`).join(", ")}
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              {grade.materials.map((m) => `${m.name}×${m.qty}`).join(" · ")} · 메소 {won(grade.fee)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── 시뮬레이터 탭 ─────────────────────────── */
function SimTab({ data }: { data: MakerData }) {
  const [mode, setMode] = useState<"gem" | "equip">("gem");
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([["gem", "보석 가공"], ["equip", "장비 제작"]] as [typeof mode, string][]).map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-3 py-1.5 text-sm rounded-lg border ${mode === m ? "bg-orange-500 text-white border-orange-500" : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"}`}>
            {label}
          </button>
        ))}
      </div>
      {mode === "gem" ? <GemSim data={data} /> : <EquipSim data={data} />}
    </div>
  );
}

function GemSim({ data }: { data: MakerData }) {
  const fee = data.gem_process.fee;
  const grades = data.gem_process.grades;
  const [target, setTarget] = useState<Grade>("상급");
  const [qty, setQty] = useState(1);
  const [useRefine, setUseRefine] = useState(false);
  const [refineRate, setRefineRate] = useState(100); // 성공률(%) — 미확정, 사용자 조정

  const p = grades[target] ?? 0;
  const safeQty = Math.max(1, Math.min(999, qty || 1));

  const sim = useMemo(() => (p > 0 ? simulateAttempts(p, safeQty) : []), [p, safeQty]);

  // 직접 가공 경로
  const expAttempts = p > 0 ? safeQty / p : 0;
  const expMeso = expAttempts * fee;

  // 제련 경로(상급 목표일 때만 의미): 가공으로 하급 확보 → 33만으로 중급 → 55만으로 상급
  const refine = data.gem_refine;
  const refinePath = useMemo(() => {
    if (target !== "상급") return null;
    const r1 = refine.find((r) => r.to === "중급"); // 하급10→중급1
    const r2 = refine.find((r) => r.to === "상급"); // 중급10→상급1
    if (!r1 || !r2) return null;
    const rate = Math.max(1, Math.min(100, refineRate)) / 100;
    // 상급 safeQty개 → 중급 필요수 = safeQty*10/rate, 그 중급 → 하급 필요수 = (중급수)*10/rate
    const midNeeded = (safeQty * r2.input_qty) / rate;
    const lowNeeded = (midNeeded * r1.input_qty) / rate;
    // 하급은 가공으로 확보 (하급 확률)
    const lowP = grades["하급"] ?? 0.7;
    const processAttempts = lowP > 0 ? lowNeeded / lowP : 0;
    const processMeso = processAttempts * fee;
    const refineMidCount = midNeeded / rate;
    const refineHighCount = safeQty / rate;
    const refineMeso = refineMidCount * r1.fee + refineHighCount * r2.fee;
    return {
      lowNeeded: Math.ceil(lowNeeded),
      midNeeded: Math.ceil(midNeeded),
      processAttempts: Math.ceil(processAttempts),
      total: Math.round(processMeso + refineMeso),
    };
  }, [target, safeQty, refineRate, refine, grades, fee]);

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-gray-500 dark:text-gray-400 mb-1">목표 등급</span>
            <div className="flex gap-1">
              {(["하급", "중급", "상급"] as Grade[]).map((g) => (
                <button key={g} onClick={() => setTarget(g)}
                  className={`px-3 py-1.5 rounded-lg border text-sm ${target === g ? "bg-orange-500 text-white border-orange-500" : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"}`}>
                  {g} <span className="text-[11px] opacity-70">{((grades[g] ?? 0) * 100).toFixed(0)}%</span>
                </button>
              ))}
            </div>
          </label>
          <label className="text-sm">
            <span className="block text-gray-500 dark:text-gray-400 mb-1">목표 개수</span>
            <input type="number" min={1} max={999} value={qty} onChange={(e) => setQty(parseInt(e.target.value) || 1)}
              className="w-24 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-300" />
          </label>
        </div>

        {/* 직접 가공 결과 */}
        <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-3">
          <div className="text-sm font-bold text-orange-600 dark:text-orange-300 mb-1.5">직접 가공 (수수료 {won(fee)}/회)</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <Stat label="기대 가공 횟수" value={`${Math.ceil(expAttempts)}회`} />
            <Stat label="기대 원석 소모" value={`${Math.ceil(expAttempts)}개`} />
            <Stat label="기대 총 수수료" value={`${won(Math.round(expMeso))} 메소`} />
            <Stat label="해당 등급 확률" value={`${(p * 100).toFixed(0)}%`} />
          </div>
          {sim.length > 0 && (
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              운에 따른 가공 횟수(몬테카를로 2만회): 중앙값 <b>{percentile(sim, 0.5)}회</b> · 상위 90% 안 <b>{percentile(sim, 0.9)}회</b> · 95% <b>{percentile(sim, 0.95)}회</b>
              <div>→ 90% 안에 끝내려면 약 <b>{won(percentile(sim, 0.9) * fee)} 메소</b> 예상</div>
            </div>
          )}
        </div>

        {/* 제련 경로 비교 (상급 목표) */}
        {target === "상급" && refinePath && (
          <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
            <label className="flex items-center gap-2 text-sm font-bold mb-1.5">
              <input type="checkbox" checked={useRefine} onChange={(e) => setUseRefine(e.target.checked)} />
              제련 경로로 비교 (하급→중급→상급)
            </label>
            {useRefine && (
              <div className="text-sm space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500">제련 성공률(미확정 — 직접 입력)</span>
                  <input type="number" min={1} max={100} value={refineRate} onChange={(e) => setRefineRate(parseInt(e.target.value) || 100)}
                    className="w-16 border border-gray-300 dark:border-gray-600 rounded px-2 py-0.5 bg-white dark:bg-gray-900" />
                  <span>%</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <Stat label="필요 하급(가공)" value={`${refinePath.lowNeeded}개`} />
                  <Stat label="가공 횟수" value={`${refinePath.processAttempts}회`} />
                  <Stat label="제련 경로 총 메소" value={`${won(refinePath.total)}`} />
                </div>
                <div className="text-[11px] text-gray-500">
                  제련 비용: 중급 33만/회 + 상급 55만/회. 성공률이 확정되지 않아 입력값 기준 근사치입니다.
                  {refinePath.total < expMeso
                    ? " → 현재 입력 기준 제련 경로가 더 저렴."
                    : " → 현재 입력 기준 직접 가공이 더 저렴."}
                </div>
              </div>
            )}
          </div>
        )}
        <p className="text-[11px] text-gray-400">
          ※ 확률(하급 {((grades["하급"] ?? 0) * 100).toFixed(0)}% / 중급 {((grades["중급"] ?? 0) * 100).toFixed(0)}% / 상급 {((grades["상급"] ?? 0) * 100).toFixed(0)}%)과 수수료는 커뮤니티/구버전 기준 참고값입니다.
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
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-gray-500 dark:text-gray-400 mb-1">장비</span>
          <select value={name} onChange={(ev) => setName(ev.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-900 max-w-[14rem]">
            {data.equipment.map((x) => <option key={x.name} value={x.name}>{x.job} · {x.slot} · {x.name}</option>)}
          </select>
        </label>
        <div className="flex gap-1">
          {(["reverse", "timeless"] as const).map((gr) => (
            <button key={gr} disabled={!e?.[gr]} onClick={() => setGrade(gr)}
              className={`px-3 py-1.5 rounded-lg border text-sm disabled:opacity-30 ${grade === gr ? "bg-orange-500 text-white border-orange-500" : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"}`}>
              {gr === "reverse" ? "리버스" : "타임리스"}
            </button>
          ))}
        </div>
      </div>

      {g ? (
        <div className="space-y-2">
          <div className="text-sm">
            <span className="text-gray-500 dark:text-gray-400">옵션: </span>
            {Object.entries(g.stats).map(([k, v]) => `${k} +${v}`).join(", ")}
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-700"><th className="py-1.5">재료</th><th className="text-right">수량</th></tr></thead>
            <tbody>
              {g.materials.map((m) => (
                <tr key={m.name} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-1.5">{m.name}{m.note && <span className="text-xs text-gray-400"> ({m.note})</span>}</td>
                  <td className="text-right">{m.qty}</td>
                </tr>
              ))}
              <tr className="font-bold"><td className="py-1.5">제작 수수료(메소)</td><td className="text-right text-orange-500">{won(g.fee)}</td></tr>
            </tbody>
          </table>
          <p className="text-[11px] text-gray-400">
            ※ 몬스터 결정류 재료는 각 1개당 전리품 100개가 추가로 필요합니다. (재료 획득 탭 참고)
          </p>
        </div>
      ) : <p className="text-sm text-gray-500">해당 등급 제작 정보가 없습니다.</p>}
    </div>
  );
}

/* ─────────────────────────── 재료 획득 탭 ─────────────────────────── */
function MaterialTab({ data }: { data: MakerData }) {
  const [sel, setSel] = useState(data.monster_crystals[0]);
  const [mobs, setMobs] = useState<MakerMobSource[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getMakerMaterialSources({ level_min: sel.level_min, level_max: sel.level_max, limit: 80 })
      .then((d) => setMobs(d.mobs))
      .catch(() => setMobs([]))
      .finally(() => setLoading(false));
  }, [sel]);

  return (
    <div className="space-y-5">
      <Section title="몬스터 결정 — 등급별 사냥 대상">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {data.monster_crystals.map((c) => (
            <button key={c.grade + c.sub} onClick={() => setSel(c)}
              className={`px-2.5 py-1 text-xs rounded-full border ${sel === c ? "bg-orange-500 text-white border-orange-500" : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"}`}>
              {c.grade}{c.sub} · {c.level_min}~{c.level_max}
            </button>
          ))}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {sel.grade} {sel.sub} 결정: Lv.{sel.level_min}~{sel.level_max} 몬스터 전리품 {sel.loot_qty}개 필요. 아래는 해당 레벨대 메이플랜드 몬스터입니다.
        </div>
        {loading ? (
          <div className="text-sm text-gray-400">불러오는 중...</div>
        ) : mobs.length === 0 ? (
          <div className="text-sm text-gray-400">해당 레벨대 몬스터가 없습니다.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {mobs.map((m) => (
              <a key={m.id} href={`/mobs/${m.id}`}
                className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-orange-300">
                Lv.{m.level} {m.name_kr}{m.is_boss ? " 👑" : ""}
              </a>
            ))}
          </div>
        )}
      </Section>

      <Section title="기타 재료 획득">
        <div className="space-y-2">
          {data.material_sources.map((m) => (
            <div key={m.name} className="text-sm">
              <span className="font-bold">{m.name}</span>
              <span className="text-gray-500 dark:text-gray-400"> — {m.how}</span>
            </div>
          ))}
          <p className="text-xs text-gray-400 pt-1">정확한 드롭 몬스터는 상단 메뉴의 <a href="/drop-search" className="underline text-orange-500">드롭 검색</a>에서 아이템명으로 조회하세요.</p>
        </div>
      </Section>
    </div>
  );
}

/* ─────────────────────────── 공용 ─────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">{title}</h2>
      {children}
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-gray-500 dark:text-gray-400">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}
