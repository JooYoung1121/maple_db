"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getQuests } from "@/lib/api";
import type { Quest } from "@/lib/types";
import Pagination from "@/components/Pagination";
import { useQueryState } from "@/lib/useQueryState";

/* ====================================================================
   퀘스트 베타 페이지 — Interactive Table + Expandable Row 스타일
   기존 사이드바+카드 리스트와 완전히 다른 Notion DB / Airtable 느낌
   ==================================================================== */

/* ── 상수 ── */
const AREAS = [
  { label: "전체", value: "", icon: "🌍" },
  { label: "빅토리아", value: "빅토리아 아일랜드", icon: "🏝️" },
  { label: "엘나스/아쿠아", value: "엘나스/아쿠아로드", icon: "❄️" },
  { label: "루디브리엄", value: "루디브리엄", icon: "🎪" },
  { label: "무릉/니할", value: "무릉/니할사막", icon: "🏜️" },
  { label: "리프레", value: "리프레", icon: "🌿" },
  { label: "세계여행", value: "세계여행", icon: "✈️" },
];

const DIFFICULTY_MAP: Record<string, { label: string; color: string; bg: string; dot: string; glow: string }> = {
  "필수":   { label: "필수", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", dot: "bg-emerald-400", glow: "#34d399" },
  "추천":   { label: "추천", color: "text-yellow-400",  bg: "bg-yellow-500/15 border-yellow-500/30",  dot: "bg-yellow-400",  glow: "#facc15" },
  "비추천": { label: "비추천", color: "text-red-400",     bg: "bg-red-500/15 border-red-500/30",     dot: "bg-red-400",     glow: "#f87171" },
  "일일":   { label: "일일", color: "text-sky-400",     bg: "bg-sky-500/15 border-sky-500/30",     dot: "bg-sky-400",     glow: "#38bdf8" },
  "월드이동": { label: "월드이동", color: "text-purple-400", bg: "bg-purple-500/15 border-purple-500/30", dot: "bg-purple-400", glow: "#c084fc" },
  "히든":   { label: "히든", color: "text-pink-400",    bg: "bg-pink-500/15 border-pink-500/30",    dot: "bg-pink-400",    glow: "#f472b6" },
  "체인":   { label: "체인", color: "text-orange-400",  bg: "bg-orange-500/15 border-orange-500/30",  dot: "bg-orange-400",  glow: "#fb923c" },
};

const SORT_OPTIONS = [
  { label: "레벨 ↑", value: "" },
  { label: "레벨 ↓", value: "level_desc" },
  { label: "EXP 보상", value: "exp_reward" },
  { label: "메소 보상", value: "meso_reward" },
  { label: "이름순", value: "name" },
];

/* ── 로컬스토리지 훅 ── */
function useLocalSet(key: string) {
  const [set, setSet] = useState<Set<number>>(new Set());
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) setSet(new Set(JSON.parse(stored)));
    } catch { /* noop */ }
  }, [key]);
  const toggle = useCallback((id: number) => {
    setSet((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem(key, JSON.stringify([...next]));
      return next;
    });
  }, [key]);
  return { set, toggle };
}

/* ── 난이도 도트 ── */
function DifficultyDot({ difficulty }: { difficulty: string | null | undefined }) {
  const diff = difficulty ? DIFFICULTY_MAP[difficulty] : null;
  if (!diff) return <span className="w-2.5 h-2.5 rounded-full bg-slate-600 inline-block" />;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`w-2.5 h-2.5 rounded-full ${diff.dot}`}
        style={{ boxShadow: `0 0 6px ${diff.glow}40` }}
      />
      <span className={`text-xs font-medium ${diff.color}`}>{diff.label}</span>
    </span>
  );
}

