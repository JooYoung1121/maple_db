"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// ─── Types ───
interface MatipItem {
  name: string;
  id: number;
}

interface QuoteEntry {
  time: number;
  avg: number;
  min: number;
  max: number;
  count: number;
}

interface QuoteData {
  sellActive: QuoteEntry[];
  buyActive: QuoteEntry[];
}

type Resolution = "hour" | "day" | "month";
type FilterMode = "all" | "sell" | "buy";

// ─── Price formatting (만/억) ───
function formatPrice(n: number): string {
  if (n >= 1_0000_0000) {
    const v = n / 1_0000_0000;
    return v >= 10 ? `${Math.round(v)}억` : `${v.toFixed(1)}억`;
  }
  if (n >= 1_0000) {
    const v = n / 1_0000;
    return v >= 100 ? `${Math.round(v)}만` : `${v.toFixed(1)}만`;
  }
  return n.toLocaleString("ko-KR");
}

function formatPriceFull(n: number): string {
  return n.toLocaleString("ko-KR") + " 메소";
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDateFull(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Popular items ───
interface PopularCategory {
  label: string;
  items: { name: string; id: number }[];
}

const POPULAR_ITEMS: PopularCategory[] = [
  {
    label: "주문서",
    items: [
      { name: "활 공격력 주문서 60%", id: 2044501 },
      { name: "장갑 공격력 주문서 60%", id: 2040814 },
      { name: "지력 주문서 60%", id: 2040501 },
      { name: "활 공격력 주문서 10%", id: 2044502 },
      { name: "장갑 공격력 주문서 10%", id: 2040815 },
      { name: "활 공격력 주문서 100%", id: 2044500 },
      { name: "한손검 공격력 주문서 60%", id: 2043001 },
      { name: "두손검 공격력 주문서 60%", id: 2043101 },
      { name: "망토 마력 주문서 60%", id: 2040801 },
    ],
  },
  {
    label: "장비",
    items: [
      { name: "자드", id: 1382009 },
      { name: "청룡도", id: 1302020 },
      { name: "카슈타", id: 1050018 },
      { name: "적문", id: 1050019 },
      { name: "골드 스미스해머", id: 1422027 },
    ],
  },
  {
    label: "소비",
    items: [
      { name: "빨간 물약", id: 2000000 },
      { name: "마나 엘릭서", id: 2000006 },
      { name: "흰색 물약", id: 2000002 },
      { name: "파란 물약", id: 2000001 },
      { name: "엘릭서", id: 2000004 },
    ],
  },
];

// ─── Scroll comparison data ───
// Maps a scroll name pattern to related scroll IDs for comparison
interface ScrollVariant {
  pct: number;
  label: string;
  id: number;
  statPerSuccess: number; // expected stat boost per successful use
}

interface ScrollFamily {
  namePattern: RegExp;
  baseName: string;
  variants: ScrollVariant[];
}

const SCROLL_FAMILIES: ScrollFamily[] = [
  {
    namePattern: /활 공격력 주문서/,
    baseName: "활 공격력 주문서",
    variants: [
      { pct: 100, label: "100%", id: 2044500, statPerSuccess: 1 },
      { pct: 60, label: "60%", id: 2044501, statPerSuccess: 2 },
      { pct: 10, label: "10%", id: 2044502, statPerSuccess: 5 },
    ],
  },
  {
    namePattern: /장갑 공격력 주문서/,
    baseName: "장갑 공격력 주문서",
    variants: [
      { pct: 100, label: "100%", id: 2040813, statPerSuccess: 1 },
      { pct: 60, label: "60%", id: 2040814, statPerSuccess: 2 },
      { pct: 10, label: "10%", id: 2040815, statPerSuccess: 3 },
    ],
  },
  {
    namePattern: /한손검 공격력 주문서/,
    baseName: "한손검 공격력 주문서",
    variants: [
      { pct: 100, label: "100%", id: 2043000, statPerSuccess: 1 },
      { pct: 60, label: "60%", id: 2043001, statPerSuccess: 2 },
      { pct: 10, label: "10%", id: 2043002, statPerSuccess: 5 },
    ],
  },
  {
    namePattern: /두손검 공격력 주문서/,
    baseName: "두손검 공격력 주문서",
    variants: [
      { pct: 100, label: "100%", id: 2043100, statPerSuccess: 2 },
      { pct: 60, label: "60%", id: 2043101, statPerSuccess: 3 },
      { pct: 10, label: "10%", id: 2043102, statPerSuccess: 7 },
    ],
  },
  {
    namePattern: /망토 마력 주문서/,
    baseName: "망토 마력 주문서",
    variants: [
      { pct: 100, label: "100%", id: 2040800, statPerSuccess: 1 },
      { pct: 60, label: "60%", id: 2040801, statPerSuccess: 2 },
      { pct: 10, label: "10%", id: 2040802, statPerSuccess: 5 },
    ],
  },
];

// ─── Debounce hook ───
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ─── Skeleton ───
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
    />
  );
}

