"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getQuests, getQuestCategories } from "@/lib/api";
import type { Quest } from "@/lib/types";
import DataTable, { Column } from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import QuestCard, { LevelBadge } from "@/components/QuestCard";
import { useQueryState } from "@/lib/useQueryState";

/* ── 뷰 타입 ── */
type ViewMode = "card" | "table";

/* ── 로컬스토리지 완료 퀘스트 관리 ── */
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

/* ── 사이드바 필터 ── */
function QuestSidebarFilter({
  categories,
  areas,
  questTypes,
  filterValues,
  onChange,
  mobileOpen,
  onClose,
}: {
  categories: string[];
  areas: string[];
  questTypes: string[];
  filterValues: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const update = (key: string, value: string) => {
    onChange({ ...filterValues, [key]: value });
  };

  const filterContent = (
    <div className="space-y-5">
      {/* 검색 */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">퀘스트 검색</label>
        <input
          type="text"
          value={filterValues.q || ""}
          onChange={(e) => update("q", e.target.value)}
          placeholder="이름으로 검색..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
        />
      </div>

      {/* 레벨 범위 */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">레벨 범위</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={filterValues.level_min || ""}
            onChange={(e) => update("level_min", e.target.value)}
            placeholder="최소"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-400"
          />
          <span className="text-gray-400">~</span>
          <input
            type="number"
            value={filterValues.level_max || ""}
            onChange={(e) => update("level_max", e.target.value)}
            placeholder="최대"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-400"
          />
        </div>
      </div>

      {/* 지역 */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">지역</label>
        <select
          value={filterValues.area || ""}
          onChange={(e) => update("area", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-400"
        >
          <option value="">전체</option>
          {areas.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* 카테고리 */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">카테고리</label>
        <select
          value={filterValues.category || ""}
          onChange={(e) => update("category", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-400"
        >
          <option value="">전체</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* 퀘스트 유형 */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">퀘스트 유형</label>
        <select
          value={filterValues.quest_type || ""}
          onChange={(e) => update("quest_type", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-400"
        >
          <option value="">전체</option>
          {questTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* 보상 있는 퀘스트만 */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filterValues.has_rewards === "1"}
            onChange={(e) => update("has_rewards", e.target.checked ? "1" : "")}
            className="rounded border-gray-300 dark:border-gray-600 text-orange-500 focus:ring-orange-400"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">보상 있는 퀘스트만</span>
        </label>
      </div>

      {/* 정렬 */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">정렬</label>
        <select
          value={filterValues.sort || ""}
          onChange={(e) => update("sort", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-400"
        >
          <option value="">레벨 오름차순</option>
          <option value="level_desc">레벨 내림차순</option>
          <option value="exp_reward">경험치 보상순</option>
          <option value="meso_reward">메소 보상순</option>
          <option value="name">이름순</option>
        </select>
      </div>

      {/* 필터 초기화 */}
      <button
        onClick={() => onChange({})}
        className="w-full py-2 text-sm text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
      >
        필터 초기화
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:block w-64 flex-shrink-0">
        <div className="sticky top-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-4">필터</h2>
          {filterContent}
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={onClose} />
          <div className="absolute right-0 top-0 h-full w-80 max-w-full bg-white dark:bg-gray-800 shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-bold">필터</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">{filterContent}</div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── 테이블 컬럼 정의 ── */
const tableColumns: Column<Quest>[] = [
  {
    key: "name",
    label: "이름",
    render: (row) => (
      <div className="min-w-0">
        <span className="font-medium">{row.name}</span>
        {row.name_kr && row.name_kr !== row.name && (
          <span className="text-xs text-gray-400 ml-1">({row.name_kr})</span>
        )}
      </div>
    ),
  },
  {
    key: "level_req",
    label: "레벨",
    render: (row) => <LevelBadge level={row.level_req || row.start_level || 0} />,
  },
  {
    key: "area",
    label: "지역",
    render: (row) => (
      <span className="text-xs text-gray-500 dark:text-gray-400">{row.area || "-"}</span>
    ),
  },
  {
    key: "quest_type",
    label: "유형",
    render: (row) => (
      <span className="text-xs">{row.quest_type || "-"}</span>
    ),
  },
  {
    key: "npc_start",
    label: "시작 NPC",
    render: (row) => <span className="text-xs">{row.npc_start || "-"}</span>,
  },
  {
    key: "exp_reward",
    label: "EXP 보상",
    render: (row) => (
      <span className={`text-xs ${(row.exp_reward || 0) > 0 ? "text-blue-600 dark:text-blue-400 font-medium" : "text-gray-400"}`}>
        {(row.exp_reward || 0) > 0 ? (row.exp_reward || 0).toLocaleString() : "-"}
      </span>
    ),
  },
];

/* ── 메인 컴포넌트 ── */
function QuestsPageContent() {
  const router = useRouter();
  const { filterValues, page, setFilterValues, setPage } = useQueryState();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [questTypes, setQuestTypes] = useState<string[]>([]);
  const { completed, toggle: toggleCompleted } = useCompletedQuests();
  const perPage = 24;

  // Load filter options
  useEffect(() => {
    getQuestCategories()
      .then((d) => {
        setCategories(d.categories);
        setAreas(d.areas);
        setQuestTypes(d.quest_types);
      })
      .catch(() => {});
  }, []);

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

  return (
    <div className="flex gap-6">
      {/* Sidebar Filter */}
      <QuestSidebarFilter
        categories={categories}
        areas={areas}
        questTypes={questTypes}
        filterValues={filterValues}
        onChange={setFilterValues}
        mobileOpen={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">퀘스트</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              총 {total.toLocaleString()}건
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile filter toggle */}
            <button
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              title="필터"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
            {/* View toggle */}
            <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("card")}
                className={`p-2 transition-colors ${viewMode === "card" ? "bg-orange-500 text-white" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                title="카드 뷰"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-2 transition-colors ${viewMode === "table" ? "bg-orange-500 text-white" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                title="테이블 뷰"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-orange-500 rounded-full animate-spin mb-3" />
            <p>로딩 중...</p>
          </div>
        ) : quests.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg mb-1">검색 결과가 없습니다</p>
            <p className="text-sm">필터 조건을 변경해보세요</p>
          </div>
        ) : viewMode === "card" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {quests.map((quest) => (
              <QuestCard
                key={quest.id}
                quest={quest}
                onClick={() => router.push(`/quests/${quest.id}`)}
                checked={completed.has(quest.id)}
                onToggleCheck={() => toggleCompleted(quest.id)}
              />
            ))}
          </div>
        ) : (
          <DataTable
            columns={tableColumns}
            data={quests}
            onRowClick={(row) => router.push(`/quests/${row.id}`)}
          />
        )}

        {/* Pagination */}
        <Pagination page={page} totalPages={Math.ceil(total / perPage)} onChange={setPage} />
      </div>
    </div>
  );
}

export default function QuestsPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-16 text-gray-400">
          <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-orange-500 rounded-full animate-spin mb-3" />
          <p>로딩 중...</p>
        </div>
      }
    >
      <QuestsPageContent />
    </Suspense>
  );
}
