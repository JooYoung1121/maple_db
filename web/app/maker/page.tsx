"use client";
import BattleMageKnownIssue from "@/components/BattleMageKnownIssue";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { getMakerData, getMakerMaterialSources } from "@/lib/api";
import type { MakerData, MakerEquipment, MakerMobSource } from "@/lib/types";
import GemCalculator from "./GemCalculator";
import ItemEnhanceSimulator from "./ItemEnhanceSimulator";
import EnhanceShowcaseGallery from "./EnhanceShowcase";

type Tab = "info" | "enhance" | "hall" | "material" | "gem";

const won = (n: number) => n.toLocaleString("ko-KR");

export default function MakerPage() {
  const [tab, setTab] = useState<Tab>("enhance");
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
        <BattleMageKnownIssue />
        <p className="text-sm text-dim mt-1">
          메이플랜드 2.0의 메이커 제작 정보·강화 시뮬·재료 획득 가이드입니다.
        </p>
      </div>

      {/* 리버스 기대값·보석 가공 시뮬 → 시뮬레이터 메뉴로 분리 (v4.13.0) */}
      <Link href="/reverse-sim" className="pixel-panel flex items-center gap-3 px-4 py-3 hover:border-maple transition-colors group">
        <span className="text-2xl shrink-0" aria-hidden>🔁</span>
        <span className="min-w-0 flex-1">
          <span className="block font-pixel text-sm text-ink group-hover:text-maple"><b>리버스 기대값</b>과 <b>보석 가공 시뮬</b>은 리버스 시뮬레이터로 옮겼습니다</span>
          <span className="block text-xs text-dim mt-0.5">촉매 파괴·레벨업 옵션·주문서까지 리버스 무기 한 자루의 기대값과 분포 → 시뮬레이터 메뉴 · 리버스 시뮬레이터</span>
        </span>
        <span className="text-dim group-hover:text-maple shrink-0">→</span>
      </Link>

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
      <div className="flex overflow-x-auto border-2 border-edge">
        {([["info", "제작 정보"], ["enhance", "강화 시뮬"], ["hall", "명예의전당"], ["material", "재료 획득"], ["gem", "보석 가성비"]] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 shrink-0 min-w-[6.5rem] py-2.5 text-sm font-bold transition-colors ${
              tab === t ? "pixel-btn font-pixel" : "font-pixel bg-surface text-dim hover:text-maple"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "info" && <InfoTab data={data} />}
      {tab === "enhance" && <ItemEnhanceSimulator makerData={data} />}
      {tab === "hall" && <EnhanceShowcaseGallery />}
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
                      <span className="shrink-0 w-4 h-4 rounded-full bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] text-maple text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
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
                  <td className="py-1.5 pr-3 font-medium">{g.name}{g.weapon_only && <span className="ml-1 text-xs text-red-400">무기전용</span>}</td>
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
              <div className="text-xs text-dim">전리품 {c.loot_qty}개</div>
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
            <div className="text-xs text-dim">
              {Object.entries(grade.stats).map(([k, v]) => `${k} +${v}`).join(", ")}
            </div>
            <div className="text-xs text-dim mt-0.5">
              {grade.materials.map((m) => `${m.name}×${m.qty}`).join(" · ")} · 메소 {won(grade.fee)}
            </div>
          </div>
        );
      })}
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
