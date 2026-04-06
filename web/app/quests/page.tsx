"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getQuests, getQuestCategories } from "@/lib/api";
import type { Quest } from "@/lib/types";
import Pagination from "@/components/Pagination";
import QuestCard from "@/components/QuestCard";
import { useQueryState } from "@/lib/useQueryState";

/* ── 지역 버튼 매핑 ── */
const AREA_BUTTONS: { label: string; value: string }[] = [
  { label: "전체", value: "" },
  { label: "메이플 아일랜드", value: "메이플 아일랜드" },
  { label: "빅토리아", value: "빅토리아 아일랜드" },
  { label: "엘나스/아쿠아로드", value: "엘나스/아쿠아로드" },
  { label: "루디브리엄", value: "루디브리엄" },
  { label: "무릉/니할사막", value: "무릉/니할사막" },
  { label: "리프레", value: "리프레" },
  { label: "마스테리아", value: "마스테리아" },
  { label: "전직", value: "전직" },
  { label: "이벤트", value: "이벤트" },
  { label: "펫", value: "펫" },
  { label: "기타 지역", value: "기타 지역" },
];

/* ── 로컬스토리지: 완료 퀘스트 ── */
function useCompletedQuests() {
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  useEffect(() => {
    try {
      const stored = localStorage.getItem("completedQuests");
      if (stored) setCompleted(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  const toggle = useCallback((id: number) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("completedQuests", JSON.stringify([...next]));
      return next;
    });
  }, []);

  return { completed, toggle };
}

/* ── 로컬스토리지: 즐겨찾기 ── */
function useFavoriteQuests() {
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  useEffect(() => {
    try {
      const stored = localStorage.getItem("favoriteQuests");
      if (stored) setFavorites(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  const toggle = useCallback((id: number) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("favoriteQuests", JSON.stringify([...next]));
      return next;
    });
  }, []);

  return { favorites, toggle };
}

/* ── 메인 컴포넌트 ── */
function QuestsPageContent() {
  const router = useRouter();
  const { filterValues, page, setFilterValues, setPage } = useQueryState();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const { completed, toggle: toggleCompleted } = useCompletedQuests();
  const { favorites, toggle: toggleFavorite } = useFavoriteQuests();
  const perPage = 20;

  // Load quests
  useEffect(() => {
    setLoading(true);
    getQuests({ page, per_page: perPage, ...filterValues })
      .then((d) => {
        setQuests(d.quests);
        setTotal(d.total);
      })
      .catch(() => setQuests([]))
      .finally(() => setLoading(false));
  }, [page, filterValues]);

  // Filter quests client-side for completed/favorites
  const displayQuests = useMemo(() => {
    let filtered = quests;
    if (hideCompleted) {
      filtered = filtered.filter((q) => !completed.has(q.id));
    }
    if (showFavoritesOnly) {
      filtered = filtered.filter((q) => favorites.has(q.id));
    }
    return filtered;
  }, [quests, hideCompleted, showFavoritesOnly, completed, favorites]);

  const currentArea = filterValues.area || "";

  const updateFilter = (key: string, value: string) => {
    setFilterValues({ ...filterValues, [key]: value });
  };

  return (
    <div className="flex gap-4 min-h-[calc(100vh-80px)]">
      {/* ── 좌측 사이드바: 지역 버튼 ── */}
      <aside className="hidden lg:block w-48 flex-shrink-0">
        <div className="sticky top-20 space-y-1">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-2">지역</h2>
          {AREA_BUTTONS.map((area) => (
            <button
              key={area.value}
              onClick={() => updateFilter("area", area.value)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                currentArea === area.value
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/25"
                  : "text-gray-300 hover:bg-slate-700/60 hover:text-gray-100"
              }`}
            >
              {area.label}
            </button>
          ))}

          {/* 보상 있는 퀘스트만 */}
          <div className="pt-3 border-t border-slate-700/50 mt-3">
            <label className="flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm text-gray-400 hover:text-gray-200">
              <input
                type="checkbox"
                checked={filterValues.has_rewards === "1"}
                onChange={(e) => updateFilter("has_rewards", e.target.checked ? "1" : "")}
                className="rounded border-slate-500 bg-slate-700 text-orange-500 focus:ring-orange-400"
              />
              보상있는 퀘스트만
            </label>
          </div>

          {/* 정렬 */}
          <div className="pt-2">
            <select
              value={filterValues.sort || ""}
              onChange={(e) => updateFilter("sort", e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-600 rounded-lg text-xs bg-slate-800 text-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-400"
            >
              <option value="">레벨 오름차순</option>
              <option value="level_desc">레벨 내림차순</option>
              <option value="exp_reward">경험치 보상순</option>
              <option value="meso_reward">메소 보상순</option>
              <option value="name">이름순</option>
            </select>
          </div>
        </div>
      </aside>

      {/* ── 메인 콘텐츠 ── */}
      <div className="flex-1 min-w-0">
        {/* 상단 컨트롤 바 */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* 완료 숨기기 */}
            <button
              onClick={() => setHideCompleted(!hideCompleted)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                hideCompleted
                  ? "bg-orange-500 text-white"
                  : "bg-slate-700 text-gray-300 hover:bg-slate-600"
              }`}
            >
              {hideCompleted ? "완료 숨김 중" : "완료 숨기기"}
            </button>

            {/* 즐겨찾기만 */}
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showFavoritesOnly
                  ? "bg-yellow-500 text-black"
                  : "bg-slate-700 text-gray-300 hover:bg-slate-600"
              }`}
            >
              {showFavoritesOnly ? "\u2605 즐겨찾기만" : "\u2606 즐겨찾기"}
            </button>

            {/* 레벨 범위 */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Lv</span>
              <input
                type="number"
                value={filterValues.level_min || ""}
                onChange={(e) => updateFilter("level_min", e.target.value)}
                placeholder="min"
                className="w-16 px-2 py-1.5 border border-slate-600 rounded text-xs bg-slate-700 text-gray-200 focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
              <span className="text-xs text-gray-500">~</span>
              <input
                type="number"
                value={filterValues.level_max || ""}
                onChange={(e) => updateFilter("level_max", e.target.value)}
                placeholder="max"
                className="w-16 px-2 py-1.5 border border-slate-600 rounded text-xs bg-slate-700 text-gray-200 focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>

            {/* 검색 */}
            <div className="flex-1 min-w-[180px]">
              <input
                type="text"
                value={filterValues.q || ""}
                onChange={(e) => updateFilter("q", e.target.value)}
                placeholder="퀘스트 검색..."
                className="w-full px-3 py-1.5 border border-slate-600 rounded-lg text-xs bg-slate-700 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>

            {/* Mobile area selector */}
            <div className="lg:hidden">
              <select
                value={currentArea}
                onChange={(e) => updateFilter("area", e.target.value)}
                className="px-2 py-1.5 border border-slate-600 rounded text-xs bg-slate-700 text-gray-200 focus:outline-none focus:ring-1 focus:ring-orange-400"
              >
                {AREA_BUTTONS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>

            {/* Total count */}
            <span className="text-xs text-gray-500 ml-auto">
              총 {total.toLocaleString()}건
            </span>
          </div>
        </div>

        {/* 퀘스트 리스트 */}
        {loading ? (
          <div className="text-center py-16 text-gray-500">
            <div className="inline-block w-8 h-8 border-4 border-slate-600 border-t-orange-500 rounded-full animate-spin mb-3" />
            <p>로딩 중...</p>
          </div>
        ) : displayQuests.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-1">검색 결과가 없습니다</p>
            <p className="text-sm">필터 조건을 변경해보세요</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayQuests.map((quest) => (
              <QuestCard
                key={quest.id}
                quest={quest}
                onClick={() => router.push(`/quests/${quest.id}`)}
                checked={completed.has(quest.id)}
                onToggleCheck={() => toggleCompleted(quest.id)}
                favorited={favorites.has(quest.id)}
                onToggleFavorite={() => toggleFavorite(quest.id)}
              />
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        <Pagination page={page} totalPages={Math.ceil(total / perPage)} onChange={setPage} />
      </div>
    </div>
  );
}

export default function QuestsPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-16 text-gray-500">
          <div className="inline-block w-8 h-8 border-4 border-slate-600 border-t-orange-500 rounded-full animate-spin mb-3" />
          <p>로딩 중...</p>
        </div>
      }
    >
      <QuestsPageContent />
    </Suspense>
  );
}
