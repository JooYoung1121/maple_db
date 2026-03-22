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
      { name: "STR 주문서", stats: { 100: "+1", 70: "+1", 60: "+2", 30: "+2", 10: "+3" } },
      { name: "DEX 주문서", stats: { 100: "+1", 70: "+1", 60: "+2", 30: "+2", 10: "+3" } },
      { name: "INT 주문서", stats: { 100: "+1", 70: "+1", 60: "+2", 30: "+2", 10: "+3" } },
      { name: "LUK 주문서", stats: { 100: "+1", 70: "+1", 60: "+2", 30: "+2", 10: "+3" } },
      { name: "HP 주문서", stats: { 100: "+5", 70: "+10", 60: "+15", 30: "+20", 10: "+30" } },
    ],
  },
  {
    category: "신발",
    items: [
      { name: "이동속도 주문서", stats: { 100: "+1", 70: "+1", 60: "+2", 30: "+2", 10: "+3" } },
      { name: "점프력 주문서", stats: { 100: "+1", 70: "+1", 60: "+2", 30: "+2", 10: "+3" } },
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
type Tab = "calc" | "sim" | "ref" | "ranking";

// ─── 시뮬 결과 ───
interface SimSlot {
  status: "pending" | "success" | "fail";
  pct: number; // which scroll % was used
}

interface HistoryEntry {
  slots: SimSlot[];
  equipmentType: string;
  scrollType: string;
  totalSlots: number;
  successCount: number;
  statGain: number;
  statLabel: string;
}

// ─── 랭킹 엔트리 ───
interface RankingEntry {
  id: number;
  nickname: string;
  equipment_type: string;
  scroll_type: string;
  slot_count: number;
  success_count: number;
  total_stat_gain: string | null;
  scroll_detail: string | null;
  created_at: string;
}

export default function ScrollPage() {
  const [activeTab, setActiveTab] = useState<Tab>("calc");

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">주문서 확률 계산기</h1>
      <p className="text-sm text-gray-500 mb-6">
        주문서 성공 확률 계산, 시뮬레이션, 스탯 참고표, 랭킹
      </p>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { key: "calc" as Tab, label: "확률 계산" },
          { key: "sim" as Tab, label: "시뮬레이션" },
          { key: "ref" as Tab, label: "주문서 스탯표" },
          { key: "ranking" as Tab, label: "랭킹" },
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
      {activeTab === "ranking" && <RankingTab />}
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
//  시뮬레이션 탭 (통합 — 슬롯별 주문서 % 자유 선택)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 장비 카테고리별 사용 가능한 주문서 목록 반환
function getScrollsForEquipment(equipmentType: string): string[] {
  if (!equipmentType) return [];
  // 무기
  const weapons = ["한손검","두손검","한손둔기","두손둔기","한손도끼","두손도끼","창","폴암","단검","아대","활","석궁","클로","총","완드","스태프"];
  if (weapons.includes(equipmentType)) {
    return SCROLL_STATS.filter(c => c.category.includes("무기")).flatMap(c => c.items.map(i => i.name));
  }
  if (equipmentType === "장갑") {
    return SCROLL_STATS.find(c => c.category === "장갑")?.items.map(i => i.name) ?? [];
  }
  if (equipmentType === "모자") {
    return SCROLL_STATS.find(c => c.category === "모자")?.items.map(i => i.name) ?? [];
  }
  if (equipmentType === "신발") {
    return SCROLL_STATS.find(c => c.category === "신발")?.items.map(i => i.name) ?? [];
  }
  if (equipmentType === "망토") {
    return SCROLL_STATS.find(c => c.category === "망토")?.items.map(i => i.name) ?? [];
  }
  // 방어구 (상의, 하의, 전신, 방패, 귀걸이 등)
  const armor = SCROLL_STATS.find(c => c.category.includes("방어구"));
  return armor?.items.map(i => i.name) ?? [];
}

// 주문서 이름 + % 로 스탯 증가량 숫자 반환
function getStatGain(scrollName: string, pct: number, equipmentType: string): number {
  for (const cat of SCROLL_STATS) {
    for (const item of cat.items) {
      if (item.name === scrollName) {
        const raw = item.stats[pct as keyof typeof item.stats];
        if (raw) return parseInt(raw.replace("+", ""), 10);
      }
    }
  }
  return 0;
}

function SimTab() {
  const [equipmentType, setEquipmentType] = useState("한손검");
  const [scrollType, setScrollType] = useState("공격력 주문서");
  const [currentSlotPct, setCurrentSlotPct] = useState(60);
  const [simSlots, setSimSlots] = useState<SimSlot[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // 등록 모달
  const [showRegister, setShowRegister] = useState(false);
  const [registerNickname, setRegisterNickname] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerDone, setRegisterDone] = useState(false);

  const slots = WEAPON_SLOTS[equipmentType] ?? 7;
  const availableScrolls = useMemo(() => getScrollsForEquipment(equipmentType), [equipmentType]);

  // 장비 변경 시 주문서 기본값 업데이트
  useEffect(() => {
    if (availableScrolls.length > 0 && !availableScrolls.includes(scrollType)) {
      setScrollType(availableScrolls[0]);
    }
  }, [availableScrolls, scrollType]);

  // 초기화
  const reset = useCallback(() => {
    setSimSlots(Array.from({ length: slots }, () => ({ status: "pending" as const, pct: currentSlotPct })));
    setCurrentIdx(0);
    setRunning(true);
    setShowRegister(false);
    setRegisterDone(false);
  }, [slots, currentSlotPct]);

  // 장비/슬롯 변경 시 자동 초기화
  useEffect(() => {
    setSimSlots(Array.from({ length: slots }, () => ({ status: "pending" as const, pct: currentSlotPct })));
    setCurrentIdx(0);
    setRunning(true);
    setShowRegister(false);
    setRegisterDone(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentType, slots]);

  // 한 칸 주문서 바르기
  const rollOne = useCallback(() => {
    setSimSlots((prev) => {
      if (currentIdx >= prev.length) return prev;
      const next = [...prev];
      const success = Math.random() * 100 < currentSlotPct;
      next[currentIdx] = { status: success ? "success" : "fail", pct: currentSlotPct };
      return next;
    });
    setCurrentIdx((prev) => {
      const nextIdx = prev + 1;
      if (nextIdx >= slots) {
        setSimSlots((final) => {
          const successCount = final.filter((s) => s.status === "success").length;
          const statGain = final.reduce((acc, s) => {
            if (s.status === "success") {
              return acc + getStatGain(scrollType, s.pct, equipmentType);
            }
            return acc;
          }, 0);
          setHistory((h) => [
            {
              slots: final,
              equipmentType,
              scrollType,
              totalSlots: slots,
              successCount,
              statGain,
              statLabel: scrollType,
            },
            ...h,
          ]);
          return final;
        });
        setRunning(false);
      }
      return nextIdx;
    });
  }, [currentIdx, currentSlotPct, slots, scrollType, equipmentType]);

  // 키보드: Space=바르기, F=리셋, 1=100%, 7=70%, 6=60%, 3=30%, 0=10%
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (running) rollOne();
        else reset();
      }
      if (e.code === "KeyF") {
        e.preventDefault();
        reset();
      }
      // 주문서 확률 단축키
      const pctMap: Record<string, number> = {
        "Digit1": 100, "Digit7": 70, "Digit6": 60, "Digit3": 30, "Digit0": 10,
      };
      if (pctMap[e.code] && running) {
        e.preventDefault();
        setCurrentSlotPct(pctMap[e.code]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [running, rollOne, reset]);

  const successes = simSlots.filter((s) => s.status === "success").length;
  const fails = simSlots.filter((s) => s.status === "fail").length;
  const done = !running && currentIdx > 0;

  // 완료된 시뮬의 총 스탯 증가량
  const totalStatGain = done
    ? simSlots.reduce((acc, s) => {
        if (s.status === "success") return acc + getStatGain(scrollType, s.pct, equipmentType);
        return acc;
      }, 0)
    : 0;

  // 등록
  const handleRegister = async () => {
    if (!registerNickname.trim()) return;
    setRegisterLoading(true);
    try {
      const scrollDetail = JSON.stringify(
        simSlots.map((s) => ({ pct: s.pct, status: s.status }))
      );
      await fetch("/api/scroll-rankings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: registerNickname.trim(),
          equipment_type: equipmentType,
          scroll_type: scrollType,
          slot_count: slots,
          success_count: successes,
          total_stat_gain: totalStatGain > 0 ? `+${totalStatGain}` : "0",
          scroll_detail: scrollDetail,
        }),
      });
      setRegisterDone(true);
    } catch {
      // silent fail
    } finally {
      setRegisterLoading(false);
    }
  };

  // 히스토리 통계
  const histAvg =
    history.length > 0
      ? history.reduce((a, b) => a + b.successCount, 0) / history.length
      : 0;

  return (
    <div className="space-y-6">
      {/* 설정 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-lg mb-4">설정</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">장비 종류</label>
            <select
              value={equipmentType}
              onChange={(e) => setEquipmentType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            >
              {Object.entries(WEAPON_SLOTS).map(([name, s]) => (
                <option key={name} value={name}>
                  {name} ({s}칸)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">주문서 종류</label>
            <select
              value={scrollType}
              onChange={(e) => setScrollType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            >
              {availableScrolls.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
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
              : `${equipmentType} 주문서 시뮬레이션`}
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
        <div className="flex gap-2 flex-wrap justify-center mb-5">
          {simSlots.map((slot, i) => (
            <div
              key={i}
              className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center text-xs font-bold border-2 transition-all duration-300 ${
                slot.status === "success"
                  ? "bg-green-100 border-green-400 text-green-600 scale-105"
                  : slot.status === "fail"
                  ? "bg-red-100 border-red-300 text-red-500"
                  : i === currentIdx && running
                  ? "bg-orange-50 border-orange-400 text-orange-500 animate-pulse"
                  : "bg-gray-50 border-gray-200 text-gray-300"
              }`}
            >
              <span className="text-base leading-none">
                {slot.status === "success"
                  ? "O"
                  : slot.status === "fail"
                  ? "X"
                  : i === currentIdx && running
                  ? "?"
                  : "·"}
              </span>
              {slot.status !== "pending" && (
                <span className="text-[10px] leading-none mt-0.5 opacity-70">{slot.pct}%</span>
              )}
              {i === currentIdx && running && slot.status === "pending" && (
                <span className="text-[10px] leading-none mt-0.5 opacity-70">{currentSlotPct}%</span>
              )}
            </div>
          ))}
        </div>

        {/* 현재 슬롯 주문서 % 선택 */}
        {running && (
          <div className="mb-5">
            <p className="text-xs text-gray-500 mb-2 text-center">
              슬롯 {currentIdx + 1} / {slots} — 바를 주문서 확률 선택
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              {SCROLL_TYPES.map((s) => (
                <button
                  key={s.pct}
                  onClick={() => setCurrentSlotPct(s.pct)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentSlotPct === s.pct
                      ? "bg-orange-500 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {s.label}
                  {getStatGain(scrollType, s.pct, equipmentType) > 0 && (
                    <span className="ml-1 text-xs opacity-75">
                      (+{getStatGain(scrollType, s.pct, equipmentType)})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

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
            {slots}칸 중 {successes}작 성공
            {totalStatGain > 0 && (
              <span className="ml-2 font-bold">
                · {scrollType} +{totalStatGain} 획득
              </span>
            )}
          </div>
        )}

        {/* 버튼 */}
        <div className="flex gap-3 justify-center flex-wrap">
          {running ? (
            <button
              onClick={rollOne}
              className="px-6 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              바르기 (Space)
            </button>
          ) : (
            <button
              onClick={reset}
              className="px-6 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              다시하기 (Space)
            </button>
          )}
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            초기화 (F)
          </button>
          {done && !registerDone && (
            <button
              onClick={() => setShowRegister(true)}
              className="px-6 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
            >
              결과 등록
            </button>
          )}
          {registerDone && (
            <span className="px-4 py-2.5 text-sm text-green-600 font-medium">등록 완료!</span>
          )}
        </div>

        {/* 키보드 안내 */}
        <p className="text-center text-xs text-gray-400 mt-3">
          Space: 바르기 / F: 초기화 / 1·7·6·3·0: 주문서 선택 (100%·70%·60%·30%·10%)
        </p>
      </div>

      {/* 결과 등록 모달 */}
      {showRegister && !registerDone && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold mb-3">랭킹에 결과 등록</h3>
          <div className="space-y-3 mb-4 text-sm text-gray-600">
            <div className="flex gap-4 flex-wrap">
              <span>장비: <strong>{equipmentType}</strong></span>
              <span>주문서: <strong>{scrollType}</strong></span>
              <span>결과: <strong>{successes}/{slots}작</strong></span>
              {totalStatGain > 0 && (
                <span>스탯: <strong>+{totalStatGain}</strong></span>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="닉네임 입력"
              value={registerNickname}
              onChange={(e) => setRegisterNickname(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleRegister(); }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              maxLength={20}
            />
            <button
              onClick={handleRegister}
              disabled={registerLoading || !registerNickname.trim()}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {registerLoading ? "등록중..." : "등록"}
            </button>
            <button
              onClick={() => setShowRegister(false)}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

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
              <div
                key={i}
                className={`inline-flex flex-col items-center justify-center px-2 py-1 rounded-lg text-xs font-bold min-w-[2.5rem] ${
                  h.successCount === h.totalSlots
                    ? "bg-orange-100 text-orange-600"
                    : h.successCount >= Math.ceil(h.totalSlots * 0.7)
                    ? "bg-green-100 text-green-600"
                    : h.successCount >= Math.ceil(h.totalSlots * 0.4)
                    ? "bg-blue-100 text-blue-600"
                    : "bg-red-100 text-red-600"
                }`}
              >
                <span>{h.successCount}작</span>
                {h.statGain > 0 && (
                  <span className="font-normal opacity-75">+{h.statGain}</span>
                )}
              </div>
            ))}
          </div>
          <div className="text-sm text-gray-500">
            총 {history.length}회 · 평균{" "}
            <span className="font-bold text-gray-700">{histAvg.toFixed(1)}작</span> ·
            올작{" "}
            <span className="font-bold text-orange-600">
              {history.filter((h) => h.successCount === h.totalSlots).length}회
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  랭킹 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function RankingTab() {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterEquipment, setFilterEquipment] = useState("");
  const equipmentOptions = ["", ...Object.keys(WEAPON_SLOTS)];

  const fetchRankings = useCallback(async (equipment: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ per_page: "50", page: "1" });
      if (equipment) params.set("equipment_type", equipment);
      const res = await fetch(`/api/scroll-rankings?${params}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setRankings(data.rankings ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setRankings([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRankings(filterEquipment);
  }, [filterEquipment, fetchRankings]);

  const formatDate = (dt: string) => {
    try {
      return new Date(dt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
    } catch {
      return dt.slice(0, 10);
    }
  };

  return (
    <div className="space-y-6">
      {/* 필터 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">장비 종류 필터</label>
            <select
              value={filterEquipment}
              onChange={(e) => setFilterEquipment(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            >
              <option value="">전체</option>
              {Object.keys(WEAPON_SLOTS).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => fetchRankings(filterEquipment)}
            className="mt-5 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            새로고침
          </button>
          <span className="mt-5 text-sm text-gray-400">총 {total}건</span>
        </div>
      </div>

      {/* 랭킹 테이블 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="font-bold">시뮬레이션 랭킹</h2>
          <p className="text-xs text-gray-400 mt-0.5">성공 횟수 기준 내림차순</p>
        </div>
        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : rankings.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            아직 등록된 랭킹이 없습니다. 시뮬레이션 후 결과를 등록해보세요!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500">
                  <th className="text-center px-3 py-2.5 font-medium w-12">순위</th>
                  <th className="text-left px-4 py-2.5 font-medium">닉네임</th>
                  <th className="text-left px-4 py-2.5 font-medium">장비</th>
                  <th className="text-left px-4 py-2.5 font-medium">주문서</th>
                  <th className="text-center px-4 py-2.5 font-medium">결과</th>
                  <th className="text-center px-4 py-2.5 font-medium">스탯</th>
                  <th className="text-center px-4 py-2.5 font-medium">날짜</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((r, idx) => {
                  const isAllSuccess = r.success_count === r.slot_count;
                  return (
                    <tr
                      key={r.id}
                      className={`border-t border-gray-50 ${isAllSuccess ? "bg-orange-50" : ""}`}
                    >
                      <td className="px-3 py-2.5 text-center font-bold">
                        {idx + 1 === 1 ? (
                          <span className="text-yellow-500">1</span>
                        ) : idx + 1 === 2 ? (
                          <span className="text-gray-400">2</span>
                        ) : idx + 1 === 3 ? (
                          <span className="text-orange-400">3</span>
                        ) : (
                          <span className="text-gray-500">{idx + 1}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-medium">{r.nickname}</td>
                      <td className="px-4 py-2.5 text-gray-600">{r.equipment_type}</td>
                      <td className="px-4 py-2.5 text-gray-600">{r.scroll_type}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md font-bold text-xs ${
                            isAllSuccess
                              ? "bg-orange-100 text-orange-600"
                              : r.success_count >= Math.ceil(r.slot_count * 0.7)
                              ? "bg-green-100 text-green-600"
                              : r.success_count >= Math.ceil(r.slot_count * 0.4)
                              ? "bg-blue-100 text-blue-600"
                              : "bg-red-100 text-red-500"
                          }`}
                        >
                          {r.success_count}/{r.slot_count}작
                          {isAllSuccess && " 올작"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono text-gray-700">
                        {r.total_stat_gain ?? "-"}
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-400 text-xs">
                        {formatDate(r.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
