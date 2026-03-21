"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";

// ─── 주문서 데이터 ───
const SCROLL_TYPES = [
  { pct: 100, label: "100%", desc: "안전하지만 낮은 능력치", color: "green" },
  { pct: 70, label: "70%", desc: "준수한 확률과 능력치", color: "blue" },
  { pct: 60, label: "60%", desc: "가장 가성비가 좋음", color: "orange" },
  { pct: 30, label: "30%", desc: "높은 능력치, 낮은 확률", color: "purple" },
  { pct: 10, label: "10%", desc: "최고 능력치, 최저 확률", color: "red" },
] as const;

// 무기 종류별 업그레이드 횟수
const WEAPON_SLOTS: Record<string, number> = {
  "한손검": 7,
  "두손검": 7,
  "한손둔기": 7,
  "두손둔기": 7,
  "한손도끼": 7,
  "두손도끼": 7,
  "창": 7,
  "폴암": 7,
  "단검": 7,
  "아대": 7,
  "활": 7,
  "석궁": 7,
  "클로": 7,
  "총": 7,
  "완드": 7,
  "스태프": 7,
  "방패": 10,
  "모자": 7,
  "상의": 10,
  "하의": 7,
  "전신": 10,
  "장갑": 5,
  "신발": 5,
  "망토": 5,
  "귀걸이": 5,
  "얼굴장식": 3,
  "눈장식": 3,
};

// 주문서 스탯 데이터 (공격력/마력 기준)
const SCROLL_STATS: {
  category: string;
  items: { name: string; stats: Record<number, string> }[];
}[] = [
  {
    category: "무기 공격력",
    items: [
      { name: "공격력 주문서", stats: { 100: "+1", 70: "+2", 60: "+2", 30: "+3", 10: "+5" } },
    ],
  },
  {
    category: "무기 마력",
    items: [
      { name: "마력 주문서", stats: { 100: "+1", 70: "+2", 60: "+2", 30: "+3", 10: "+5" } },
    ],
  },
  {
    category: "방어구 (상의/하의/전신)",
    items: [
      { name: "STR 주문서", stats: { 100: "+1", 70: "+2", 60: "+2", 30: "+3", 10: "+5" } },
      { name: "DEX 주문서", stats: { 100: "+1", 70: "+2", 60: "+2", 30: "+3", 10: "+5" } },
      { name: "INT 주문서", stats: { 100: "+1", 70: "+2", 60: "+2", 30: "+3", 10: "+5" } },
      { name: "LUK 주문서", stats: { 100: "+1", 70: "+2", 60: "+2", 30: "+3", 10: "+5" } },
      { name: "HP 주문서", stats: { 100: "+5", 70: "+10", 60: "+15", 30: "+20", 10: "+30" } },
    ],
  },
  {
    category: "장갑",
    items: [
      { name: "공격력 주문서", stats: { 100: "+0", 70: "+1", 60: "+2", 30: "+2", 10: "+3" } },
      { name: "마력 주문서", stats: { 100: "+0", 70: "+1", 60: "+2", 30: "+2", 10: "+3" } },
      { name: "DEX 주문서", stats: { 100: "+1", 70: "+2", 60: "+2", 30: "+3", 10: "+5" } },
    ],
  },
  {
    category: "모자",
    items: [
      { name: "STR 주문서", stats: { 100: "+1", 70: "+2", 60: "+2", 30: "+3", 10: "+5" } },
      { name: "DEX 주문서", stats: { 100: "+1", 70: "+2", 60: "+2", 30: "+3", 10: "+5" } },
      { name: "INT 주문서", stats: { 100: "+1", 70: "+2", 60: "+2", 30: "+3", 10: "+5" } },
      { name: "LUK 주문서", stats: { 100: "+1", 70: "+2", 60: "+2", 30: "+3", 10: "+5" } },
      { name: "HP 주문서", stats: { 100: "+5", 70: "+10", 60: "+15", 30: "+20", 10: "+30" } },
    ],
  },
  {
    category: "신발",
    items: [
      { name: "이동속도 주문서", stats: { 100: "+1", 70: "+2", 60: "+2", 30: "+3", 10: "+5" } },
      { name: "점프력 주문서", stats: { 100: "+1", 70: "+2", 60: "+2", 30: "+3", 10: "+5" } },
    ],
  },
  {
    category: "망토",
    items: [
      { name: "마법방어 주문서", stats: { 100: "+2", 70: "+3", 60: "+4", 30: "+5", 10: "+7" } },
      { name: "물리방어 주문서", stats: { 100: "+2", 70: "+3", 60: "+4", 30: "+5", 10: "+7" } },
    ],
  },
];

// ─── 확률 계산 유틸 ───
function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  if (k > n - k) k = n - k;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}

