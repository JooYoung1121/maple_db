"use client";

import { useState, useMemo, useCallback } from "react";

// ─── 수수료 구간 ───
const NORMAL_FEE_BRACKETS = [
  { min: 100_000_000, rate: 0.06, label: "1억 이상" },
  { min: 25_000_000, rate: 0.05, label: "2500만 이상" },
  { min: 10_000_000, rate: 0.04, label: "1000만 이상" },
  { min: 5_000_000, rate: 0.03, label: "500만 이상" },
  { min: 1_000_000, rate: 0.018, label: "100만 이상" },
  { min: 100_000, rate: 0.008, label: "10만 이상" },
  { min: 0, rate: 0, label: "10만 미만" },
];

const DELIVERY_FEE_BRACKETS = [
  { min: 100_000_000, rate: 0.07, label: "1억 이상" },
  { min: 25_000_000, rate: 0.06, label: "2500만 이상" },
  { min: 10_000_000, rate: 0.05, label: "1000만 이상" },
  { min: 5_000_000, rate: 0.04, label: "500만 이상" },
  { min: 1_000_000, rate: 0.027, label: "100만 이상" },
  { min: 100_000, rate: 0.012, label: "10만 이상" },
  { min: 0, rate: 0, label: "10만 미만" },
];

type TradeType = "direct" | "normal" | "delivery";

const TRADE_LABELS: Record<TradeType, string> = {
  direct: "직접 거래",
  normal: "일반 거래",
  delivery: "택배",
};

function getFeeRate(amount: number, type: TradeType): { rate: number; label: string } {
  if (type === "direct") return { rate: 0, label: "수수료 없음" };
  const brackets = type === "normal" ? NORMAL_FEE_BRACKETS : DELIVERY_FEE_BRACKETS;
  for (const b of brackets) {
    if (amount >= b.min) return { rate: b.rate, label: b.label };
  }
  return { rate: 0, label: "10만 미만" };
}

function calcFee(amount: number, type: TradeType): number {
  const { rate } = getFeeRate(amount, type);
  return Math.floor(amount * rate);
}

// ─── 최적 분할 계산 ───
// 구간 경계값 (이 값 미만으로 쪼개면 한 단계 낮은 수수료)
const SPLIT_BOUNDARIES = [
  { threshold: 100_000_000, maxChunk: 99_999_999 },
  { threshold: 25_000_000, maxChunk: 24_999_999 },
  { threshold: 10_000_000, maxChunk: 9_999_999 },
  { threshold: 5_000_000, maxChunk: 4_999_999 },
  { threshold: 1_000_000, maxChunk: 999_999 },
  { threshold: 100_000, maxChunk: 99_999 },
];

interface SplitResult {
  chunks: number[];
  totalFee: number;
  feeRate: number;
}

// 사용자가 선택 가능한 분할 단위
const SPLIT_OPTIONS = [
  { maxChunk: 99_999_999, label: "9999만 (1억 미만)" },
  { maxChunk: 24_999_999, label: "2499만 (2500만 미만)" },
  { maxChunk: 9_999_999, label: "999만 (1000만 미만)" },
  { maxChunk: 4_999_999, label: "499만 (500만 미만)" },
  { maxChunk: 999_999, label: "99만 (100만 미만)" },
  { maxChunk: 99_999, label: "9만 (10만 미만)" },
];

function calcSplitWithChunk(amount: number, type: TradeType, maxChunk: number): SplitResult {
  if (type === "direct") {
    return { chunks: [amount], totalFee: 0, feeRate: 0 };
  }
  if (maxChunk >= amount) {
    const fee = calcFee(amount, type);
    return { chunks: [amount], totalFee: fee, feeRate: fee / amount };
  }

  const fullChunks = Math.floor(amount / maxChunk);
  const remainder = amount - fullChunks * maxChunk;

  const chunks: number[] = [];
  let totalFee = 0;

  for (let i = 0; i < fullChunks; i++) {
    chunks.push(maxChunk);
    totalFee += calcFee(maxChunk, type);
  }
  if (remainder > 0) {
    chunks.push(remainder);
    totalFee += calcFee(remainder, type);
  }

  return { chunks, totalFee, feeRate: totalFee / amount };
}