/* ── 레벨 프로그레스 바 ── */
function LevelBar({ level }: { level: number }) {
  const maxLv = 200;
  const pct = Math.min((level / maxLv) * 100, 100);
  let barColor = "from-emerald-500 to-emerald-400";
  if (level > 120) barColor = "from-red-500 to-red-400";
  else if (level > 70) barColor = "from-purple-500 to-purple-400";
  else if (level > 30) barColor = "from-blue-500 to-blue-400";

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <span className="text-xs font-mono font-bold text-gray-200 w-8 text-right">{level || "-"}</span>
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ── 보상 칩 ── */
function RewardChips({ quest }: { quest: Quest }) {
  const chips: { label: string; value: string; cls: string }[] = [];
  if (quest.exp_reward && quest.exp_reward > 0) {
    chips.push({ label: "EXP", value: quest.exp_reward.toLocaleString(), cls: "bg-blue-500/20 text-blue-300 border-blue-500/30" });
  }
  if (quest.meso_reward && quest.meso_reward > 0) {
    chips.push({ label: "메소", value: quest.meso_reward.toLocaleString(), cls: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" });
  }
  if (quest.item_reward) {
    chips.push({ label: "", value: quest.item_reward, cls: "bg-green-500/20 text-green-300 border-green-500/30" });
  }
  if (quest.extra_reward) {
    chips.push({ label: "", value: quest.extra_reward, cls: "bg-purple-500/20 text-purple-300 border-purple-500/30" });
  }
  if (chips.length === 0) return <span className="text-xs text-slate-600">-</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c, i) => (
        <span key={i} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${c.cls}`}>
          {c.label && <span className="opacity-70">{c.label}</span>}
          {c.value}
        </span>
      ))}
    </div>
  );
}

/* ── 체인 퀘스트 배지 ── */
function ChainBadge({ quest }: { quest: Quest }) {
  if (!quest.is_chain) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-500/15 border border-orange-500/30 text-orange-400 text-[10px] font-medium">
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      체인
    </span>
  );
}

/* ── 확장 상세 패널 ── */
function ExpandedDetail({ quest, onGoDetail }: { quest: Quest; onGoDetail: () => void }) {
  const chainQuests = quest.chain_quests && Array.isArray(quest.chain_quests) ? quest.chain_quests : [];

  return (
    <div className="px-4 pb-4 pt-1 animate-questFadeIn">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        {/* 왼쪽: 기본 정보 */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">기본 정보</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">지역</span>
              <span className="text-slate-200">{quest.area}</span>
            </div>
            {quest.start_location && (
              <div className="flex justify-between">
                <span className="text-slate-500">시작 위치</span>
                <span className="text-slate-200">{quest.start_location}</span>
              </div>
            )}
            {quest.quest_type && (
              <div className="flex justify-between">
                <span className="text-slate-500">유형</span>
                <span className="text-slate-200">{quest.quest_type}</span>
              </div>
            )}
            {quest.difficulty && (
              <div className="flex justify-between">
                <span className="text-slate-500">난이도</span>
                <DifficultyDot difficulty={quest.difficulty} />
              </div>
            )}
          </div>
        </div>

        {/* 가운데: 조건 & 팁 */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">퀘스트 조건 / 팁</h4>
          {quest.quest_conditions && quest.quest_conditions.length > 0 ? (
            <ul className="space-y-1.5">
              {quest.quest_conditions.map((cond, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                  <span className="text-slate-300">{cond}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-600">조건 정보 없음</p>
          )}
          {quest.tip && (
            <div className="border-t border-slate-700/50 pt-2 mt-2">
              <span className="text-[10px] text-slate-500 uppercase block mb-1">TIP</span>
              <p className="text-xs text-slate-400 leading-relaxed">{quest.tip}</p>
            </div>
          )}
          {quest.note && (
            <div className="border-t border-slate-700/50 pt-2 mt-2">
              <span className="text-[10px] text-slate-500 uppercase block mb-1">NOTE</span>
              <p className="text-xs text-slate-400 leading-relaxed">{quest.note}</p>
            </div>
          )}
        </div>

        {/* 오른쪽: 보상 & 체인 */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">보상</h4>
          <div className="space-y-1.5 text-sm">
            {quest.exp_reward && quest.exp_reward > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-blue-400">EXP</span>
                <span className="font-mono text-blue-300">{quest.exp_reward.toLocaleString()}</span>
              </div>
            )}
            {quest.meso_reward && quest.meso_reward > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-yellow-400">메소</span>
                <span className="font-mono text-yellow-300">{quest.meso_reward.toLocaleString()}</span>
              </div>
            )}
            {quest.item_reward && (
              <div className="flex items-center justify-between">
                <span className="text-green-400">아이템</span>
                <span className="text-green-300">{quest.item_reward}</span>
              </div>
            )}
            {quest.extra_reward && (
              <div className="flex items-center justify-between">
                <span className="text-purple-400">추가 보상</span>
                <span className="text-purple-300">{quest.extra_reward}</span>
              </div>
            )}
            {!quest.exp_reward && !quest.meso_reward && !quest.item_reward && !quest.extra_reward && (
              <p className="text-xs text-slate-600">보상 정보 없음</p>
            )}
          </div>

          {/* 체인 퀘스트 연결 */}
          {chainQuests.length > 0 && (
            <div className="border-t border-slate-700/50 pt-3 mt-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">체인 퀘스트</h4>
              <div className="space-y-1.5">
                {chainQuests.map((cq) => (
                  <div key={cq.id} className="flex items-center gap-1.5 text-xs">
                    <svg className="w-3 h-3 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span className="text-slate-300">{cq.name}</span>
                    <span className="text-slate-600 ml-auto">Lv.{cq.level_req}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 상세보기 버튼 */}
          <button
            onClick={onGoDetail}
            className="w-full mt-2 px-4 py-2 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-medium hover:bg-orange-500/30 transition-colors"
          >
            상세 페이지 보기 &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   메인 페이지 컴포넌트
   ══════════════════════════════════════════════════════════════════════ */
function QuestsBetaContent() {
  const router = useRouter();
  const { filterValues, page, setFilterValues, setPage } = useQueryState();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const { set: completed, toggle: toggleCompleted } = useLocalSet("completedQuests");
  const { set: favorites, toggle: toggleFavorite } = useLocalSet("favoriteQuests");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showFavOnly, setShowFavOnly] = useState(false);
  const perPage = 20;
  const tableRef = useRef<HTMLDivElement>(null);

  // Fetch data
  useEffect(() => {
    setLoading(true);
    getQuests({ page, per_page: perPage, ...filterValues })
      .then((d) => { setQuests(d.quests); setTotal(d.total); })
      .catch(() => setQuests([]))
      .finally(() => setLoading(false));
  }, [page, filterValues]);

  // Client-side filter
  const displayQuests = useMemo(() => {
    let filtered = quests;
    if (hideCompleted) filtered = filtered.filter((q) => !completed.has(q.id));
    if (showFavOnly) filtered = filtered.filter((q) => favorites.has(q.id));
    return filtered;
  }, [quests, hideCompleted, showFavOnly, completed, favorites]);

  const updateFilter = (key: string, value: string) => {
    setFilterValues({ ...filterValues, [key]: value });
  };

  const currentArea = filterValues.area || "";
  const currentSort = filterValues.sort || "";

  /* ── 통계 바 ── */
  const stats = useMemo(() => {
    const totalExp = displayQuests.reduce((s, q) => s + (q.exp_reward || 0), 0);
    const completedCount = displayQuests.filter((q) => completed.has(q.id)).length;
    return { totalExp, completedCount };
  }, [displayQuests, completed]);

  return (
    <div className="space-y-4">
      {/* ═══ Hero Header ═══ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 p-6">
        {/* Subtle dot pattern overlay */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-[10px] font-bold uppercase tracking-wider">Beta</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              퀘스트 데이터베이스
            </h1>
            <p className="text-sm text-slate-400 mt-1">메이플랜드 전체 퀘스트를 인터랙티브 테이블로 탐색하세요</p>
          </div>
          {/* 미니 통계 */}
          <div className="flex gap-4 text-center">
            <div className="bg-slate-800/60 rounded-xl px-4 py-2 border border-slate-700/50">
              <div className="text-lg font-bold text-white">{total.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500 uppercase">전체 퀘스트</div>
            </div>
            <div className="bg-slate-800/60 rounded-xl px-4 py-2 border border-slate-700/50">
              <div className="text-lg font-bold text-emerald-400">{stats.completedCount}</div>
              <div className="text-[10px] text-slate-500 uppercase">완료</div>
            </div>
            <div className="bg-slate-800/60 rounded-xl px-4 py-2 border border-slate-700/50">
              <div className="text-lg font-bold text-blue-400">{stats.totalExp.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500 uppercase">페이지 총 EXP</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 필터 바 (sticky) ═══ */}
      <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 space-y-3 sticky top-[64px] z-30">
        {/* 첫 번째 줄: 지역 탭 */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 quest-scrollbar-thin">
          {AREAS.map((area) => (
            <button
              key={area.value}
              onClick={() => updateFilter("area", area.value)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                currentArea === area.value
                  ? "bg-orange-500/20 text-orange-400 border border-orange-500/40 shadow-lg shadow-orange-500/10"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent"
              }`}
            >
              <span className="text-base">{area.icon}</span>
              <span>{area.label}</span>
            </button>
          ))}
        </div>

        {/* 두 번째 줄: 검색 + 레벨 + 정렬 + 뷰 모드 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 검색 */}
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={filterValues.q || ""}
              onChange={(e) => updateFilter("q", e.target.value)}
              placeholder="퀘스트 이름, 위치, 보상 검색..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800/80 border border-slate-700/50 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition-all"
            />
          </div>

          {/* 레벨 범위 */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/50 rounded-lg px-3 py-1">
            <span className="text-xs text-slate-500 font-medium">LV</span>
            <input
              type="number"
              value={filterValues.level_min || ""}
              onChange={(e) => updateFilter("level_min", e.target.value)}
              placeholder="0"
              className="w-12 bg-transparent text-sm text-slate-200 text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-slate-600">~</span>
            <input
              type="number"
              value={filterValues.level_max || ""}
              onChange={(e) => updateFilter("level_max", e.target.value)}
              placeholder="200"
              className="w-12 bg-transparent text-sm text-slate-200 text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          {/* 정렬 */}
          <div className="relative">
            <select
              value={currentSort}
              onChange={(e) => updateFilter("sort", e.target.value)}
              className="appearance-none bg-slate-800/80 border border-slate-700/50 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500/40 cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* 보상 필터 */}
          <button
            onClick={() => updateFilter("has_rewards", filterValues.has_rewards === "1" ? "" : "1")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
              filterValues.has_rewards === "1"
                ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                : "bg-slate-800/80 border-slate-700/50 text-slate-400 hover:text-slate-200"
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            보상
          </button>

          {/* 완료 숨기기 */}
          <button
            onClick={() => setHideCompleted(!hideCompleted)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
              hideCompleted
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                : "bg-slate-800/80 border-slate-700/50 text-slate-400 hover:text-slate-200"
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
            완료 숨김
          </button>

          {/* 즐겨찾기만 */}
          <button
            onClick={() => setShowFavOnly(!showFavOnly)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
              showFavOnly
                ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-400"
                : "bg-slate-800/80 border-slate-700/50 text-slate-400 hover:text-slate-200"
            }`}
          >
            {showFavOnly ? "\u2605" : "\u2606"}
          </button>

          {/* 뷰 모드 토글 */}
          <div className="flex bg-slate-800/80 border border-slate-700/50 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("table")}
              className={`px-2.5 py-2 transition-colors ${viewMode === "table" ? "bg-orange-500/20 text-orange-400" : "text-slate-500 hover:text-slate-300"}`}
              title="테이블 뷰"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`px-2.5 py-2 transition-colors ${viewMode === "grid" ? "bg-orange-500/20 text-orange-400" : "text-slate-500 hover:text-slate-300"}`}
              title="그리드 뷰"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ 콘텐츠 ═══ */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-4 border-slate-700 rounded-full" />
            <div className="absolute inset-0 border-4 border-transparent border-t-orange-500 rounded-full animate-spin" />
          </div>
          <span className="text-sm text-slate-500">퀘스트 데이터 로딩 중...</span>
        </div>
      ) : displayQuests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-3xl text-slate-600">
            ?
          </div>
          <p className="text-slate-400 font-medium">검색 결과가 없습니다</p>
          <p className="text-sm text-slate-600">필터 조건을 변경해보세요</p>
        </div>
      ) : viewMode === "table" ? (
        /* ═══ 테이블 뷰 ═══ */
        <div ref={tableRef} className="bg-slate-900/60 border border-slate-700/50 rounded-xl overflow-hidden">
          {/* 테이블 헤더 */}
          <div className="hidden md:grid grid-cols-[40px_40px_1fr_120px_100px_160px_80px] gap-2 px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <div />
            <div />
            <div>퀘스트</div>
            <div>레벨</div>
            <div>난이도</div>
            <div>보상</div>
            <div className="text-center">상태</div>
          </div>

          {/* 테이블 행 */}
          <div className="divide-y divide-slate-800/80">
            {displayQuests.map((quest) => {
              const isExpanded = expandedId === quest.id;
              const isCompleted = completed.has(quest.id);
              const isFav = favorites.has(quest.id);
              const level = quest.level_req || 0;

              return (
                <div
                  key={quest.id}
                  className={`transition-all duration-150 ${isCompleted ? "opacity-50" : ""} ${isExpanded ? "bg-slate-800/40" : "hover:bg-slate-800/30"}`}
                >
                  {/* 메인 행 */}
                  <div
                    className="grid grid-cols-1 md:grid-cols-[40px_40px_1fr_120px_100px_160px_80px] gap-2 px-4 py-3 items-center cursor-pointer group"
                    onClick={() => setExpandedId(isExpanded ? null : quest.id)}
                  >
                    {/* 즐겨찾기 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(quest.id); }}
                      className={`hidden md:block text-center text-lg leading-none transition-all ${isFav ? "text-yellow-400 scale-110" : "text-slate-700 group-hover:text-slate-500"}`}
                    >
                      {isFav ? "\u2605" : "\u2606"}
                    </button>

                    {/* 난이도 도트 */}
                    <div className="hidden md:flex items-center justify-center">
                      <span className={`w-2.5 h-2.5 rounded-full ${quest.difficulty && DIFFICULTY_MAP[quest.difficulty] ? DIFFICULTY_MAP[quest.difficulty].dot : "bg-slate-600"}`}
                        style={quest.difficulty && DIFFICULTY_MAP[quest.difficulty] ? { boxShadow: `0 0 6px ${DIFFICULTY_MAP[quest.difficulty].glow}40` } : undefined}
                      />
                    </div>

                    {/* 퀘스트 이름 */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* 모바일 전용: 즐겨찾기 + 난이도 */}
                        <span className="md:hidden flex items-center gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(quest.id); }}
                            className={`text-lg leading-none ${isFav ? "text-yellow-400" : "text-slate-600"}`}
                          >
                            {isFav ? "\u2605" : "\u2606"}
                          </button>
                          <DifficultyDot difficulty={quest.difficulty} />
                        </span>
                        <span className={`font-semibold text-sm text-slate-100 group-hover:text-orange-400 transition-colors ${isCompleted ? "line-through" : ""}`}>
                          {quest.name}
                        </span>
                        <ChainBadge quest={quest} />
                      </div>
                      {/* 모바일 전용 하단 정보 */}
                      <div className="md:hidden flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span>Lv.{level}</span>
                        <span>{quest.area}</span>
                        {quest.quest_type && <span>{quest.quest_type}</span>}
                      </div>
                    </div>

                    {/* 레벨 바 */}
                    <div className="hidden md:block">
                      <LevelBar level={level} />
                    </div>

                    {/* 난이도 */}
                    <div className="hidden md:block">
                      {quest.difficulty ? (
                        <DifficultyDot difficulty={quest.difficulty} />
                      ) : quest.quest_type && quest.quest_type !== "일반" ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                          quest.quest_type === "반복" ? "bg-amber-500/15 text-amber-400" :
                          quest.quest_type === "히든" ? "bg-pink-500/15 text-pink-400" :
                          quest.quest_type === "월드이동" ? "bg-purple-500/15 text-purple-400" :
                          "bg-slate-700/60 text-slate-400"
                        }`}>
                          {quest.quest_type}
                        </span>
                      ) : null}
                    </div>

                    {/* 보상 */}
                    <div className="hidden md:block">
                      <RewardChips quest={quest} />
                    </div>

                    {/* 상태(완료) */}
                    <div className="hidden md:flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleCompleted(quest.id); }}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                          isCompleted
                            ? "bg-emerald-500 border-emerald-500 text-white scale-110"
                            : "border-slate-600 hover:border-orange-400 group-hover:border-slate-500"
                        }`}
                      >
                        {isCompleted && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      {/* 확장 화살표 */}
                      <svg
                        className={`w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-all duration-200 ${isExpanded ? "rotate-180 text-orange-400" : ""}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>

                    {/* 모바일 전용 버튼 */}
                    <div className="md:hidden flex items-center gap-2 mt-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleCompleted(quest.id); }}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isCompleted ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-600"}`}
                      >
                        {isCompleted && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <RewardChips quest={quest} />
                      <svg
                        className={`w-4 h-4 text-slate-600 ml-auto transition-all duration-200 ${isExpanded ? "rotate-180 text-orange-400" : ""}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* 확장 상세 */}
                  {isExpanded && (
                    <ExpandedDetail
                      quest={quest}
                      onGoDetail={() => router.push(`/quests/${quest.id}`)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ═══ 그리드 뷰 (카드 매거진 스타일) ═══ */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayQuests.map((quest) => {
            const isCompleted = completed.has(quest.id);
            const isFav = favorites.has(quest.id);
            const level = quest.level_req || 0;
            const hasRewards = (quest.exp_reward && quest.exp_reward > 0) || (quest.meso_reward && quest.meso_reward > 0);
            const diff = quest.difficulty ? DIFFICULTY_MAP[quest.difficulty] : null;
            const borderCls = diff ? diff.bg.split(" ")[1] : "border-slate-700/50";

            return (
              <div
                key={quest.id}
                onClick={() => router.push(`/quests/${quest.id}`)}
                className={`relative group bg-slate-900/80 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20 border ${
                  isCompleted ? "opacity-50 border-slate-700/30" : borderCls
                }`}
              >
                {/* 상단 컬러 스트립 */}
                <div className={`h-1 ${diff ? diff.dot : "bg-slate-700"}`} />

                <div className="p-4 space-y-3">
                  {/* 헤더 */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-bold text-slate-400">Lv.{level}</span>
                        <DifficultyDot difficulty={quest.difficulty} />
                        <ChainBadge quest={quest} />
                      </div>
                      <h3 className={`font-bold text-sm text-slate-100 group-hover:text-orange-400 transition-colors leading-snug ${isCompleted ? "line-through" : ""}`}>
                        {quest.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(quest.id); }}
                        className={`text-lg leading-none transition-colors ${isFav ? "text-yellow-400" : "text-slate-700 hover:text-yellow-500"}`}
                      >
                        {isFav ? "\u2605" : "\u2606"}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleCompleted(quest.id); }}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          isCompleted ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-600 hover:border-orange-400"
                        }`}
                      >
                        {isCompleted && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 메타 정보 */}
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {quest.area}
                    </span>
                    {quest.start_location && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {quest.start_location}
                      </span>
                    )}
                    {quest.quest_type && quest.quest_type !== "일반" && (
                      <span className={`px-1.5 py-0.5 rounded ${
                        quest.quest_type === "반복" ? "bg-amber-500/15 text-amber-400" :
                        quest.quest_type === "히든" ? "bg-pink-500/15 text-pink-400" :
                        quest.quest_type === "월드이동" ? "bg-purple-500/15 text-purple-400" :
                        "bg-slate-700/60 text-slate-400"
                      }`}>
                        {quest.quest_type}
                      </span>
                    )}
                  </div>

                  {/* 보상 */}
                  {hasRewards && (
                    <div className="pt-2 border-t border-slate-800">
                      <RewardChips quest={quest} />
                    </div>
                  )}

                  {/* 팁 미리보기 */}
                  {quest.tip && (
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {quest.tip}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ 페이지네이션 ═══ */}
      <Pagination page={page} totalPages={Math.ceil(total / perPage)} onChange={setPage} />

      {/* 기존 페이지 링크 */}
      <div className="text-center py-4">
        <a href="/quests" className="text-xs text-slate-600 hover:text-orange-400 transition-colors">
          기존 퀘스트 페이지로 이동 &rarr;
        </a>
      </div>

      {/* 커스텀 스타일 */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes questFadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-questFadeIn {
          animation: questFadeIn 0.2s ease-out;
        }
        .quest-scrollbar-thin::-webkit-scrollbar {
          height: 4px;
        }
        .quest-scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .quest-scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.2);
          border-radius: 2px;
        }
      ` }} />
    </div>
  );
}

/* ── 페이지 export ── */
export default function QuestsBetaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-4 border-slate-700 rounded-full" />
            <div className="absolute inset-0 border-4 border-transparent border-t-orange-500 rounded-full animate-spin" />
          </div>
          <span className="text-sm text-slate-500">로딩 중...</span>
        </div>
      }
    >
      <QuestsBetaContent />
    </Suspense>
  );
}