// ─── Price summary card ───
function SummaryCard({
  label,
  value,
  sub,
  change,
  color,
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  change?: number | null;
  color: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <Skeleton className="h-4 w-20 mb-2" />
        <Skeleton className="h-7 w-28 mb-1" />
        <Skeleton className="h-3 w-24" />
      </div>
    );
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>
      )}
      {change !== undefined && change !== null && (
        <p
          className={`text-xs mt-1 font-medium ${
            change > 0
              ? "text-red-500"
              : change < 0
              ? "text-blue-500"
              : "text-gray-400"
          }`}
        >
          전일 대비{" "}
          {change > 0 ? "+" : ""}
          {formatPrice(change)} ({change > 0 ? "+" : ""}
          {change !== 0 ? ((change / Math.abs(change)) * 100).toFixed(1) : "0.0"}%)
        </p>
      )}
    </div>
  );
}

// ─── Custom chart tooltip ───
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
        {formatDateFull(label)}
      </p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {formatPriceFull(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Main Page Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function MarketPage() {
  // Auth state
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem("market_auth");
    if (saved === "true") setAuthenticated(true);
  }, []);

  const handleLogin = async () => {
    setAuthError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/verify`, {
        method: "POST",
        headers: { "X-Admin-Password": passwordInput },
      });
      if (res.ok) {
        setAuthenticated(true);
        sessionStorage.setItem("market_auth", "true");
      } else {
        setAuthError("비밀번호가 틀립니다.");
      }
    } catch {
      setAuthError("서버 연결에 실패했습니다.");
    }
  };

  // Search state
  const [searchText, setSearchText] = useState("");
  const debouncedSearch = useDebounce(searchText, 400);
  const [allItems, setAllItems] = useState<MatipItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Selected item
  const [selectedItem, setSelectedItem] = useState<MatipItem | null>(null);

  // Quote data
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [resolution, setResolution] = useState<Resolution>("day");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  // Scroll comparison
  const [scrollCompData, setScrollCompData] = useState<
    Map<number, { avg: number; count: number }>
  >(new Map());
  const [scrollCompLoading, setScrollCompLoading] = useState(false);

  // ─── Fetch item list ───
  useEffect(() => {
    fetch(`${API_BASE}/api/matip/items`)
      .then((r) => r.json())
      .then((data: MatipItem[]) => {
        setAllItems(data);
        setItemsLoading(false);
      })
      .catch(() => setItemsLoading(false));
  }, []);

  // ─── Filtered autocomplete results ───
  const filteredItems = useMemo(() => {
    if (!debouncedSearch.trim()) return [];
    const q = debouncedSearch.toLowerCase();
    return allItems.filter((it) => it.name.toLowerCase().includes(q)).slice(0, 20);
  }, [debouncedSearch, allItems]);

  // ─── Click outside to close dropdown ───
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ─── Select item ───
  const selectItem = useCallback(
    (item: MatipItem) => {
      setSelectedItem(item);
      setSearchText(item.name);
      setShowDropdown(false);
    },
    []
  );

  // ─── Fetch quote when item or resolution changes ───
  useEffect(() => {
    if (!selectedItem) return;
    setQuoteLoading(true);
    fetch(
      `${API_BASE}/api/matip/quote?itemCode=${selectedItem.id}&resolution=${resolution}&filter=all`
    )
      .then((r) => r.json())
      .then((data: QuoteData) => {
        setQuoteData(data);
        setQuoteLoading(false);
      })
      .catch(() => {
        setQuoteData(null);
        setQuoteLoading(false);
      });
  }, [selectedItem, resolution]);

  // ─── Find matching scroll family ───
  const scrollFamily = useMemo(() => {
    if (!selectedItem) return null;
    return SCROLL_FAMILIES.find((f) => f.namePattern.test(selectedItem.name)) ?? null;
  }, [selectedItem]);

  // ─── Fetch scroll comparison data ───
  useEffect(() => {
    if (!scrollFamily) {
      setScrollCompData(new Map());
      return;
    }
    setScrollCompLoading(true);
    const ids = scrollFamily.variants.map((v) => v.id).join(",");
    fetch(
      `${API_BASE}/api/matip/quote/batch?itemCodes=${ids}&resolution=day`
    )
      .then((r) => r.json())
      .then((batchData: Record<string, QuoteData>) => {
        const m = new Map<number, { avg: number; count: number }>();
        for (const v of scrollFamily.variants) {
          const d = batchData[String(v.id)];
          if (d && d.sellActive && d.sellActive.length > 0) {
            const latest = d.sellActive[d.sellActive.length - 1];
            m.set(v.id, { avg: latest.avg, count: latest.count });
          }
        }
        setScrollCompData(m);
        setScrollCompLoading(false);
      })
      .catch(() => {
        setScrollCompData(new Map());
        setScrollCompLoading(false);
      });
  }, [scrollFamily]);

  // ─── Chart data ───
  const chartData = useMemo(() => {
    if (!quoteData) return [];
    const sellMap = new Map(
      (quoteData.sellActive || []).map((e) => [e.time, e])
    );
    const buyMap = new Map(
      (quoteData.buyActive || []).map((e) => [e.time, e])
    );
    const allTimes = new Set([...sellMap.keys(), ...buyMap.keys()]);
    const sorted = [...allTimes].sort((a, b) => a - b);

    return sorted.map((t) => {
      const s = sellMap.get(t);
      const b = buyMap.get(t);
      return {
        time: t,
        sellAvg: s?.avg ?? null,
        sellMin: s?.min ?? null,
        sellMax: s?.max ?? null,
        sellCount: s?.count ?? 0,
        buyAvg: b?.avg ?? null,
        buyMin: b?.min ?? null,
        buyMax: b?.max ?? null,
        buyCount: b?.count ?? 0,
      };
    });
  }, [quoteData]);

  // ─── Summary stats ───
  const summary = useMemo(() => {
    if (!quoteData || chartData.length === 0) return null;
    const sellEntries = quoteData.sellActive || [];
    const buyEntries = quoteData.buyActive || [];
    const latestSell = sellEntries.length > 0 ? sellEntries[sellEntries.length - 1] : null;
    const prevSell = sellEntries.length > 1 ? sellEntries[sellEntries.length - 2] : null;
    const latestBuy = buyEntries.length > 0 ? buyEntries[buyEntries.length - 1] : null;
    const prevBuy = buyEntries.length > 1 ? buyEntries[buyEntries.length - 2] : null;

    return {
      sellAvg: latestSell?.avg ?? 0,
      sellMin: latestSell?.min ?? 0,
      sellMax: latestSell?.max ?? 0,
      sellCount: latestSell?.count ?? 0,
      sellChange: latestSell && prevSell ? latestSell.avg - prevSell.avg : null,
      buyAvg: latestBuy?.avg ?? 0,
      buyMin: latestBuy?.min ?? 0,
      buyMax: latestBuy?.max ?? 0,
      buyCount: latestBuy?.count ?? 0,
      buyChange: latestBuy && prevBuy ? latestBuy.avg - prevBuy.avg : null,
    };
  }, [quoteData, chartData]);

  // ─── Scroll comparison: best value ───
  const scrollCompRows = useMemo(() => {
    if (!scrollFamily) return [];
    return scrollFamily.variants.map((v) => {
      const data = scrollCompData.get(v.id);
      const price = data?.avg ?? 0;
      // Expected value = (success rate * stat boost) / price * 10000 (normalize)
      const expectedValue =
        price > 0 ? ((v.pct / 100) * v.statPerSuccess) / (price / 10000) : 0;
      return {
        ...v,
        price,
        count: data?.count ?? 0,
        expectedValue,
      };
    });
  }, [scrollFamily, scrollCompData]);

  const bestValueId = useMemo(() => {
    if (scrollCompRows.length === 0) return null;
    const best = scrollCompRows.reduce((a, b) =>
      a.expectedValue > b.expectedValue ? a : b
    );
    return best.expectedValue > 0 ? best.id : null;
  }, [scrollCompRows]);

  if (!authenticated) {
    return (
      <div className="max-w-sm mx-auto mt-24 p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">시세 조회</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">시세 조회는 현재 비공개입니다</p>
        <input
          type="password"
          autoComplete="off"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          placeholder="비밀번호"
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 mb-3"
        />
        {authError && <p className="text-sm text-red-500 mb-3">{authError}</p>}
        <button
          onClick={handleLogin}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 rounded-lg transition-colors"
        >
          로그인
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">시세 조회</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        메이플랜드 아이템 시세를 검색하고 가격 추이를 확인하세요
      </p>

      {/* ─── Search bar ─── */}
      <div ref={searchRef} className="relative mb-4">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => {
              if (searchText.trim()) setShowDropdown(true);
            }}
            placeholder={
              itemsLoading
                ? "아이템 목록 로딩 중..."
                : "아이템 이름을 검색하세요 (예: 활 공격력 주문서 60%)"
            }
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm"
          />
        </div>

        {/* Autocomplete dropdown */}
        {showDropdown && filteredItems.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-64 overflow-y-auto">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => selectItem(item)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors first:rounded-t-xl last:rounded-b-xl"
              >
                <span className="font-medium">{item.name}</span>
                <span className="text-gray-400 dark:text-gray-500 ml-2 text-xs">
                  #{item.id}
                </span>
              </button>
            ))}
          </div>
        )}
        {showDropdown && debouncedSearch.trim() && filteredItems.length === 0 && !itemsLoading && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-4 text-sm text-gray-400 dark:text-gray-500 text-center">
            검색 결과가 없습니다
          </div>
        )}
      </div>

      {/* ─── Popular items quick-select ─── */}
      <div className="mb-8">
        {POPULAR_ITEMS.map((cat) => (
          <div key={cat.label} className="mb-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
              {cat.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {cat.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => selectItem(item)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selectedItem?.id === item.id
                      ? "bg-orange-50 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-600"
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-orange-300 dark:hover:border-orange-700 hover:text-orange-600"
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ─── Divider ─── */}
      {selectedItem && (
        <hr className="border-gray-200 dark:border-gray-700 mb-6" />
      )}

      {/* ─── Price summary cards ─── */}
      {selectedItem && (
        <>
          <h2 className="text-lg font-bold mb-3 text-gray-800 dark:text-gray-200">
            {selectedItem.name}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <SummaryCard
              label="판매 평균가"
              value={summary ? formatPrice(summary.sellAvg) : "-"}
              sub={summary ? formatPriceFull(summary.sellAvg) : undefined}
              change={summary?.sellChange}
              color="text-orange-600"
              loading={quoteLoading}
            />
            <SummaryCard
              label="구매 평균가"
              value={summary ? formatPrice(summary.buyAvg) : "-"}
              sub={summary ? formatPriceFull(summary.buyAvg) : undefined}
              change={summary?.buyChange}
              color="text-blue-600"
              loading={quoteLoading}
            />
            <SummaryCard
              label="판매 최저가 / 최고가"
              value={
                summary
                  ? `${formatPrice(summary.sellMin)} ~ ${formatPrice(summary.sellMax)}`
                  : "-"
              }
              sub={summary ? `거래량: ${summary.sellCount.toLocaleString()}건` : undefined}
              color="text-gray-800 dark:text-gray-200"
              loading={quoteLoading}
            />
            <SummaryCard
              label="구매 최저가 / 최고가"
              value={
                summary
                  ? `${formatPrice(summary.buyMin)} ~ ${formatPrice(summary.buyMax)}`
                  : "-"
              }
              sub={summary ? `거래량: ${summary.buyCount.toLocaleString()}건` : undefined}
              color="text-gray-800 dark:text-gray-200"
              loading={quoteLoading}
            />
          </div>

          {/* ─── Chart section ─── */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6 mb-6">
            {/* Toggles */}
            <div className="flex flex-wrap items-center gap-4 mb-4">
              {/* Resolution toggle */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                {([
                  { key: "hour" as Resolution, label: "시간별" },
                  { key: "day" as Resolution, label: "일별" },
                  { key: "month" as Resolution, label: "월별" },
                ] as const).map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setResolution(r.key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      resolution === r.key
                        ? "bg-white dark:bg-gray-800 text-orange-600 shadow-sm"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Filter toggle */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                {([
                  { key: "all" as FilterMode, label: "전체" },
                  { key: "sell" as FilterMode, label: "판매" },
                  { key: "buy" as FilterMode, label: "구매" },
                ] as const).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilterMode(f.key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      filterMode === f.key
                        ? "bg-white dark:bg-gray-800 text-orange-600 shadow-sm"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart */}
            {quoteLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
                시세 데이터가 없습니다
              </div>
            ) : (
              <div className="h-72 md:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e5e7eb"
                      className="dark:opacity-20"
                    />
                    <XAxis
                      dataKey="time"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      tickLine={false}
                      axisLine={{ stroke: "#e5e7eb" }}
                    />
                    <YAxis
                      tickFormatter={formatPrice}
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      tickLine={false}
                      axisLine={false}
                      width={60}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                    />

                    {/* Sell range area */}
                    {(filterMode === "all" || filterMode === "sell") && (
                      <>
                        <Area
                          type="monotone"
                          dataKey="sellMax"
                          stroke="none"
                          fill="#fb923c"
                          fillOpacity={0.1}
                          name="판매 최고"
                          dot={false}
                          activeDot={false}
                          legendType="none"
                        />
                        <Area
                          type="monotone"
                          dataKey="sellMin"
                          stroke="none"
                          fill="#ffffff"
                          fillOpacity={1}
                          name="판매 최저"
                          dot={false}
                          activeDot={false}
                          legendType="none"
                          className="dark:fill-gray-800"
                        />
                        <Line
                          type="monotone"
                          dataKey="sellAvg"
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: "#f97316" }}
                          name="판매 평균"
                          connectNulls
                        />
                      </>
                    )}

                    {/* Buy range area */}
                    {(filterMode === "all" || filterMode === "buy") && (
                      <>
                        <Area
                          type="monotone"
                          dataKey="buyMax"
                          stroke="none"
                          fill="#3b82f6"
                          fillOpacity={0.1}
                          name="구매 최고"
                          dot={false}
                          activeDot={false}
                          legendType="none"
                        />
                        <Area
                          type="monotone"
                          dataKey="buyMin"
                          stroke="none"
                          fill="#ffffff"
                          fillOpacity={1}
                          name="구매 최저"
                          dot={false}
                          activeDot={false}
                          legendType="none"
                          className="dark:fill-gray-800"
                        />
                        <Line
                          type="monotone"
                          dataKey="buyAvg"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: "#3b82f6" }}
                          name="구매 평균"
                          connectNulls
                        />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ─── Scroll comparison table ─── */}
          {scrollFamily && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6 mb-6">
              <h3 className="text-base font-bold text-gray-800 dark:text-gray-200 mb-1">
                주문서 시세 비교
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                {scrollFamily.baseName} 계열 — 성공률 x 능력치 상승 / 가격 기준 가성비 비교
              </p>

              {scrollCompLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 pr-4 text-gray-500 dark:text-gray-400 font-medium">
                            주문서
                          </th>
                          <th className="text-right py-2 px-4 text-gray-500 dark:text-gray-400 font-medium">
                            성공률
                          </th>
                          <th className="text-right py-2 px-4 text-gray-500 dark:text-gray-400 font-medium">
                            능력치
                          </th>
                          <th className="text-right py-2 px-4 text-gray-500 dark:text-gray-400 font-medium">
                            판매 평균가
                          </th>
                          <th className="text-right py-2 px-4 text-gray-500 dark:text-gray-400 font-medium">
                            거래량
                          </th>
                          <th className="text-right py-2 pl-4 text-gray-500 dark:text-gray-400 font-medium">
                            가성비
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {scrollCompRows.map((row) => (
                          <tr
                            key={row.id}
                            onClick={() =>
                              selectItem({
                                name: `${scrollFamily.baseName} ${row.label}`,
                                id: row.id,
                              })
                            }
                            className={`border-b border-gray-100 dark:border-gray-700/50 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                              row.id === bestValueId
                                ? "bg-orange-50/50 dark:bg-orange-900/10"
                                : ""
                            }`}
                          >
                            <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-200">
                              {row.label}
                              {row.id === bestValueId && (
                                <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded bg-orange-100 dark:bg-orange-900/40 text-orange-600">
                                  BEST
                                </span>
                              )}
                            </td>
                            <td className="text-right py-2.5 px-4 text-gray-600 dark:text-gray-400">
                              {row.pct}%
                            </td>
                            <td className="text-right py-2.5 px-4 text-gray-600 dark:text-gray-400">
                              +{row.statPerSuccess}
                            </td>
                            <td className="text-right py-2.5 px-4 font-medium text-orange-600">
                              {row.price > 0
                                ? formatPrice(row.price)
                                : "-"}
                            </td>
                            <td className="text-right py-2.5 px-4 text-gray-500 dark:text-gray-400">
                              {row.count > 0
                                ? row.count.toLocaleString()
                                : "-"}
                            </td>
                            <td className="text-right py-2.5 pl-4 font-medium">
                              <span
                                className={
                                  row.id === bestValueId
                                    ? "text-orange-600"
                                    : "text-gray-600 dark:text-gray-400"
                                }
                              >
                                {row.expectedValue > 0
                                  ? row.expectedValue.toFixed(2)
                                  : "-"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden space-y-3">
                    {scrollCompRows.map((row) => (
                      <button
                        key={row.id}
                        onClick={() =>
                          selectItem({
                            name: `${scrollFamily.baseName} ${row.label}`,
                            id: row.id,
                          })
                        }
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          row.id === bestValueId
                            ? "border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-900/10"
                            : "border-gray-200 dark:border-gray-700 hover:border-orange-200 dark:hover:border-orange-800"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                            {row.label}
                            {row.id === bestValueId && (
                              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded bg-orange-100 dark:bg-orange-900/40 text-orange-600">
                                BEST
                              </span>
                            )}
                          </span>
                          <span className="text-orange-600 font-bold text-sm">
                            {row.price > 0 ? formatPrice(row.price) : "-"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                          <span>성공률 {row.pct}%</span>
                          <span>+{row.statPerSuccess}</span>
                          <span>거래 {row.count > 0 ? row.count.toLocaleString() : "-"}건</span>
                          <span className="ml-auto">
                            가성비{" "}
                            <span
                              className={
                                row.id === bestValueId
                                  ? "text-orange-600 font-medium"
                                  : ""
                              }
                            >
                              {row.expectedValue > 0
                                ? row.expectedValue.toFixed(2)
                                : "-"}
                            </span>
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-3">
                가성비 = (성공률 x 능력치 상승) / (가격 / 10,000). 수치가 높을수록 메소 대비 효율이 좋습니다.
              </p>
            </div>
          )}
        </>
      )}

      {/* ─── Empty state ─── */}
      {!selectedItem && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <svg
            className="w-12 h-12 mx-auto mb-3 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
            />
          </svg>
          <p className="text-sm">아이템을 검색하거나 인기 아이템을 선택하세요</p>
        </div>
      )}
    </div>
  );
}
