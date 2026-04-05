"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

/* ── types ── */

interface PricePoint {
  time: number;
  avg: number;
  min: number;
  max: number;
  count: number;
}

interface QuoteResponse {
  sellActive: PricePoint[];
  buyActive: PricePoint[];
}

type Resolution = "hour" | "day" | "month";

/* ── helpers ── */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

function formatMeso(value: number): string {
  if (value === 0) return "0";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_0000_0000) {
    const v = abs / 1_0000_0000;
    return sign + (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + "억";
  }
  if (abs >= 1_0000) {
    const v = abs / 1_0000;
    return sign + (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + "만";
  }
  return sign + abs.toLocaleString();
}

function formatDate(ts: number, resolution: Resolution): string {
  const d = new Date(ts * 1000);
  if (resolution === "hour") {
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}시`;
  }
  if (resolution === "month") {
    return `${d.getFullYear()}.${d.getMonth() + 1}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const RESOLUTIONS: { key: Resolution; label: string }[] = [
  { key: "hour", label: "시간별" },
  { key: "day", label: "일별" },
  { key: "month", label: "월별" },
];

/* ── component ── */

interface Props {
  itemId: number;
}

interface MergedRow {
  time: number;
  label: string;
  sellAvg: number | null;
  sellMin: number | null;
  sellMax: number | null;
  sellCount: number;
  buyAvg: number | null;
  buyMin: number | null;
  buyMax: number | null;
  buyCount: number;
  sellRange?: [number, number];
  buyRange?: [number, number];
}

export default function PriceChart({ itemId }: Props) {
  const [resolution, setResolution] = useState<Resolution>("day");
  const [data, setData] = useState<MergedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [noData, setNoData] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setNoData(false);
    try {
      const res = await fetch(
        `${API_BASE}/api/matip/quote?itemCode=${itemId}&resolution=${resolution}&filter=all`
      );
      if (!res.ok) {
        setNoData(true);
        return;
      }
      const json: QuoteResponse = await res.json();

      const sellArr = json.sellActive || [];
      const buyArr = json.buyActive || [];

      if (sellArr.length === 0 && buyArr.length === 0) {
        setNoData(true);
        return;
      }

      // merge by time
      const map = new Map<number, MergedRow>();
      for (const p of sellArr) {
        map.set(p.time, {
          time: p.time,
          label: formatDate(p.time, resolution),
          sellAvg: p.avg,
          sellMin: p.min,
          sellMax: p.max,
          sellCount: p.count,
          sellRange: [p.min, p.max],
          buyAvg: null,
          buyMin: null,
          buyMax: null,
          buyCount: 0,
        });
      }
      for (const p of buyArr) {
        const existing = map.get(p.time);
        if (existing) {
          existing.buyAvg = p.avg;
          existing.buyMin = p.min;
          existing.buyMax = p.max;
          existing.buyCount = p.count;
          existing.buyRange = [p.min, p.max];
        } else {
          map.set(p.time, {
            time: p.time,
            label: formatDate(p.time, resolution),
            sellAvg: null,
            sellMin: null,
            sellMax: null,
            sellCount: 0,
            buyAvg: p.avg,
            buyMin: p.min,
            buyMax: p.max,
            buyCount: p.count,
            buyRange: [p.min, p.max],
          });
        }
      }

      const merged = Array.from(map.values()).sort((a, b) => a.time - b.time);
      setData(merged);
    } catch {
      setNoData(true);
    } finally {
      setLoading(false);
    }
  }, [itemId, resolution]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // summary stats from the latest data point
  const latestSell = data.length > 0 ? data[data.length - 1] : null;
  const latestBuy = data.length > 0 ? data[data.length - 1] : null;

  // aggregate stats
  const allSellAvg = data.filter((d) => d.sellAvg !== null);
  const allBuyAvg = data.filter((d) => d.buyAvg !== null);

  const sellTotalCount = data.reduce((s, d) => s + d.sellCount, 0);
  const buyTotalCount = data.reduce((s, d) => s + d.buyCount, 0);

  const sellMinAll =
    allSellAvg.length > 0
      ? Math.min(...allSellAvg.map((d) => d.sellMin!))
      : null;
  const sellMaxAll =
    allSellAvg.length > 0
      ? Math.max(...allSellAvg.map((d) => d.sellMax!))
      : null;
  const buyMinAll =
    allBuyAvg.length > 0
      ? Math.min(...allBuyAvg.map((d) => d.buyMin!))
      : null;
  const buyMaxAll =
    allBuyAvg.length > 0
      ? Math.max(...allBuyAvg.map((d) => d.buyMax!))
      : null;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mt-6">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          시세 정보
        </h2>
        <div className="flex gap-1">
          {RESOLUTIONS.map((r) => (
            <button
              key={r.key}
              onClick={() => setResolution(r.key)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                resolution === r.key
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          시세 로딩 중...
        </div>
      )}

      {!loading && noData && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          시세 정보 없음
        </div>
      )}

      {!loading && !noData && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                현재 매도 평균가
              </span>
              <p className="font-medium text-orange-600 dark:text-orange-400">
                {latestSell?.sellAvg != null
                  ? formatMeso(latestSell.sellAvg)
                  : "-"}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                현재 매수 평균가
              </span>
              <p className="font-medium text-blue-600 dark:text-blue-400">
                {latestBuy?.buyAvg != null
                  ? formatMeso(latestBuy.buyAvg)
                  : "-"}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                최저가 / 최고가
              </span>
              <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                {sellMinAll != null || buyMinAll != null
                  ? `${formatMeso(Math.min(sellMinAll ?? Infinity, buyMinAll ?? Infinity))} ~ ${formatMeso(Math.max(sellMaxAll ?? 0, buyMaxAll ?? 0))}`
                  : "-"}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                총 거래량
              </span>
              <p className="font-medium text-gray-800 dark:text-gray-200">
                {(sellTotalCount + buyTotalCount).toLocaleString()}건
              </p>
            </div>
          </div>

          {/* Chart */}
          <div className="w-full h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={data}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-gray-200 dark:text-gray-700"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  className="text-gray-400 dark:text-gray-500"
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={formatMeso}
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  className="text-gray-400 dark:text-gray-500"
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--tooltip-bg, #fff)",
                    border: "1px solid var(--tooltip-border, #e5e7eb)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ fontWeight: 600 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => {
                    const labels: Record<string, string> = {
                      sellAvg: "매도 평균",
                      buyAvg: "매수 평균",
                      sellRange: "매도 범위",
                      buyRange: "매수 범위",
                    };
                    if (
                      name === "sellRange" ||
                      name === "buyRange"
                    ) {
                      if (Array.isArray(value)) {
                        return [
                          `${formatMeso(value[0])} ~ ${formatMeso(value[1])}`,
                          labels[name] || name,
                        ];
                      }
                      return [formatMeso(Number(value)), labels[name] || name];
                    }
                    return [
                      formatMeso(Number(value)) + " 메소",
                      labels[name] || name,
                    ];
                  }}
                />
                <Legend
                  formatter={(value: string) => {
                    const labels: Record<string, string> = {
                      sellAvg: "매도 평균",
                      buyAvg: "매수 평균",
                      sellRange: "매도 범위",
                      buyRange: "매수 범위",
                    };
                    return labels[value] || value;
                  }}
                />

                {/* Sell range area */}
                <Area
                  dataKey="sellRange"
                  fill="#fb923c"
                  fillOpacity={0.15}
                  stroke="none"
                  name="sellRange"
                  legendType="none"
                  isAnimationActive={false}
                />
                {/* Buy range area */}
                <Area
                  dataKey="buyRange"
                  fill="#60a5fa"
                  fillOpacity={0.15}
                  stroke="none"
                  name="buyRange"
                  legendType="none"
                  isAnimationActive={false}
                />
                {/* Sell average line */}
                <Line
                  type="monotone"
                  dataKey="sellAvg"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                  name="sellAvg"
                  connectNulls
                />
                {/* Buy average line */}
                <Line
                  type="monotone"
                  dataKey="buyAvg"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="buyAvg"
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Sell vs Buy detail table */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {allSellAvg.length > 0 && (
              <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50 rounded-lg p-3">
                <span className="text-xs font-semibold text-orange-700 dark:text-orange-400">
                  매도 (판매)
                </span>
                <div className="mt-1 space-y-0.5 text-sm text-orange-900 dark:text-orange-200">
                  <p>
                    거래량:{" "}
                    <span className="font-medium">
                      {sellTotalCount.toLocaleString()}건
                    </span>
                  </p>
                  {sellMinAll != null && (
                    <p>
                      최저: <span className="font-medium">{formatMeso(sellMinAll)}</span> / 최고:{" "}
                      <span className="font-medium">{formatMeso(sellMaxAll!)}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
            {allBuyAvg.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg p-3">
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                  매수 (구매)
                </span>
                <div className="mt-1 space-y-0.5 text-sm text-blue-900 dark:text-blue-200">
                  <p>
                    거래량:{" "}
                    <span className="font-medium">
                      {buyTotalCount.toLocaleString()}건
                    </span>
                  </p>
                  {buyMinAll != null && (
                    <p>
                      최저: <span className="font-medium">{formatMeso(buyMinAll)}</span> / 최고:{" "}
                      <span className="font-medium">{formatMeso(buyMaxAll!)}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
