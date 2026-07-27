"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import DataTable from "@/components/DataTable";
import Pagination from "@/components/Pagination";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

/* ─── Types ─── */
interface DashboardStats {
  quest_stats: { total: number; mapleland: number; rewarded: number };
  area_distribution: { area: string; count: number }[];
  name_language: { korean: number; english: number; has_kr_translation: number };
  level_distribution: { range: string; count: number }[];
  quality: {
    area_null_count: number; area_null_pct: number;
    level_zero_count: number; level_zero_pct: number;
    has_reward_count: number; has_reward_pct: number;
  };
  entity_counts: Record<string, number>;
  crawl_status: Record<string, { crawled: number; total: number; pct: number; latest: string | null }>;
}

interface QuestRow {
  id: number;
  name: string;
  name_kr: string | null;
  level_req: number;
  area: string | null;
  difficulty: string | null;
  quest_type: string | null;
  is_mapleland: number;
  exp_reward: number;
  meso_reward: number;
  item_reward: string | null;
  start_location: string | null;
}

/* ─── Colors ─── */
const CHART_COLORS = [
  "#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444",
  "#06b6d4", "#f59e0b", "#ec4899", "#14b8a6", "#6366f1",
  "#84cc16", "#e11d48",
];

const PIE_COLORS = ["#f97316", "#3b82f6", "#9ca3af"];

/* ─── Stat Card Component ─── */
function StatCard({ label, value, sub, color = "orange" }: { label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    orange: "border-orange-400 bg-orange-50 dark:bg-orange-900/20",
    blue: "border-blue-400 bg-blue-50 dark:bg-blue-900/20",
    green: "border-green-400 bg-green-50 dark:bg-green-900/20",
    purple: "border-purple-400 bg-purple-50 dark:bg-purple-900/20",
    red: "border-red-400 bg-red-50 dark:bg-red-900/20",
  };
  return (
    <div className={`rounded-xl border-l-4 p-4 ${colors[color] || colors.orange}`}>
      <div className="text-sm text-dim font-pixel">{label}</div>
      <div className="text-2xl font-bold text-ink mt-1">{typeof value === "number" ? value.toLocaleString() : value}</div>
      {sub && <div className="text-xs text-dim mt-1">{sub}</div>}
    </div>
  );
}

