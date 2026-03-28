"use client";

import { useState, useCallback } from "react";

function getBallColor(n: number): string {
  if (n <= 10) return "#f59e0b";
  if (n <= 20) return "#3b82f6";
  if (n <= 30) return "#ef4444";
  if (n <= 40) return "#6b7280";
  return "#22c55e";
}

function LottoBall({ number, large = false }: { number: number; large?: boolean }) {
  const size = large ? 56 : 36;
  const fontSize = large ? 16 : 12;
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: getBallColor(number),
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontWeight: "bold",
        fontSize,
        boxShadow: "inset 0 -4px 8px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.2)",
        flexShrink: 0,
      }}
    >
      {number}
    </div>
  );
}

function generateLotto(): { numbers: number[]; bonus: number } {
  const pool = Array.from({ length: 45 }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const numbers = pool.slice(0, 6).sort((a, b) => a - b);
  return { numbers, bonus: pool[6] };
}

interface LottoResult {
  id: number;
  numbers: number[];
  bonus: number;
}

let _id = 1;

const LEGEND = [
  { range: "1 ~ 10", color: "#f59e0b" },
  { range: "11 ~ 20", color: "#3b82f6" },
  { range: "21 ~ 30", color: "#ef4444" },
  { range: "31 ~ 40", color: "#6b7280" },
  { range: "41 ~ 45", color: "#22c55e" },
];

export default function LottoPage() {
  const [count, setCount] = useState(1);
  const [results, setResults] = useState<LottoResult[]>([]);

  const generate = useCallback(() => {
    setResults(Array.from({ length: count }, () => ({ id: _id++, ...generateLotto() })));
  }, [count]);

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-1 text-gray-900">로또 번호 생성기</h1>
      <p className="text-sm text-gray-500 mb-6">1~45 중 무작위로 6개 + 보너스 번호를 추첨합니다.</p>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-6">
        <div className="flex items-center gap-4 mb-5">
          <span className="text-sm font-medium text-gray-700">생성 개수</span>
          <div className="flex gap-2">
            {[1, 3, 5].map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`w-10 h-10 rounded-lg text-sm font-bold border-2 transition-colors ${
                  count === n
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-white text-gray-600 border-gray-300 hover:border-orange-300"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={generate}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl text-base transition-colors shadow-md"
        >
          🎱 번호 생성
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3 mb-6">
          {results.map((r, i) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              {count > 1 && (
                <p className="text-xs font-semibold text-gray-400 mb-3">{i + 1}번 게임</p>
              )}
              <div className="flex items-center gap-2.5 flex-wrap">
                {r.numbers.map((n) => (
                  <LottoBall key={n} number={n} large />
                ))}
                <span className="text-gray-300 font-bold text-2xl mx-0.5">+</span>
                <div className="flex flex-col items-center gap-1">
                  <LottoBall number={r.bonus} large />
                  <span className="text-[10px] text-gray-400">보너스</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 mb-2">번호별 색상</p>
        <div className="flex flex-wrap gap-3">
          {LEGEND.map(({ range, color }) => (
            <div key={range} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
              {range}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