function calcOptimalSplit(amount: number, type: TradeType): SplitResult {
  if (type === "direct") {
    return { chunks: [amount], totalFee: 0, feeRate: 0 };
  }

  const noSplitFee = calcFee(amount, type);
  let best: SplitResult = {
    chunks: [amount],
    totalFee: noSplitFee,
    feeRate: noSplitFee / amount,
  };

  for (const { maxChunk } of SPLIT_BOUNDARIES) {
    if (maxChunk >= amount) continue;
    const result = calcSplitWithChunk(amount, type, maxChunk);
    if (result.totalFee < best.totalFee) {
      best = result;
    }
  }

  return best;
}

// ─── 수수료작 방식 ───
type FeeMode = "no-split" | "split";

// 공대 분배 아이템
interface RaidItem {
  id: string;
  name: string;
  price: number;
  tradeType: TradeType;
  feeMode: FeeMode; // 노수작 or 수수료작
  splitChunk: number; // 수수료작 시 분할 단위
}

function calcItemFee(item: RaidItem): number {
  if (item.tradeType === "direct") return 0;
  if (item.feeMode === "no-split") return calcFee(item.price, item.tradeType);
  // 수수료작: 분할 후 총 수수료
  const result = calcSplitWithChunk(item.price, item.tradeType, item.splitChunk);
  return result.totalFee;
}

type Tab = "calc" | "split" | "raid";

// ─── 숫자 포맷 ───
function formatMeso(n: number): string {
  return Math.floor(n).toLocaleString("ko-KR");
}

function parseMeso(s: string): number {
  return Number(s.replace(/[^0-9]/g, "")) || 0;
}