/* ─── Quality Bar ─── */
function QualityBar({ label, count, total, pct, good }: { label: string; count: number; total: number; pct: number; good: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 text-sm text-dim shrink-0">{label}</span>
      <div className="flex-1 bg-surface2 rounded-full h-5 relative overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${good ? "bg-green-500" : "bg-red-400"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-ink">
          {count.toLocaleString()} / {total.toLocaleString()} ({pct}%)
        </span>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function AdminDataPage() {
  return <AdminDataContent />;
}

function AdminDataContent() {
  const [passwordInput, setPasswordInput] = useState("");
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"quests" | "data" | "table">("quests");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);

  // Table state
  const [quests, setQuests] = useState<QuestRow[]>([]);
  const [questTotal, setQuestTotal] = useState(0);
  const [questPage, setQuestPage] = useState(1);
  const [questSearch, setQuestSearch] = useState("");
  const [questArea, setQuestArea] = useState("");
  const [questCategory, setQuestCategory] = useState("");
  const [questMapleland, setQuestMapleland] = useState("all");
  const [areas, setAreas] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const perPage = 50;

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    if (!passwordInput) return;
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/api/admin/verify`, {
      method: "POST",
      headers: { "X-Admin-Password": passwordInput },
    })
      .then((r) => {
        if (!r.ok) throw new Error("비밀번호가 틀립니다.");
        setPw(passwordInput);
        setPasswordInput("");
        setAuthed(true);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  // Fetch dashboard stats
  useEffect(() => {
    if (!authed) return;
    fetch(`${API_BASE}/api/export/dashboard-stats`, {
      headers: { "X-Admin-Password": pw },
    })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, [authed, pw]);

  // Fetch quest table
  const fetchQuests = useCallback(() => {
    if (!authed) return;
    const params = new URLSearchParams({
      page: String(questPage), per_page: String(perPage),
    });
    if (questSearch) params.set("q", questSearch);
    if (questArea) params.set("area", questArea);
    if (questCategory) params.set("category", questCategory);
    if (questMapleland !== "all") params.set("is_mapleland", questMapleland);

    fetch(`${API_BASE}/api/export/all-quests?${params}`, {
      headers: { "X-Admin-Password": pw },
    })
      .then((r) => r.json())
      .then((data) => {
        setQuests(data.quests || []);
        setQuestTotal(data.total || 0);
        if (data.filters) {
          setAreas(data.filters.areas || []);
          setCategories(data.filters.categories || []);
        }
      })
      .catch(() => {});
  }, [authed, pw, questPage, questSearch, questArea, questCategory, questMapleland]);

  useEffect(() => {
    if (tab === "table") fetchQuests();
  }, [tab, fetchQuests]);

  async function downloadProtected(path: string, filename: string) {
    setError("");
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { "X-Admin-Password": pw },
    });
    if (!response.ok) {
      setError("다운로드에 실패했습니다. 다시 로그인해 주세요.");
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!authed) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <form onSubmit={handleLogin} className="pixel-panel w-full max-w-sm p-6 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-xl font-bold font-pixel text-ink mb-2">접근 제한</h1>
          <p className="text-sm text-dim mb-5">관리자 비밀번호는 주소에 남기지 않고 요청 헤더로만 전송됩니다.</p>
          <label htmlFor="admin-data-password" className="sr-only">관리자 비밀번호</label>
          <input
            id="admin-data-password"
            type="password"
            value={passwordInput}
            onChange={(event) => setPasswordInput(event.target.value)}
            autoComplete="current-password"
            className="pixel-input w-full px-3 py-2 mb-3"
            placeholder="관리자 비밀번호"
          />
          {error && <p role="alert" className="text-sm text-mush mb-3">{error}</p>}
          <button type="submit" className="pixel-btn w-full px-4 py-2" disabled={loading}>
            {loading ? "확인 중..." : "로그인"}
          </button>
        </form>
      </div>
    );
  }

  const tabs = [
    { key: "quests" as const, label: "퀘스트 현황" },
    { key: "data" as const, label: "전체 데이터 현황" },
    { key: "table" as const, label: "퀘스트 전체 목록" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-pixel text-ink">관리자 데이터 대시보드</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => downloadProtected("/api/export/quests?format=xlsx", "quests_export.xlsx")}
            className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
          >
            <DownloadIcon /> 퀘스트 엑셀
          </button>
          <button
            type="button"
            onClick={() => downloadProtected("/api/export/all-data", "all_data_export.xlsx")}
            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            <DownloadIcon /> 전체 데이터 엑셀
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b-2 border-edge">
        <div className="flex gap-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-sm font-pixel border-b-2 transition-colors ${
                tab === t.key
                  ? "border-maple text-maple"
                  : "border-transparent text-dim hover:text-maple"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {tab === "quests" && stats && <QuestDashboard stats={stats} />}
      {tab === "data" && stats && <DataOverview stats={stats} />}
      {tab === "table" && (
        <QuestTable
          quests={quests}
          total={questTotal}
          page={questPage}
          perPage={perPage}
          search={questSearch}
          area={questArea}
          category={questCategory}
          mapleland={questMapleland}
          areas={areas}
          categories={categories}
          onPageChange={setQuestPage}
          onSearchChange={(v) => { setQuestSearch(v); setQuestPage(1); }}
          onAreaChange={(v) => { setQuestArea(v); setQuestPage(1); }}
          onCategoryChange={(v) => { setQuestCategory(v); setQuestPage(1); }}
          onMaplelandChange={(v) => { setQuestMapleland(v); setQuestPage(1); }}
          onDownload={() => downloadProtected("/api/export/quests?format=xlsx", "quests_export.xlsx")}
        />
      )}
      {error && <p role="alert" className="text-sm text-mush">{error}</p>}
      {!stats && tab !== "table" && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-maple border-t-transparent" />
        </div>
      )}
    </div>
  );
}

/* ─── Tab 1: Quest Dashboard ─── */
function QuestDashboard({ stats }: { stats: DashboardStats }) {
  const { quest_stats, area_distribution, name_language, level_distribution, quality } = stats;

  const langData = [
    { name: "한국어 이름", value: name_language.korean },
    { name: "영어 이름", value: name_language.english },
  ];

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="전체 퀘스트" value={quest_stats.total} color="orange" />
        <StatCard label="메이플랜드 퀘스트" value={quest_stats.mapleland} sub={`전체의 ${quest_stats.total > 0 ? ((quest_stats.mapleland / quest_stats.total) * 100).toFixed(1) : 0}%`} color="blue" />
        <StatCard label="보상 있는 퀘스트" value={quest_stats.rewarded} sub={`전체의 ${quest_stats.total > 0 ? ((quest_stats.rewarded / quest_stats.total) * 100).toFixed(1) : 0}%`} color="green" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Area Bar Chart */}
        <div className="pixel-panel p-5">
          <h3 className="text-sm font-semibold font-pixel text-ink mb-4">지역별 퀘스트 수</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={area_distribution.slice(0, 12)} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="area" width={120} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--tooltip-bg, #fff)", border: "1px solid #e5e7eb", borderRadius: 8 }}
              />
              <Bar dataKey="count" name="퀘스트 수" radius={[0, 4, 4, 0]}>
                {area_distribution.slice(0, 12).map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Language Pie Chart */}
        <div className="pixel-panel p-5">
          <h3 className="text-sm font-semibold font-pixel text-ink mb-4">이름 언어 분포</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={langData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }: { name?: string; percent?: number }) => `${name || ""} ${((percent || 0) * 100).toFixed(1)}%`}>
                {langData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          <div className="text-center text-xs text-dim mt-2">
            한국어 번역 보유: {name_language.has_kr_translation.toLocaleString()}건
          </div>
        </div>
      </div>

      {/* Level Distribution */}
      <div className="pixel-panel p-5">
        <h3 className="text-sm font-semibold font-pixel text-ink mb-4">레벨 분포 히스토그램</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={level_distribution}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="range" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ borderRadius: 8 }} />
            <Bar dataKey="count" name="퀘스트 수" fill="#f97316" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Data Quality */}
      <div className="pixel-panel p-5">
        <h3 className="text-sm font-semibold font-pixel text-ink mb-4">데이터 품질 지표</h3>
        <div className="space-y-3">
          <QualityBar label="area 비어있음" count={quality.area_null_count} total={quest_stats.total} pct={quality.area_null_pct} good={false} />
          <QualityBar label="level = 0" count={quality.level_zero_count} total={quest_stats.total} pct={quality.level_zero_pct} good={false} />
          <QualityBar label="보상 있음" count={quality.has_reward_count} total={quest_stats.total} pct={quality.has_reward_pct} good={true} />
        </div>
      </div>
    </div>
  );
}

/* ─── Tab 2: Data Overview ─── */
function DataOverview({ stats }: { stats: DashboardStats }) {
  const { entity_counts, crawl_status } = stats;

  const entityMeta: Record<string, { label: string; color: string; icon: string }> = {
    items: { label: "아이템", color: "blue", icon: "🎒" },
    mobs: { label: "몬스터", color: "red", icon: "👾" },
    maps: { label: "맵", color: "green", icon: "🗺" },
    npcs: { label: "NPC", color: "purple", icon: "🧑" },
    quests: { label: "퀘스트", color: "orange", icon: "📜" },
  };

  return (
    <div className="space-y-8">
      {/* Entity count cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Object.entries(entity_counts).map(([key, count]) => {
          const meta = entityMeta[key] || { label: key, color: "orange", icon: "📦" };
          return (
            <StatCard
              key={key}
              label={`${meta.icon} ${meta.label}`}
              value={count}
              color={meta.color}
            />
          );
        })}
      </div>

      {/* Crawling status */}
      <div className="pixel-panel p-5">
        <h3 className="text-sm font-semibold font-pixel text-ink mb-4">크롤링 상태</h3>
        <div className="space-y-4">
          {Object.entries(crawl_status).map(([key, info]) => {
            const meta = entityMeta[key] || { label: key, color: "orange", icon: "📦" };
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-ink">
                    {meta.icon} {meta.label}
                  </span>
                  <span className="text-xs text-dim">
                    {info.latest ? `최근: ${info.latest}` : "크롤링 기록 없음"}
                  </span>
                </div>
                <div className="w-full bg-surface2 rounded-full h-4 relative overflow-hidden">
                  <div
                    className="h-full bg-maple rounded-full transition-all"
                    style={{ width: `${Math.min(info.pct, 100)}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-ink">
                    {info.crawled.toLocaleString()} / {info.total.toLocaleString()} ({info.pct}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Tab 3: Quest Table ─── */
function QuestTable({
  quests, total, page, perPage, search, area, category: difficulty, mapleland,
  areas, categories: difficulties, onPageChange, onSearchChange, onAreaChange, onCategoryChange: onDifficultyChange, onMaplelandChange, onDownload,
}: {
  quests: QuestRow[];
  total: number;
  page: number;
  perPage: number;
  search: string;
  area: string;
  category: string;
  mapleland: string;
  areas: string[];
  categories: string[];
  onPageChange: (p: number) => void;
  onSearchChange: (v: string) => void;
  onAreaChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onMaplelandChange: (v: string) => void;
  onDownload: () => void;
}) {
  const totalPages = Math.ceil(total / perPage);

  const columns = [
    { key: "id", label: "ID", sortable: false },
    { key: "name", label: "이름", sortable: false, render: (r: QuestRow) => (
      <div>
        <div className="font-medium">{r.name}</div>
        {r.name_kr && <div className="text-xs text-dim">{r.name_kr}</div>}
      </div>
    )},
    { key: "level_req", label: "레벨", sortable: false },
    { key: "area", label: "지역", sortable: false, render: (r: QuestRow) => r.area || "-" },
    { key: "difficulty", label: "난이도", sortable: false, render: (r: QuestRow) => r.difficulty || "-" },
    { key: "is_mapleland", label: "메랜", sortable: false, render: (r: QuestRow) => (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.is_mapleland ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-surface2 text-dim"}`}>
        {r.is_mapleland ? "O" : "X"}
      </span>
    )},
    { key: "exp_reward", label: "EXP", sortable: false, render: (r: QuestRow) => r.exp_reward ? r.exp_reward.toLocaleString() : "-" },
    { key: "meso_reward", label: "메소", sortable: false, render: (r: QuestRow) => r.meso_reward ? r.meso_reward.toLocaleString() : "-" },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-dim mb-1 font-pixel">검색</label>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="퀘스트명 또는 ID..."
            className="pixel-input w-full px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-dim mb-1 font-pixel">지역</label>
          <select
            value={area}
            onChange={(e) => onAreaChange(e.target.value)}
            className="pixel-input px-3 py-2 text-sm"
          >
            <option value="">전체</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-dim mb-1 font-pixel">난이도</label>
          <select
            value={difficulty}
            onChange={(e) => onDifficultyChange(e.target.value)}
            className="pixel-input px-3 py-2 text-sm"
          >
            <option value="">전체</option>
            {difficulties.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-dim mb-1 font-pixel">메이플랜드</label>
          <select
            value={mapleland}
            onChange={(e) => onMaplelandChange(e.target.value)}
            className="pixel-input px-3 py-2 text-sm"
          >
            <option value="all">전체</option>
            <option value="1">메이플랜드만</option>
            <option value="0">비메이플랜드</option>
          </select>
        </div>
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
        >
          <DownloadIcon /> 엑셀 다운로드
        </button>
      </div>

      {/* Result count */}
      <div className="text-sm text-dim">
        총 {total.toLocaleString()}건
      </div>

      {/* Table */}
      <DataTable columns={columns} data={quests} />

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} onChange={onPageChange} />
    </div>
  );
}

/* ─── Icons ─── */
function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
