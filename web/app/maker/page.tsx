"use client";

import { useState, useEffect, useMemo } from "react";
import { getMakerData, getMakerMaterialSources } from "@/lib/api";
import type { MakerData, MakerEquipment, MakerEquipGrade, MakerMobSource } from "@/lib/types";
import GemCalculator from "./GemCalculator";

type Tab = "info" | "sim" | "material" | "gem";
type Grade = "하급" | "중급" | "상급";

const won = (n: number) => n.toLocaleString("ko-KR");

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

  if (loading) return <div className="max-w-4xl mx-auto py-10 text-center text-dim">불러오는 중...</div>;
  // 데이터 누락/에러 폴백(meta·equipment 없음) 시 크래시 대신 안내
  if (!data || !data.meta || !Array.isArray(data.equipment) || data.equipment.length === 0) {
    return <div className="max-w-4xl mx-auto py-10 text-center text-dim">메이커 데이터를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="font-pixel text-xl font-bold text-ink">메이커 (전문기술)</h1>
        <p className="text-sm text-dim mt-1">
          메이플랜드 2.0의 메이커 제작 정보·시뮬레이터·재료 획득 가이드입니다.
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
      <div className="flex overflow-hidden border-2 border-edge">
        {([["info", "제작 정보"], ["sim", "시뮬레이터"], ["material", "재료 획득"], ["gem", "보석 가성비"]] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
              tab === t ? "pixel-btn font-pixel" : "font-pixel bg-surface text-dim hover:text-maple"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "info" && <InfoTab data={data} />}
      {tab === "sim" && <SimTab data={data} />}
      {tab === "material" && <MaterialTab data={data} />}
      {tab === "gem" && <GemCalculator />}
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
        <Section title="메이커 기능">
          <div className="flex flex-wrap gap-1.5">
            {data.meta.tespia_functions.map((f) => (
              <span key={f} className="px-2.5 py-1 text-xs rounded-full bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 text-sky-700 dark:text-sky-300">{f}</span>
            ))}
          </div>
        </Section>
      )}

      {/* 스킬 습득 */}
      <Section title="스킬 습득 퀘스트 (스탠 — 니할사막 마가티아)">
        <div className="space-y-3">
          {data.skill_quests.map((q) => (
            <div key={q.skill_level} className="pixel-panel p-3">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-xs text-maple font-bold">메이커 Lv.{q.skill_level}</span>
                <span className="font-bold text-sm">{q.name}</span>
                <span className="text-xs text-dim">필요 레벨 {q.req_level}</span>
                {q.location && <span className="text-xs text-dim">· {q.location}</span>}
              </div>
              {q.cost_meso > 0 && <div className="text-xs text-dim mt-1">준비물: 메소 {won(q.cost_meso)}</div>}
              {q.materials.map((m) => (
                <div key={m.name} className="text-xs text-dim mt-1">
                  준비물: {m.name} ×{m.qty}
                  {m.note && <span className="text-dim"> ({m.note})</span>}
                </div>
              ))}
              {q.flow && q.flow.length > 0 && (
                <ol className="mt-2 space-y-1 border-t border-edge/40 pt-2">
                  {q.flow.map((step, i) => (
                    <li key={i} className="flex gap-2 text-xs text-dim">
                      <span className="shrink-0 w-4 h-4 rounded-full bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] text-maple text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* 보석/크리스탈 스탯 */}
      <Section title="보석 · 크리스탈 능력치 (하급 / 중급 / 상급)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-dim border-b border-edge">
                <th className="py-2 pr-3">이름</th><th className="pr-3">능력치</th>
                <th className="pr-3 text-center">하급</th><th className="pr-3 text-center">중급</th><th className="text-center">상급</th>
              </tr>
            </thead>
            <tbody>
              {data.gems.map((g) => (
                <tr key={g.name} className="border-b border-edge/40">
                  <td className="py-1.5 pr-3 font-medium">{g.name}{g.weapon_only && <span className="ml-1 text-[10px] text-red-400">무기전용</span>}</td>
                  <td className="pr-3 text-dim">{g.stat}</td>
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
            <div key={c.grade + c.sub} className="pixel-panel p-2.5 text-center">
              <div className="font-bold">{c.grade} {c.sub}</div>
              <div className="text-xs text-dim">Lv.{c.level_min}~{c.level_max}</div>
              <div className="text-[11px] text-dim">전리품 {c.loot_qty}개</div>
            </div>
          ))}
        </div>
      </Section>

      {/* 주문서 */}
      <Section title="제작 주문서">
        <div className="grid sm:grid-cols-2 gap-3">
          {data.scrolls.map((s) => (
            <div key={s.name} className="pixel-panel p-3">
              <div className="font-bold text-sm">{s.name}</div>
              <div className="text-xs text-dim">{s.effect}</div>
              <div className="text-xs text-dim mt-1.5">
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
              className={`px-2.5 py-1 text-xs rounded-full border-2 ${job === j ? "pixel-btn font-pixel" : "font-pixel bg-surface2 border-edge text-dim"}`}>
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
    <div className="pixel-panel p-3">
      <div className="flex items-baseline justify-between">
        <span className="font-bold text-sm">{e.name}</span>
        <span className="text-xs text-dim">{e.job} · {e.slot}</span>
      </div>
      {(["reverse", "timeless"] as const).map((g) => {
        const grade = e[g];
        if (!grade) return null;
        return (
          <div key={g} className="mt-2 border-t border-edge/40 pt-1.5">
            <div className="text-xs font-bold text-maple">{g === "reverse" ? "리버스" : "타임리스"}</div>
            <div className="text-[11px] text-dim">
              {Object.entries(grade.stats).map(([k, v]) => `${k} +${v}`).join(", ")}
            </div>
            <div className="text-[11px] text-dim mt-0.5">
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
                  {g} <span className="text-[11px] opacity-70">{((grades[g] ?? 0) * 100).toFixed(0)}%</span>
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
                <span key={i} className={`px-1.5 py-0.5 rounded text-[11px] ${GRADE_STYLE[g]}`}>{g}</span>
              ))}
              {attempts > 40 && <span className="text-[11px] text-dim self-center">… 최근 40개만 표시</span>}
            </div>
          </div>
        )}

        {/* 제련 안내 */}
        <div className="text-xs text-dim border-t border-edge/40 pt-2">
          상위 등급 제련: 동일 하급 10개 + {won(data.gem_refine[0]?.fee ?? 330000)} 메소 → 중급, 동일 중급 10개 + {won(data.gem_refine[1]?.fee ?? 550000)} 메소 → 상급 (성공률 미공개)
        </div>
        <p className="text-[11px] text-dim">
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
          <p className="text-[11px] text-dim">
            ※ 몬스터 결정류 재료는 각 1개당 전리품 100개가 추가로 필요합니다. (재료 획득 탭 참고)
          </p>
        </div>
      ) : <p className="text-sm text-dim">해당 등급 제작 정보가 없습니다.</p>}
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
              className={`px-2.5 py-1 text-xs rounded-full border-2 ${sel === c ? "pixel-btn font-pixel" : "font-pixel bg-surface2 border-edge text-dim"}`}>
              {c.grade}{c.sub} · {c.level_min}~{c.level_max}
            </button>
          ))}
        </div>
        <div className="text-xs text-dim mb-2">
          {sel.grade} {sel.sub} 결정: Lv.{sel.level_min}~{sel.level_max} 몬스터 전리품 {sel.loot_qty}개 필요. 아래는 해당 레벨대 메이플랜드 몬스터입니다.
        </div>
        {loading ? (
          <div className="text-sm text-dim">불러오는 중...</div>
        ) : mobs.length === 0 ? (
          <div className="text-sm text-dim">해당 레벨대 몬스터가 없습니다.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {mobs.map((m) => (
              <a key={m.id} href={`/mobs/${m.id}`}
                className="px-2 py-1 text-xs border-2 border-edge bg-surface2 hover:border-maple">
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
              <span className="text-dim"> — {m.how}</span>
            </div>
          ))}
          <p className="text-xs text-dim pt-1">정확한 드롭 몬스터는 상단 메뉴의 <a href="/drop-search" className="underline text-maple">드롭 검색</a>에서 아이템명으로 조회하세요.</p>
        </div>
      </Section>
    </div>
  );
}

/* ─────────────────────────── 공용 ─────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-pixel text-sm font-bold text-ink mb-2">{title}</h2>
      {children}
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-pixel text-[11px] text-dim">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}
