"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getQuestRoadmap, type RoadmapQuest } from "@/lib/api";

/* 레벨 구간 (타임라인 축) */
const BRACKETS: [number, number, string][] = [
  [0, 10, "Lv.1~10"], [11, 20, "Lv.11~20"], [21, 30, "Lv.21~30"], [31, 40, "Lv.31~40"],
  [41, 50, "Lv.41~50"], [51, 60, "Lv.51~60"], [61, 70, "Lv.61~70"], [71, 85, "Lv.71~85"],
  [86, 100, "Lv.86~100"], [101, 200, "Lv.101+"],
];

const JOB_FILTERS = ["전체", "전사", "마법사", "궁수", "도적", "해적"];

function itemIcon(id: number | null) {
  return id ? `https://maplestory.io/api/gms/92/item/${id}/icon` : null;
}

function fmtNum(n: number) {
  return n.toLocaleString();
}

function QuestCard({ q, myLevel }: { q: RoadmapQuest; myLevel: number | null }) {
  const [open, setOpen] = useState(false);
  const locked = myLevel !== null && q.min_level > myLevel;
  const hasPrereq = q.prereq.length > 0;

  return (
    <div className={`pixel-card self-start ${locked ? "opacity-50" : ""}`}>
      <button onClick={() => setOpen(!open)} className="w-full text-left px-3 py-2.5 group" aria-expanded={open}>
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold flex-1 min-w-0 truncate">{q.name}</span>
          {q.repeatable === 1 && <span className="text-[10px] font-pixel text-skill border border-skill px-1 shrink-0">반복</span>}
          {hasPrereq && <span className="text-[10px] font-pixel text-dim border border-edge px-1 shrink-0">체인</span>}
          <span className="text-xs text-dim shrink-0">Lv.{q.min_level}{q.max_level ? `~${q.max_level}` : "+"}</span>
          <svg
            className={`w-3.5 h-3.5 shrink-0 text-dim group-hover:text-maple transition-transform ${open ? "rotate-180 text-maple" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
        <span className="flex items-center gap-3 mt-1 text-xs">
          {q.exp > 0 && <span className="text-skill font-medium">EXP {fmtNum(q.exp)}</span>}
          {q.meso > 0 && <span className="text-maple">메소 {fmtNum(q.meso)}</span>}
          {q.fame > 0 && <span className="text-dim">인기도 +{q.fame}</span>}
          {q.rewards.length > 0 && (
            <span className="flex items-center gap-0.5">
              {q.rewards.slice(0, 4).map((r, i) =>
                itemIcon(r.id) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={itemIcon(r.id)!} alt={r.name} title={r.name} className="w-5 h-5 object-contain" loading="lazy" />
                ) : null
              )}
              {q.rewards.length > 4 && <span className="text-dim">+{q.rewards.length - 4}</span>}
            </span>
          )}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-edge/50 text-xs space-y-1.5">
          <p className="text-dim">
            시작 NPC <span className="text-ink">{q.start_npc || "-"}</span>
            {q.end_npc && q.end_npc !== q.start_npc && <> → 종료 <span className="text-ink">{q.end_npc}</span></>}
            {q.jobs && <span className="ml-2">· {q.jobs}</span>}
            {q.req_meso > 0 && <span className="ml-2 text-maple">· 시작 메소 {fmtNum(q.req_meso)}</span>}
          </p>
          {q.prereq.length > 0 && (
            <p className="text-dim">선행: {q.prereq.map(([, n]) => n).join(" → ")}</p>
          )}
          {q.next.length > 0 && (
            <p className="text-dim">다음: {q.next.map(([, n]) => n).join(" → ")}</p>
          )}
          {q.requirements.length > 0 && (
            <div>
              <p className="text-dim mb-0.5">완료 조건:</p>
              <ul className="space-y-0.5">
                {q.requirements.map((r, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    {itemIcon(r.type === "item" ? r.id : null) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={itemIcon(r.id)!} alt="" className="w-4 h-4 object-contain" loading="lazy" />
                    )}
                    <span>{r.raw || r.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {q.rewards.length > 0 && (
            <div>
              <p className="text-dim mb-0.5">보상 아이템:</p>
              <ul className="space-y-0.5">
                {q.rewards.map((r, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    {itemIcon(r.id) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={itemIcon(r.id)!} alt="" className="w-4 h-4 object-contain" loading="lazy" />
                    )}
                    <span>{r.raw || r.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {q.cur_tip && <p className="text-maple">💡 {q.cur_tip}</p>}
        </div>
      )}
    </div>
  );
}

export default function QuestRoadmapPage() {
  const [quests, setQuests] = useState<RoadmapQuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [myLevel, setMyLevel] = useState<string>("");
  const [job, setJob] = useState("전체");
  const [search, setSearch] = useState("");
  const [includeRepeat, setIncludeRepeat] = useState(true);
  const [rewardOnly, setRewardOnly] = useState(false);
  const [openBrackets, setOpenBrackets] = useState<Set<number>>(new Set());

  useEffect(() => {
    getQuestRoadmap()
      .then((d) => setQuests(d.quests || []))
      .catch(() => setQuests([]))
      .finally(() => setLoading(false));
  }, []);

  const lv = myLevel.trim() ? Math.max(1, Math.min(200, parseInt(myLevel, 10) || 0)) : null;

  const filtered = useMemo(() => {
    return quests.filter((q) => {
      if (!includeRepeat && q.repeatable === 1) return false;
      if (rewardOnly && q.rewards.length === 0) return false;
      if (job !== "전체" && q.jobs && !q.jobs.includes(job) && !q.jobs.includes("공용") && q.jobs !== "초보자") return false;
      if (search.trim() && !q.name.includes(search.trim())) return false;
      return true;
    });
  }, [quests, includeRepeat, rewardOnly, job, search]);

  /* 내 레벨 기준 지금 가능한 퀘스트 (경험치순 상위) */
  const nowQuests = useMemo(() => {
    if (lv === null) return [];
    return filtered
      .filter((q) => q.min_level <= lv && (q.max_level === null || q.max_level === 0 || lv <= q.max_level))
      .sort((a, b) => b.exp - a.exp)
      .slice(0, 30);
  }, [filtered, lv]);

  const byBracket = useMemo(() => {
    return BRACKETS.map(([lo, hi, label], i) => ({
      i, label,
      list: filtered.filter((q) => q.min_level >= lo && q.min_level <= hi),
    }));
  }, [filtered]);

  if (loading) return <div className="text-center py-12 text-dim">로딩 중...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-pixel text-2xl font-bold mb-1">🧭 퀘스트 로드맵</h1>
      <p className="text-sm text-dim mb-4">
        메이플랜드 2.0 퀘스트 {quests.length.toLocaleString()}종 — 내 레벨에 맞는 퀘스트와 레벨 구간별 로드맵.
        카드를 누르면 선행 체인·완료 조건·보상이 펼쳐집니다.
      </p>

      {/* 필터 바 */}
      <div className="pixel-panel p-4 mb-6 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-pixel text-xs">내 레벨</span>
          <input
            type="number" min={1} max={200} value={myLevel}
            onChange={(e) => setMyLevel(e.target.value)}
            placeholder="예: 45"
            className="pixel-input w-20 px-2 py-1.5 text-sm"
          />
        </label>
        <select value={job} onChange={(e) => setJob(e.target.value)} className="pixel-input px-2 py-1.5 text-sm">
          {JOB_FILTERS.map((j) => <option key={j} value={j}>{j === "전체" ? "직업: 전체" : j}</option>)}
        </select>
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="퀘스트 이름 검색"
          className="pixel-input px-2 py-1.5 text-sm w-40"
        />
        <label className="flex items-center gap-1 text-xs text-dim cursor-pointer">
          <input type="checkbox" checked={includeRepeat} onChange={(e) => setIncludeRepeat(e.target.checked)} />
          반복퀘 포함
        </label>
        <label className="flex items-center gap-1 text-xs text-dim cursor-pointer">
          <input type="checkbox" checked={rewardOnly} onChange={(e) => setRewardOnly(e.target.checked)} />
          아이템 보상만
        </label>
      </div>

      {/* 내 레벨 기준 추천 */}
      {lv !== null && (
        <section className="mb-8">
          <h2 className="font-pixel text-lg font-semibold mb-1 text-ink">
            ⚡ Lv.{lv} 지금 할 수 있는 퀘스트 <span className="text-sm font-normal text-dim">(경험치순 상위 {nowQuests.length}개)</span>
          </h2>
          <p className="text-xs text-dim mb-3">선행 체인이 있는 퀘스트(체인 배지)는 앞 퀘스트를 먼저 완료해야 할 수 있습니다.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-start">
            {nowQuests.map((q) => <QuestCard key={q.quest_id} q={q} myLevel={lv} />)}
          </div>
          {nowQuests.length === 0 && <p className="text-sm text-dim py-4 text-center">조건에 맞는 퀘스트가 없습니다</p>}
        </section>
      )}

      {/* 레벨 구간 타임라인 */}
      <section>
        <h2 className="font-pixel text-lg font-semibold mb-3 text-ink">📜 레벨 구간별 로드맵</h2>
        <div className="space-y-2">
          {byBracket.map(({ i, label, list }) => (
            <div key={i} className="pixel-panel p-0 overflow-hidden">
              <button
                onClick={() => {
                  const s = new Set(openBrackets);
                  if (s.has(i)) s.delete(i); else s.add(i);
                  setOpenBrackets(s);
                }}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[color-mix(in_srgb,var(--c-maple)_8%,transparent)] transition-colors"
              >
                <span className="font-pixel text-sm">{label}</span>
                <span className="text-xs text-dim">
                  {list.length}개 · EXP 합 {fmtNum(list.reduce((s, q) => s + q.exp, 0))}
                  <span className="ml-2">{openBrackets.has(i) ? "▲" : "▼"}</span>
                </span>
              </button>
              {openBrackets.has(i) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border-t-2 border-edge items-start">
                  {list
                    .slice()
                    .sort((a, b) => a.min_level - b.min_level || b.exp - a.exp)
                    .map((q) => <QuestCard key={q.quest_id} q={q} myLevel={lv} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <p className="text-[11px] text-dim mt-6">
        ※ 데이터 출처: mapledb.kr (메이플랜드 2.0 기준, {quests.length}종) + 사이트 큐레이션 팁.
        신규 패치 퀘스트(마왕 발록 등)는 원본 DB 갱신 시 재크롤로 반영됩니다.
      </p>
    </div>
  );
}
