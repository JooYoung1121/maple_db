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
  if (!diff) return <span className="w-2.5 h-2.5 rounded-full bg-edge inline-block" />;
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
      <span className="text-xs font-mono font-bold text-ink w-8 text-right">{level || "-"}</span>
      <div className="flex-1 h-1.5 bg-surface2 rounded-full overflow-hidden">
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
  if (chips.length === 0) return <span className="text-xs text-dim">-</span>;
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
      <div className="pixel-panel grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface2 p-4">
        {/* 왼쪽: 기본 정보 */}
        <div className="space-y-3">
          <h4 className="text-xs font-pixel text-dim uppercase tracking-wider">기본 정보</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-dim">지역</span>
              <span className="text-ink">{quest.area}</span>
            </div>
            {quest.start_location && (
              <div className="flex justify-between">
                <span className="text-dim">시작 위치</span>
                <span className="text-ink">{quest.start_location}</span>
              </div>
            )}
            {quest.quest_type && (
              <div className="flex justify-between">
                <span className="text-dim">유형</span>
                <span className="text-ink">{quest.quest_type}</span>
              </div>
            )}
            {quest.difficulty && (
              <div className="flex justify-between">
                <span className="text-dim">난이도</span>
                <DifficultyDot difficulty={quest.difficulty} />
              </div>
            )}
          </div>
        </div>

        {/* 가운데: 조건 & 팁 */}
        <div className="space-y-3">
          <h4 className="text-xs font-pixel text-dim uppercase tracking-wider">퀘스트 조건 / 팁</h4>
          {quest.quest_conditions && quest.quest_conditions.length > 0 ? (
            <ul className="space-y-1.5">
              {quest.quest_conditions.map((cond, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                  <span className="text-ink">{cond}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-dim">조건 정보 없음</p>
          )}
          {quest.tip && (
            <div className="border-t border-edge/40 pt-2 mt-2">
              <span className="text-[10px] text-dim uppercase block mb-1">TIP</span>
              <p className="text-xs text-dim leading-relaxed">{quest.tip}</p>
            </div>
          )}
          {quest.note && (
            <div className="border-t border-edge/40 pt-2 mt-2">
              <span className="text-[10px] text-dim uppercase block mb-1">NOTE</span>
              <p className="text-xs text-dim leading-relaxed">{quest.note}</p>
            </div>
          )}
        </div>

        {/* 오른쪽: 보상 & 체인 */}
        <div className="space-y-3">
          <h4 className="text-xs font-pixel text-dim uppercase tracking-wider">보상</h4>
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
              <p className="text-xs text-dim">보상 정보 없음</p>
            )}
          </div>

          {/* 체인 퀘스트 연결 */}
          {chainQuests.length > 0 && (
            <div className="border-t border-edge/40 pt-3 mt-2">
              <h4 className="text-xs font-pixel text-dim uppercase tracking-wider mb-2">체인 퀘스트</h4>
              <div className="space-y-1.5">
                {chainQuests.map((cq) => (
                  <div key={cq.id} className="flex items-center gap-1.5 text-xs">
                    <svg className="w-3 h-3 text-maple" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span className="text-ink">{cq.name}</span>
                    <span className="text-dim ml-auto">Lv.{cq.level_req}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 상세보기 버튼 */}
          <button
            onClick={onGoDetail}
            className="pixel-btn w-full mt-2 px-4 py-2 text-xs font-pixel"
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
      <div className="pixel-panel relative overflow-hidden bg-surface p-6">
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
              <span className="pixel-badge px-2 py-0.5 text-maple text-[10px] font-pixel uppercase tracking-wider">Beta</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-pixel text-ink tracking-tight">
              퀘스트 데이터베이스
            </h1>
            <p className="text-sm text-dim mt-1">메이플랜드 전체 퀘스트를 인터랙티브 테이블로 탐색하세요</p>
          </div>
          {/* 미니 통계 */}
          <div className="flex gap-4 text-center">
            <div className="pixel-panel bg-surface2 px-4 py-2">
              <div className="text-lg font-bold text-ink">{total.toLocaleString()}</div>
              <div className="text-[10px] font-pixel text-dim uppercase">전체 퀘스트</div>
            </div>
            <div className="pixel-panel bg-surface2 px-4 py-2">
              <div className="text-lg font-bold text-emerald-400">{stats.completedCount}</div>
              <div className="text-[10px] font-pixel text-dim uppercase">완료</div>
            </div>
            <div className="pixel-panel bg-surface2 px-4 py-2">
              <div className="text-lg font-bold text-blue-400">{stats.totalExp.toLocaleString()}</div>
              <div className="text-[10px] font-pixel text-dim uppercase">페이지 총 EXP</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 필터 바 (sticky) ═══ */}
      <div className="pixel-panel bg-surface p-4 space-y-3 sticky top-[64px] z-30">
        {/* 첫 번째 줄: 지역 탭 */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 quest-scrollbar-thin">
          {AREAS.map((area) => (
            <button
              key={area.value}
              onClick={() => updateFilter("area", area.value)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm transition-all duration-200 ${
                currentArea === area.value
                  ? "pixel-btn font-pixel"
                  : "font-pixel text-dim hover:text-maple hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]"
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
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={filterValues.q || ""}
              onChange={(e) => updateFilter("q", e.target.value)}
              placeholder="퀘스트 이름, 위치, 보상 검색..."
              className="pixel-input w-full pl-10 pr-4 py-2 text-sm"
            />
          </div>

          {/* 레벨 범위 */}
          <div className="flex items-center gap-1.5 border-2 border-edge bg-surface2 px-3 py-1">
            <span className="text-xs text-dim font-medium">LV</span>
            <input
              type="number"
              value={filterValues.level_min || ""}
              onChange={(e) => updateFilter("level_min", e.target.value)}
              placeholder="0"
              className="w-12 bg-transparent text-sm text-ink text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-dim">~</span>
            <input
              type="number"
              value={filterValues.level_max || ""}
              onChange={(e) => updateFilter("level_max", e.target.value)}
              placeholder="200"
              className="w-12 bg-transparent text-sm text-ink text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          {/* 정렬 */}
          <div className="relative">
            <select
              value={currentSort}
              onChange={(e) => updateFilter("sort", e.target.value)}
              className="pixel-input appearance-none pl-3 pr-8 py-2 text-sm cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dim pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* 보상 필터 */}
          <button
            onClick={() => updateFilter("has_rewards", filterValues.has_rewards === "1" ? "" : "1")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-pixel transition-all border-2 ${
              filterValues.has_rewards === "1"
                ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                : "border-edge bg-surface2 text-dim hover:text-maple"
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
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-pixel transition-all border-2 ${
              hideCompleted
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                : "border-edge bg-surface2 text-dim hover:text-maple"
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
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-pixel transition-all border-2 ${
              showFavOnly
                ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-400"
                : "border-edge bg-surface2 text-dim hover:text-maple"
            }`}
          >
            {showFavOnly ? "\u2605" : "\u2606"}
          </button>

          {/* 뷰 모드 토글 */}
          <div className="flex border-2 border-edge bg-surface2 overflow-hidden">
            <button
              onClick={() => setViewMode("table")}
              className={`px-2.5 py-2 transition-colors ${viewMode === "table" ? "bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] text-maple" : "text-dim hover:text-maple"}`}
              title="테이블 뷰"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`px-2.5 py-2 transition-colors ${viewMode === "grid" ? "bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] text-maple" : "text-dim hover:text-maple"}`}
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
            <div className="absolute inset-0 border-4 border-edge rounded-full" />
            <div className="absolute inset-0 border-4 border-transparent border-t-maple rounded-full animate-spin" />
          </div>
          <span className="text-sm text-dim">퀘스트 데이터 로딩 중...</span>
        </div>
      ) : displayQuests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="pixel-panel w-16 h-16 bg-surface2 flex items-center justify-center text-3xl text-dim">
            ?
          </div>
          <p className="text-ink font-medium">검색 결과가 없습니다</p>
          <p className="text-sm text-dim">필터 조건을 변경해보세요</p>
        </div>
      ) : viewMode === "table" ? (
        /* ═══ 테이블 뷰 ═══ */
        <div ref={tableRef} className="pixel-panel bg-surface overflow-hidden">
          {/* 테이블 헤더 */}
          <div className="hidden md:grid grid-cols-[40px_40px_1fr_120px_100px_160px_80px] gap-2 px-4 py-2.5 bg-surface2 border-b-2 border-edge text-[11px] font-pixel text-dim uppercase tracking-wider">
            <div />
            <div />
            <div>퀘스트</div>
            <div>레벨</div>
            <div>난이도</div>
            <div>보상</div>
            <div className="text-center">상태</div>
          </div>

          {/* 테이블 행 */}
          <div className="divide-y divide-edge/40">
            {displayQuests.map((quest) => {
              const isExpanded = expandedId === quest.id;
              const isCompleted = completed.has(quest.id);
              const isFav = favorites.has(quest.id);
              const level = quest.level_req || 0;

              return (
                <div
                  key={quest.id}
                  className={`transition-all duration-150 ${isCompleted ? "opacity-50" : ""} ${isExpanded ? "bg-surface2" : "hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]"}`}
                >
                  {/* 메인 행 */}
                  <div
                    className="grid grid-cols-1 md:grid-cols-[40px_40px_1fr_120px_100px_160px_80px] gap-2 px-4 py-3 items-center cursor-pointer group"
                    onClick={() => setExpandedId(isExpanded ? null : quest.id)}
                  >
                    {/* 즐겨찾기 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(quest.id); }}
                      className={`hidden md:block text-center text-lg leading-none transition-all ${isFav ? "text-yellow-400 scale-110" : "text-dim group-hover:text-ink"}`}
                    >
                      {isFav ? "\u2605" : "\u2606"}
                    </button>

                    {/* 난이도 도트 */}
                    <div className="hidden md:flex items-center justify-center">
                      <span className={`w-2.5 h-2.5 rounded-full ${quest.difficulty && DIFFICULTY_MAP[quest.difficulty] ? DIFFICULTY_MAP[quest.difficulty].dot : "bg-edge"}`}
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
                            className={`text-lg leading-none ${isFav ? "text-yellow-400" : "text-dim"}`}
                          >
                            {isFav ? "\u2605" : "\u2606"}
                          </button>
                          <DifficultyDot difficulty={quest.difficulty} />
                        </span>
                        <span className={`font-semibold text-sm text-ink group-hover:text-maple transition-colors ${isCompleted ? "line-through" : ""}`}>
                          {quest.name}
                        </span>
                        <ChainBadge quest={quest} />
                      </div>
                      {/* 모바일 전용 하단 정보 */}
                      <div className="md:hidden flex items-center gap-3 mt-1 text-xs text-dim">
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
                          "bg-surface2 text-dim"
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
                            : "border-edge hover:border-maple group-hover:border-edge"
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
                        className={`w-4 h-4 text-dim group-hover:text-ink transition-all duration-200 ${isExpanded ? "rotate-180 text-maple" : ""}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>

                    {/* 모바일 전용 버튼 */}
                    <div className="md:hidden flex items-center gap-2 mt-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleCompleted(quest.id); }}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isCompleted ? "bg-emerald-500 border-emerald-500 text-white" : "border-edge"}`}
                      >
                        {isCompleted && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <RewardChips quest={quest} />
                      <svg
                        className={`w-4 h-4 text-dim ml-auto transition-all duration-200 ${isExpanded ? "rotate-180 text-maple" : ""}`}
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
            const borderCls = diff ? diff.bg.split(" ")[1] : "border-edge";

            return (
              <div
                key={quest.id}
                onClick={() => router.push(`/quests/${quest.id}`)}
                className={`pixel-card relative group bg-surface overflow-hidden cursor-pointer ${
                  isCompleted ? "opacity-50 border-edge" : borderCls
                }`}
              >
                {/* 상단 컬러 스트립 */}
                <div className={`h-1 ${diff ? diff.dot : "bg-edge"}`} />

                <div className="p-4 space-y-3">
                  {/* 헤더 */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-bold text-dim">Lv.{level}</span>
                        <DifficultyDot difficulty={quest.difficulty} />
                        <ChainBadge quest={quest} />
                      </div>
                      <h3 className={`font-bold text-sm text-ink group-hover:text-maple transition-colors leading-snug ${isCompleted ? "line-through" : ""}`}>
                        {quest.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(quest.id); }}
                        className={`text-lg leading-none transition-colors ${isFav ? "text-yellow-400" : "text-dim hover:text-yellow-500"}`}
                      >
                        {isFav ? "\u2605" : "\u2606"}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleCompleted(quest.id); }}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          isCompleted ? "bg-emerald-500 border-emerald-500 text-white" : "border-edge hover:border-maple"
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
                  <div className="flex flex-wrap gap-2 text-xs text-dim">
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
                        "bg-surface2 text-dim"
                      }`}>
                        {quest.quest_type}
                      </span>
                    )}
                  </div>

                  {/* 보상 */}
                  {hasRewards && (
                    <div className="pt-2 border-t border-edge/40">
                      <RewardChips quest={quest} />
                    </div>
                  )}

                  {/* 팁 미리보기 */}
                  {quest.tip && (
                    <p className="text-[11px] text-dim line-clamp-2 leading-relaxed">
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
        <a href="/quests" className="text-xs text-dim hover:text-maple transition-colors">
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
            <div className="absolute inset-0 border-4 border-edge rounded-full" />
            <div className="absolute inset-0 border-4 border-transparent border-t-maple rounded-full animate-spin" />
          </div>
          <span className="text-sm text-dim">로딩 중...</span>
        </div>
      }
    >
      <QuestsBetaContent />
    </Suspense>
  );
}