export default function FeePage() {
  const [activeTab, setActiveTab] = useState<Tab>("calc");

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">수수료 계산기</h1>
      <p className="text-sm text-gray-500 mb-6">
        거래 수수료 계산, 최적 분할, 공대 분배금 계산
      </p>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { key: "calc" as Tab, label: "수수료 계산" },
          { key: "split" as Tab, label: "최적 분할" },
          { key: "raid" as Tab, label: "공대 분배" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.key
                ? "bg-white text-orange-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "calc" && <CalcTab />}
      {activeTab === "split" && <SplitTab />}
      {activeTab === "raid" && <RaidTab />}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  수수료 계산 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function CalcTab() {
  const [amount, setAmount] = useState("");
  const [tradeType, setTradeType] = useState<TradeType>("normal");

  const price = parseMeso(amount);
  const { rate, label: bracketLabel } = getFeeRate(price, tradeType);
  const fee = calcFee(price, tradeType);
  const net = price - fee;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">거래 금액 (메소)</label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="금액 입력"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
            {price > 0 && (
              <p className="text-xs text-gray-400 mt-1">{formatMeso(price)} 메소</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">거래 방식</label>
            <div className="flex gap-2">
              {(["direct", "normal", "delivery"] as TradeType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTradeType(t)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tradeType === t
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {TRADE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {price > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ResultCard label="거래 금액" value={`${formatMeso(price)}`} />
          <ResultCard label="수수료 구간" value={bracketLabel} />
          <ResultCard
            label={`수수료 (${(rate * 100).toFixed(1)}%)`}
            value={`-${formatMeso(fee)}`}
            negative
          />
          <ResultCard label="실수령액" value={formatMeso(net)} highlight />
        </div>
      )}

      {/* 수수료 참고표 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FeeTable title="일반 거래 수수료" brackets={NORMAL_FEE_BRACKETS} />
        <FeeTable title="택배 수수료" brackets={DELIVERY_FEE_BRACKETS} />
      </div>
    </div>
  );
}

function FeeTable({
  title,
  brackets,
}: {
  title: string;
  brackets: { min: number; rate: number; label: string }[];
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="font-bold text-sm">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-gray-500">
            <th className="text-left px-4 py-2 font-medium">금액 구간</th>
            <th className="text-right px-4 py-2 font-medium">수수료</th>
          </tr>
        </thead>
        <tbody>
          {brackets
            .filter((b) => b.rate > 0)
            .reverse()
            .map((b) => (
              <tr key={b.label} className="border-t border-gray-50">
                <td className="px-4 py-2">{b.label}</td>
                <td className="px-4 py-2 text-right font-mono">{(b.rate * 100).toFixed(1)}%</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  최적 분할 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function SplitTab() {
  const [amount, setAmount] = useState("");
  const [tradeType, setTradeType] = useState<TradeType>("normal");
  const [splitMode, setSplitMode] = useState<"auto" | "manual">("auto");
  const [manualChunk, setManualChunk] = useState(4_999_999);

  const price = parseMeso(amount);

  const noSplit = useMemo(() => {
    if (price <= 0) return null;
    const fee = calcFee(price, tradeType);
    return { fee, net: price - fee };
  }, [price, tradeType]);

  const optimal = useMemo(() => {
    if (price <= 0) return null;
    if (splitMode === "manual") {
      return calcSplitWithChunk(price, tradeType, manualChunk);
    }
    return calcOptimalSplit(price, tradeType);
  }, [price, tradeType, splitMode, manualChunk]);

  const savings = noSplit && optimal ? noSplit.fee - optimal.totalFee : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">총 거래 금액 (메소)</label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="금액 입력"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
            {price > 0 && (
              <p className="text-xs text-gray-400 mt-1">{formatMeso(price)} 메소</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">거래 방식</label>
            <div className="flex gap-2">
              {(["normal", "delivery"] as TradeType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTradeType(t)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tradeType === t
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {TRADE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 분할 단위 선택 */}
        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-500 mb-2">분할 방식</label>
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setSplitMode("auto")}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                splitMode === "auto"
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              자동 최적화
            </button>
            <button
              onClick={() => setSplitMode("manual")}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                splitMode === "manual"
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              직접 선택
            </button>
          </div>
          {splitMode === "manual" && (
            <div className="flex gap-1 flex-wrap">
              {SPLIT_OPTIONS.map((opt) => (
                <button
                  key={opt.maxChunk}
                  onClick={() => setManualChunk(opt.maxChunk)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    manualChunk === opt.maxChunk
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {price > 0 && noSplit && optimal && (
        <>
          {/* 비교 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm text-gray-500 mb-2">분할 안 할 때</h3>
              <p className="text-xl font-bold text-red-500">-{formatMeso(noSplit.fee)} 메소</p>
              <p className="text-sm text-gray-500 mt-1">
                실수령: {formatMeso(noSplit.net)} 메소
              </p>
              <p className="text-xs text-gray-400 mt-1">
                수수료율: {((noSplit.fee / price) * 100).toFixed(2)}%
              </p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
              <h3 className="text-sm text-orange-600 mb-2">최적 분할</h3>
              <p className="text-xl font-bold text-orange-600">
                -{formatMeso(optimal.totalFee)} 메소
              </p>
              <p className="text-sm text-gray-600 mt-1">
                실수령: {formatMeso(price - optimal.totalFee)} 메소
              </p>
              <p className="text-xs text-gray-500 mt-1">
                수수료율: {(optimal.feeRate * 100).toFixed(2)}% · {optimal.chunks.length}건 분할
              </p>
            </div>
          </div>

          {savings > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-sm text-green-700">
                분할 시 <span className="font-bold text-lg">{formatMeso(savings)} 메소</span> 절약!
              </p>
            </div>
          )}

          {/* 분할 상세 */}
          {optimal.chunks.length > 1 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-bold">분할 상세</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="text-left px-5 py-2.5 font-medium">#</th>
                    <th className="text-right px-5 py-2.5 font-medium">금액</th>
                    <th className="text-right px-5 py-2.5 font-medium">수수료</th>
                    <th className="text-right px-5 py-2.5 font-medium">실수령</th>
                  </tr>
                </thead>
                <tbody>
                  {optimal.chunks.map((chunk, i) => {
                    const fee = calcFee(chunk, tradeType);
                    return (
                      <tr key={i} className="border-t border-gray-50">
                        <td className="px-5 py-2">{i + 1}건</td>
                        <td className="px-5 py-2 text-right font-mono">{formatMeso(chunk)}</td>
                        <td className="px-5 py-2 text-right font-mono text-red-500">
                          -{formatMeso(fee)}
                        </td>
                        <td className="px-5 py-2 text-right font-mono">
                          {formatMeso(chunk - fee)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-gray-200 font-bold">
                    <td className="px-5 py-2.5">합계</td>
                    <td className="px-5 py-2.5 text-right font-mono">{formatMeso(price)}</td>
                    <td className="px-5 py-2.5 text-right font-mono text-red-500">
                      -{formatMeso(optimal.totalFee)}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-orange-600">
                      {formatMeso(price - optimal.totalFee)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  공대 분배 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface ExtraCost {
  id: string;
  label: string;
  amount: string;
}

function RaidTab() {
  const [items, setItems] = useState<RaidItem[]>([]);
  const [members, setMembers] = useState(6);
  const [extraCosts, setExtraCosts] = useState<ExtraCost[]>([
    { id: "default", label: "숍지원비", amount: "" },
  ]);

  // 새 아이템 입력
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newType, setNewType] = useState<TradeType>("delivery");
  const [newFeeMode, setNewFeeMode] = useState<FeeMode>("split");
  const [newSplitChunk, setNewSplitChunk] = useState(4_999_999);

  const addItem = useCallback(() => {
    const price = parseMeso(newPrice);
    if (!newName.trim() || price <= 0) return;
    setItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: newName.trim(),
        price,
        tradeType: newType,
        feeMode: newType === "direct" ? "no-split" : newFeeMode,
        splitChunk: newSplitChunk,
      },
    ]);
    setNewName("");
    setNewPrice("");
  }, [newName, newPrice, newType, newFeeMode, newSplitChunk]);

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, updates: Partial<RaidItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const addExtraCost = () => {
    setExtraCosts((prev) => [...prev, { id: Date.now().toString(), label: "", amount: "" }]);
  };

  const removeExtraCost = (id: string) => {
    setExtraCosts((prev) => prev.filter((c) => c.id !== id));
  };

  const updateExtraCost = (id: string, field: "label" | "amount", value: string) => {
    setExtraCosts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: field === "amount" ? value.replace(/[^0-9]/g, "") : value } : c))
    );
  };

  const totalExtra = extraCosts.reduce((sum, c) => sum + parseMeso(c.amount), 0);

  const totals = useMemo(() => {
    let totalGross = 0;
    let totalFee = 0;
    const rows = items.map((item) => {
      const fee = calcItemFee(item);
      const net = item.price - fee;
      totalGross += item.price;
      totalFee += fee;
      return { ...item, fee, net };
    });
    const totalNet = totalGross - totalFee;
    const afterExtra = totalNet - totalExtra;
    const perPerson = members > 0 ? Math.floor(afterExtra / members) : 0;
    return { rows, totalGross, totalFee, totalNet, afterExtra, perPerson };
  }, [items, totalExtra, members]);

  return (
    <div className="space-y-6">
      {/* 설정 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-lg mb-4">공대 설정</h2>
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1">트라이 인원</label>
          <input
            type="number"
            min={1}
            max={30}
            value={members}
            onChange={(e) => setMembers(Math.max(1, Number(e.target.value)))}
            className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
          />
        </div>

        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-500">공제 항목</label>
          <button
            onClick={addExtraCost}
            className="text-xs px-2 py-1 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
          >
            + 항목 추가
          </button>
        </div>
        <div className="space-y-2">
          {extraCosts.map((cost) => (
            <div key={cost.id} className="flex gap-2 items-center">
              <input
                type="text"
                value={cost.label}
                onChange={(e) => updateExtraCost(cost.id, "label", e.target.value)}
                placeholder="항목명 (예: 숍지원비)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
              <input
                type="text"
                value={cost.amount}
                onChange={(e) => updateExtraCost(cost.id, "amount", e.target.value)}
                placeholder="금액"
                className="w-36 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
              <button
                onClick={() => removeExtraCost(cost.id)}
                className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {extraCosts.length === 0 && (
            <p className="text-xs text-gray-400 py-2">공제 항목이 없습니다. 위 버튼으로 추가하세요.</p>
          )}
        </div>
      </div>

      {/* 아이템 추가 폼 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-lg mb-4">물품 등록</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">품목명</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="예: 시야 타오"
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">가격 (메소)</label>
            <input
              type="text"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="금액 입력"
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">거래 방식</label>
            <select
              value={newType}
              onChange={(e) => {
                const v = e.target.value as TradeType;
                setNewType(v);
                if (v === "direct") setNewFeeMode("no-split");
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            >
              <option value="direct">판매 (수수료 없음)</option>
              <option value="normal">일반 거래</option>
              <option value="delivery">택배</option>
            </select>
          </div>
          {newType !== "direct" && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">수수료작</label>
              <select
                value={newFeeMode === "no-split" ? "no-split" : String(newSplitChunk)}
                onChange={(e) => {
                  if (e.target.value === "no-split") {
                    setNewFeeMode("no-split");
                  } else {
                    setNewFeeMode("split");
                    setNewSplitChunk(Number(e.target.value));
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              >
                <option value="no-split">노수작 (그대로)</option>
                <option value="4999999">499만 수작</option>
                <option value="9999999">999만 수작</option>
                <option value="24999999">2499만 수작</option>
                <option value="99999999">9999만 수작</option>
              </select>
            </div>
          )}
          <button
            onClick={addItem}
            disabled={!newName.trim() || parseMeso(newPrice) <= 0}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            추가
          </button>
        </div>
      </div>

      {/* 물품 테이블 */}
      {items.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500">
                  <th className="text-left px-3 py-2.5 font-medium">품목</th>
                  <th className="text-right px-3 py-2.5 font-medium">가격</th>
                  <th className="text-center px-3 py-2.5 font-medium">거래</th>
                  <th className="text-center px-3 py-2.5 font-medium">수수료작</th>
                  <th className="text-right px-3 py-2.5 font-medium">수수료</th>
                  <th className="text-right px-3 py-2.5 font-medium">최종금액</th>
                  <th className="px-2 py-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {totals.rows.map((row) => {
                  const origItem = items.find((i) => i.id === row.id)!;
                  return (
                  <tr key={row.id} className="border-t border-gray-50">
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        value={origItem.name}
                        onChange={(e) => updateItem(row.id, { name: e.target.value })}
                        className="w-full px-1.5 py-1 border border-transparent hover:border-gray-300 focus:border-orange-400 rounded text-sm focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        value={formatMeso(origItem.price)}
                        onChange={(e) => updateItem(row.id, { price: parseMeso(e.target.value) })}
                        className="w-24 px-1.5 py-1 border border-transparent hover:border-gray-300 focus:border-orange-400 rounded text-sm text-right font-mono focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <select
                        value={origItem.tradeType}
                        onChange={(e) => {
                          const tt = e.target.value as TradeType;
                          updateItem(row.id, {
                            tradeType: tt,
                            feeMode: tt === "direct" ? "no-split" : origItem.feeMode,
                          });
                        }}
                        className="px-1.5 py-1 border border-transparent hover:border-gray-300 focus:border-orange-400 rounded text-xs focus:outline-none"
                      >
                        <option value="direct">판매</option>
                        <option value="normal">일반</option>
                        <option value="delivery">택배</option>
                      </select>
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {origItem.tradeType !== "direct" ? (
                        <select
                          value={origItem.feeMode === "no-split" ? "no-split" : String(origItem.splitChunk)}
                          onChange={(e) => {
                            if (e.target.value === "no-split") {
                              updateItem(row.id, { feeMode: "no-split" });
                            } else {
                              updateItem(row.id, { feeMode: "split", splitChunk: Number(e.target.value) });
                            }
                          }}
                          className="px-1.5 py-1 border border-transparent hover:border-gray-300 focus:border-orange-400 rounded text-xs focus:outline-none"
                        >
                          <option value="no-split">노수작</option>
                          <option value="4999999">499만</option>
                          <option value="9999999">999만</option>
                          <option value="24999999">2499만</option>
                          <option value="99999999">9999만</option>
                        </select>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-red-500">
                      {row.fee > 0 ? `-${formatMeso(row.fee)}` : "-"}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">{formatMeso(row.net)}</td>
                    <td className="px-2 py-1.5">
                      <button
                        onClick={() => removeItem(row.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 합계 */}
          <div className="border-t-2 border-gray-200 bg-gray-50 px-4 py-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">총 판매금</span>
              <span className="font-mono font-bold">{formatMeso(totals.totalNet)}</span>
            </div>
            {extraCosts.map((cost) => {
              const amt = parseMeso(cost.amount);
              if (amt <= 0) return null;
              return (
                <div key={cost.id} className="flex justify-between text-sm">
                  <span className="text-gray-500">{cost.label || "공제"}</span>
                  <span className="font-mono text-red-500">-{formatMeso(amt)}</span>
                </div>
              );
            })}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">합산</span>
              <span className="font-mono font-bold">{formatMeso(totals.afterExtra)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">트라이 인원</span>
              <span className="font-mono">{members}명</span>
            </div>
            <div className="flex justify-between text-base border-t border-gray-200 pt-2 mt-2">
              <span className="font-bold text-orange-600">1인당 분배금</span>
              <span className="font-mono font-bold text-orange-600 text-lg">
                {formatMeso(totals.perPerson)} 메소
              </span>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="text-center py-12 text-gray-400 bg-white border border-gray-200 rounded-xl">
          물품을 등록하면 수수료와 분배금이 자동 계산됩니다
        </div>
      )}
    </div>
  );
}

// ─── 공용 컴포넌트 ───
function ResultCard({
  label,
  value,
  highlight,
  negative,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-4 ${
        highlight
          ? "bg-orange-50 border border-orange-200"
          : "bg-white border border-gray-200"
      }`}
    >
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p
        className={`text-lg font-bold font-mono ${
          highlight ? "text-orange-600" : negative ? "text-red-500" : "text-gray-800"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