function binomialProb(n: number, k: number, p: number): number {
  return comb(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

// k번 이상 성공할 확률
function binomialCDF(n: number, kMin: number, p: number): number {
  let sum = 0;
  for (let k = kMin; k <= n; k++) {
    sum += binomialProb(n, k, p);
  }
  return sum;
}

// ─── 탭 타입 ───
type Tab = "calc" | "sim" | "ref";

// ─── 시뮬 결과 ───
interface SimSlot {
  status: "pending" | "success" | "fail";
}

export default function ScrollPage() {
  const [activeTab, setActiveTab] = useState<Tab>("calc");

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">주문서 확률 계산기</h1>
      <p className="text-sm text-gray-500 mb-6">
        주문서 성공 확률 계산, 시뮬레이션, 스탯 참고표
      </p>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { key: "calc" as Tab, label: "확률 계산" },
          { key: "sim" as Tab, label: "시뮬레이션" },
          { key: "ref" as Tab, label: "주문서 스탯표" },
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
      {activeTab === "sim" && <SimTab />}
      {activeTab === "ref" && <RefTab />}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  확률 계산 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function CalcTab() {
  const [slots, setSlots] = useState(7);
  const [scrollPct, setScrollPct] = useState(60);
  const [weaponType, setWeaponType] = useState("");

  const p = scrollPct / 100;

  // 무기 선택 시 슬롯 자동 설정
  const handleWeaponChange = (wt: string) => {
    setWeaponType(wt);
    if (wt && WEAPON_SLOTS[wt]) {
      setSlots(WEAPON_SLOTS[wt]);
    }
  };

  const rows = useMemo(() => {
    const result = [];
    for (let k = 0; k <= slots; k++) {
      const exact = binomialProb(slots, k, p);
      const atLeast = binomialCDF(slots, k, p);
      result.push({ k, exact, atLeast });
    }
    return result;
  }, [slots, p]);

  // 기대값
  const expected = slots * p;

  return (
    <div className="space-y-6">
      {/* 설정 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-lg mb-4">설정</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">장비 종류</label>
            <select
              value={weaponType}
              onChange={(e) => handleWeaponChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            >
              <option value="">직접 입력</option>
              {Object.entries(WEAPON_SLOTS).map(([name, s]) => (
                <option key={name} value={name}>
                  {name} ({s}칸)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              업그레이드 횟수 (슬롯)
            </label>
            <input
              type="number"
              min={1}
              max={15}
              value={slots}
              onChange={(e) => {
                setSlots(Math.max(1, Math.min(15, Number(e.target.value))));
                setWeaponType("");
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">주문서 확률</label>
            <div className="flex gap-1 flex-wrap">
              {SCROLL_TYPES.map((s) => (
                <button
                  key={s.pct}
                  onClick={() => setScrollPct(s.pct)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    scrollPct === s.pct
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="업그레이드 횟수" value={`${slots}칸`} />
        <SummaryCard label="주문서 확률" value={`${scrollPct}%`} />
        <SummaryCard label="기대 성공 횟수" value={`${expected.toFixed(1)}회`} />
        <SummaryCard
          label="올작 확률"
          value={`${(binomialProb(slots, slots, p) * 100).toFixed(
            binomialProb(slots, slots, p) * 100 < 0.01 ? 4 : 2
          )}%`}
          highlight
        />
      </div>

      {/* 확률 테이블 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="font-bold">성공 횟수별 확률</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="text-left px-5 py-2.5 font-medium">성공 횟수</th>
                <th className="text-right px-5 py-2.5 font-medium">정확히 N작 확률</th>
                <th className="text-right px-5 py-2.5 font-medium">N작 이상 확률</th>
                <th className="px-5 py-2.5 font-medium text-left">확률 바</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.k}
                  className={`border-t border-gray-50 ${
                    r.k === slots ? "bg-orange-50" : ""
                  }`}
                >
                  <td className="px-5 py-2.5 font-medium">
                    {r.k}작{" "}
                    {r.k === slots && (
                      <span className="text-xs text-orange-500 ml-1">올작</span>
                    )}
                    {r.k === 0 && (
                      <span className="text-xs text-red-400 ml-1">꽝</span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono">
                    {formatPct(r.exact)}
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono">
                    {formatPct(r.atLeast)}
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="h-4 bg-gray-100 rounded-full overflow-hidden w-full max-w-[200px]">
                      <div
                        className={`h-full rounded-full transition-all ${
                          r.k === slots ? "bg-orange-400" : "bg-blue-400"
                        }`}
                        style={{ width: `${Math.max(r.exact * 100, 0.5)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
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
        className={`text-lg font-bold ${
          highlight ? "text-orange-600" : "text-gray-800"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function formatPct(v: number): string {
  const pct = v * 100;
  if (pct === 0) return "0%";
  if (pct === 100) return "100%";
  if (pct < 0.01) return `${pct.toFixed(4)}%`;
  if (pct < 1) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(2)}%`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  시뮬레이션 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function SimTab() {
  const [slots, setSlots] = useState(7);
  const [scrollPct, setScrollPct] = useState(60);
  const [simSlots, setSimSlots] = useState<SimSlot[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<number[]>([]);
  const [autoMode, setAutoMode] = useState(false);
  const autoRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 초기화
  const reset = useCallback(() => {
    autoRef.current = false;
    setAutoMode(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    setSimSlots(Array.from({ length: slots }, () => ({ status: "pending" as const })));
    setCurrentIdx(0);
    setRunning(true);
  }, [slots]);

  useEffect(() => {
    reset();
  }, [slots, scrollPct, reset]);

  // 한 칸 주문서 바르기
  const rollOne = useCallback(() => {
    setSimSlots((prev) => {
      if (currentIdx >= prev.length) return prev;
      const next = [...prev];
      const success = Math.random() * 100 < scrollPct;
      next[currentIdx] = { status: success ? "success" : "fail" };
      return next;
    });
    setCurrentIdx((prev) => {
      const nextIdx = prev + 1;
      if (nextIdx >= slots) {
        // 끝남 — 히스토리 기록
        setSimSlots((final) => {
          const successes = final.filter((s) => s.status === "success").length;
          setHistory((h) => [...h, successes]);
          return final;
        });
        setRunning(false);
        autoRef.current = false;
        setAutoMode(false);
      }
      return nextIdx;
    });
  }, [currentIdx, scrollPct, slots]);

  // 자동 모드
  const startAuto = useCallback(() => {
    autoRef.current = true;
    setAutoMode(true);
    const tick = () => {
      if (!autoRef.current) return;
      rollOne();
      timerRef.current = setTimeout(tick, 300);
    };
    tick();
  }, [rollOne]);

  const stopAuto = useCallback(() => {
    autoRef.current = false;
    setAutoMode(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // 키보드: Space=바르기, F=리셋, A=자동
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (running && !autoMode) rollOne();
        else if (!running) reset();
      }
      if (e.code === "KeyF") {
        e.preventDefault();
        reset();
      }
      if (e.code === "KeyA") {
        e.preventDefault();
        if (running && !autoMode) startAuto();
        else if (autoMode) stopAuto();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [running, autoMode, rollOne, reset, startAuto, stopAuto]);

  const successes = simSlots.filter((s) => s.status === "success").length;
  const fails = simSlots.filter((s) => s.status === "fail").length;
  const done = !running && currentIdx > 0;

  // 히스토리 통계
  const histAvg = history.length > 0 ? history.reduce((a, b) => a + b, 0) / history.length : 0;

  return (
    <div className="space-y-6">
      {/* 설정 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              업그레이드 횟수
            </label>
            <div className="flex gap-2">
              {[5, 7, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setSlots(n)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    slots === n
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {n}강
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">주문서 확률</label>
            <div className="flex gap-1 flex-wrap">
              {SCROLL_TYPES.map((s) => (
                <button
                  key={s.pct}
                  onClick={() => setScrollPct(s.pct)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    scrollPct === s.pct
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 슬롯 시각화 */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">
            {done
              ? successes === slots
                ? "축하합니다! 올작 성공!"
                : `${successes}작 완료`
              : `주문서 시뮬레이션 (${scrollPct}%)`}
          </h2>
          <div className="text-sm text-gray-500">
            <span className="text-green-600 font-bold">{successes}</span>
            <span className="text-gray-300 mx-1">/</span>
            <span className="text-red-500 font-bold">{fails}</span>
            <span className="text-gray-300 mx-1">/</span>
            <span>{slots - successes - fails}</span>
          </div>
        </div>

        {/* 슬롯 그리드 */}
        <div className="flex gap-2 flex-wrap justify-center mb-6">
          {simSlots.map((slot, i) => (
            <div
              key={i}
              className={`w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold border-2 transition-all duration-300 ${
                slot.status === "success"
                  ? "bg-green-100 border-green-400 text-green-600 scale-105"
                  : slot.status === "fail"
                  ? "bg-red-100 border-red-300 text-red-500"
                  : i === currentIdx && running
                  ? "bg-orange-50 border-orange-400 text-orange-500 animate-pulse"
                  : "bg-gray-50 border-gray-200 text-gray-300"
              }`}
            >
              {slot.status === "success"
                ? "O"
                : slot.status === "fail"
                ? "X"
                : i === currentIdx && running
                ? "?"
                : "·"}
            </div>
          ))}
        </div>

        {/* 결과 메시지 */}
        {done && (
          <div
            className={`text-center py-3 rounded-lg mb-4 text-sm font-medium ${
              successes === slots
                ? "bg-orange-100 text-orange-700"
                : successes >= Math.ceil(slots * 0.7)
                ? "bg-green-100 text-green-700"
                : successes >= Math.ceil(slots * 0.4)
                ? "bg-blue-100 text-blue-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {successes === slots
              ? `${slots}작 올작! 확률: ${formatPct(binomialProb(slots, slots, scrollPct / 100))}`
              : `${slots}칸 중 ${successes}작 성공 (${formatPct(
                  binomialProb(slots, successes, scrollPct / 100)
                )} 확률)`}
          </div>
        )}

        {/* 버튼 */}
        <div className="flex gap-3 justify-center">
          {running ? (
            <>
              <button
                onClick={rollOne}
                disabled={autoMode}
                className="px-6 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                바르기 (Space)
              </button>
              {!autoMode ? (
                <button
                  onClick={startAuto}
                  className="px-6 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                >
                  자동 (A)
                </button>
              ) : (
                <button
                  onClick={stopAuto}
                  className="px-6 py-2.5 bg-gray-500 text-white rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors"
                >
                  정지 (A)
                </button>
              )}
            </>
          ) : (
            <button
              onClick={reset}
              className="px-6 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              다시하기 (F)
            </button>
          )}
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            초기화 (F)
          </button>
        </div>

        {/* 키보드 안내 */}
        <p className="text-center text-xs text-gray-400 mt-3">
          Space: 바르기 / A: 자동 / F: 초기화
        </p>
      </div>

      {/* 시뮬 히스토리 */}
      {history.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">시뮬레이션 기록</h2>
            <button
              onClick={() => setHistory([])}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              기록 초기화
            </button>
          </div>
          <div className="flex gap-2 flex-wrap mb-3">
            {history.map((h, i) => (
              <span
                key={i}
                className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${
                  h === slots
                    ? "bg-orange-100 text-orange-600"
                    : h >= Math.ceil(slots * 0.7)
                    ? "bg-green-100 text-green-600"
                    : h >= Math.ceil(slots * 0.4)
                    ? "bg-blue-100 text-blue-600"
                    : "bg-red-100 text-red-600"
                }`}
              >
                {h}
              </span>
            ))}
          </div>
          <div className="text-sm text-gray-500">
            총 {history.length}회 · 평균{" "}
            <span className="font-bold text-gray-700">{histAvg.toFixed(1)}작</span> ·
            올작{" "}
            <span className="font-bold text-orange-600">
              {history.filter((h) => h === slots).length}회
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  주문서 스탯 참고표 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function RefTab() {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-lg mb-1">주문서 확률별 설명</h2>
        <p className="text-sm text-gray-500 mb-4">
          각 확률별 주문서의 특성을 비교해보세요
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SCROLL_TYPES.map((s) => (
            <div
              key={s.pct}
              className={`rounded-xl p-4 border ${
                s.color === "green"
                  ? "bg-green-50 border-green-200"
                  : s.color === "blue"
                  ? "bg-blue-50 border-blue-200"
                  : s.color === "orange"
                  ? "bg-orange-50 border-orange-200"
                  : s.color === "purple"
                  ? "bg-purple-50 border-purple-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <p className="text-2xl font-bold mb-1">{s.label}</p>
              <p className="text-sm text-gray-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 장비별 업그레이드 횟수 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="font-bold">장비별 업그레이드 횟수</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="text-left px-5 py-2.5 font-medium">장비</th>
                <th className="text-right px-5 py-2.5 font-medium">업그레이드 횟수</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(WEAPON_SLOTS).map(([name, s]) => (
                <tr key={name} className="border-t border-gray-50">
                  <td className="px-5 py-2">{name}</td>
                  <td className="px-5 py-2 text-right font-mono">{s}칸</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 주문서 스탯표 */}
      {SCROLL_STATS.map((cat) => (
        <div
          key={cat.category}
          className="bg-white border border-gray-200 rounded-xl overflow-hidden"
        >
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-bold">{cat.category}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500">
                  <th className="text-left px-5 py-2.5 font-medium">주문서</th>
                  {SCROLL_TYPES.map((s) => (
                    <th key={s.pct} className="text-center px-3 py-2.5 font-medium">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cat.items.map((item) => (
                  <tr key={item.name} className="border-t border-gray-50">
                    <td className="px-5 py-2 font-medium">{item.name}</td>
                    {SCROLL_TYPES.map((s) => (
                      <td key={s.pct} className="text-center px-3 py-2 font-mono">
                        {item.stats[s.pct] || "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
