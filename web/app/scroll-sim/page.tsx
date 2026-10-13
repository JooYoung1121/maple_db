"use client";

/* 주문서 시뮬레이터 — /scroll(확률 계산기)에 탭으로 있던 '시뮬레이션·랭킹'을 v4.13.0에서 분리·개편.
 * - 연출 무대(ScrollStage)에서 장비에 10·30·60·70·100% 주문서를 한 장씩 바른다
 * - 트(완작 1회) 단위 기록: 몇 트에 몇 작·스탯 얼마가 나왔는지 쌓이고 요약된다
 * - 완작 결과는 기존 /api/scroll-rankings 에 그대로 등록 (랭킹 데이터 호환) */

import Link from "next/link";
import PageGuide from "@/components/PageGuide";
import { PAGE_GUIDES } from "@/lib/pageGuides";
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  SCROLL_TYPES, SCROLL_SHORTCUTS, WEAPON_SLOTS, NAMED_ITEMS,
  getScrollsForEquipment, getStatGain, pctTheme, scrollIconUrl, hideOnError,
  type NamedItem,
} from "@/lib/scrollData";
import ScrollStage, { type StageRoll, type StageSlot } from "./ScrollStage";

/* 트(완작 1회) 기록 */
interface AttemptRecord {
  n: number;
  equipmentType: string;
  itemName: string | null;
  scrollType: string;
  slots: StageSlot[];
  successCount: number;
  statGain: number;
}

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

function resultTone(successCount: number, total: number): string {
  if (successCount === total) return "bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] text-maple";
  if (successCount >= Math.ceil(total * 0.7)) return "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300";
  if (successCount >= Math.ceil(total * 0.4)) return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";
  return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300";
}

export default function ScrollSimPage() {
  const [equipmentType, setEquipmentType] = useState("한손검");
  const [selectedItem, setSelectedItem] = useState<NamedItem | null>(null);
  const [scrollType, setScrollType] = useState("공격력 주문서");
  const [currentPct, setCurrentPct] = useState(60);
  const [history, setHistory] = useState<StageSlot[]>([]); // 현재 트에서 사용한 장
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [rankingRefresh, setRankingRefresh] = useState(0);

  // 등록
  const [showRegister, setShowRegister] = useState(false);
  const [registerNickname, setRegisterNickname] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerDone, setRegisterDone] = useState(false);

  const slots = WEAPON_SLOTS[equipmentType] ?? 7;
  const availableScrolls = useMemo(() => getScrollsForEquipment(equipmentType), [equipmentType]);
  const itemName = selectedItem ? selectedItem.name : equipmentType;

  useEffect(() => {
    if (availableScrolls.length > 0 && !availableScrolls.includes(scrollType)) setScrollType(availableScrolls[0]);
  }, [availableScrolls, scrollType]);

  // 장비 변경 → 현재 트 초기화 (기록은 유지)
  useEffect(() => {
    setHistory([]);
    setShowRegister(false);
    setRegisterDone(false);
  }, [equipmentType, slots]);

  const successes = history.filter((h) => h.ok).length;
  const done = history.length >= slots;
  const statGain = history.reduce((acc, h) => acc + (h.ok ? getStatGain(scrollType, h.pct, equipmentType) : 0), 0);

  // 주문서 % 단축키 (Q·W·E·R·T)
  useEffect(() => {
    const pctMap: Record<string, number> = { KeyQ: 10, KeyW: 30, KeyE: 60, KeyR: 70, KeyT: 100 };
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (pctMap[e.code]) { e.preventDefault(); setCurrentPct(pctMap[e.code]); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* 한 장 바르기 — 성공 판정. 마지막 장이면 트 기록에 추가 */
  const attemptsRef = useRef(attempts);
  attemptsRef.current = attempts;
  const applyOne = useCallback((): StageRoll | null => {
    if (history.length >= slots) return null;
    const ok = Math.random() * 100 < currentPct;
    const gain = ok ? getStatGain(scrollType, currentPct, equipmentType) : 0;
    const next = [...history, { pct: currentPct, ok }];
    setHistory(next);
    if (next.length >= slots) {
      const successCount = next.filter((h) => h.ok).length;
      const total = next.reduce((acc, h) => acc + (h.ok ? getStatGain(scrollType, h.pct, equipmentType) : 0), 0);
      setAttempts((prev) => [
        ...prev,
        { n: prev.length + 1, equipmentType, itemName: selectedItem?.name ?? null, scrollType, slots: next, successCount, statGain: total },
      ]);
    }
    return { success: ok, gain };
  }, [history, slots, currentPct, scrollType, equipmentType, selectedItem]);

  const newTry = useCallback(() => {
    setHistory([]);
    setShowRegister(false);
    setRegisterDone(false);
  }, []);

  const handleRegister = async () => {
    if (!registerNickname.trim()) return;
    setRegisterLoading(true);
    try {
      await fetch("/api/scroll-rankings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: registerNickname.trim(),
          equipment_type: equipmentType,
          scroll_type: scrollType,
          slot_count: slots,
          success_count: successes,
          total_stat_gain: statGain > 0 ? `+${statGain}` : "0",
          scroll_detail: JSON.stringify(history.map((s) => ({ pct: s.pct, status: s.ok ? "success" : "fail" }))),
        }),
      });
      setRegisterDone(true);
      setRankingRefresh((n) => n + 1);
    } catch {
      // silent fail — 랭킹 서버 장애 시 시뮬 자체는 계속
    } finally {
      setRegisterLoading(false);
    }
  };

  /* 트 기록 요약 */
  const summary = useMemo(() => {
    if (attempts.length === 0) return null;
    const total = attempts.length;
    const avg = attempts.reduce((a, b) => a + b.successCount, 0) / total;
    const all = attempts.filter((a) => a.successCount === a.slots.length).length;
    const best = attempts.reduce((b, a) => (a.statGain > b.statGain || (a.statGain === b.statGain && a.successCount > b.successCount) ? a : b), attempts[0]);
    const scrollsUsed = attempts.reduce((a, b) => a + b.slots.length, 0);
    return { total, avg, all, best, scrollsUsed };
  }, [attempts]);

  const th = pctTheme(currentPct);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold font-pixel">🎲 주문서 시뮬레이터</h1>
          {PAGE_GUIDES["/scroll-sim"] && <PageGuide guide={PAGE_GUIDES["/scroll-sim"]} />}
        </div>
        <p className="text-sm text-dim mt-1">
          장비를 고르고 <b className="text-ink">10·30·60·70·100% 주문서</b>를 한 장씩 발라봅니다. 업그레이드 횟수를 다 쓰면 1트로 기록되고,
          몇 트에 몇 작·스탯 얼마가 나왔는지 아래에 쌓입니다. 확률·기대값 계산은{" "}
          <Link href="/scroll" className="text-maple underline">주문서 확률 계산기</Link>에서.
        </p>
      </div>

      {/* ── 설정 ── */}
      <div className="pixel-panel p-4 space-y-3">
        <h2 className="font-pixel text-sm text-ink">대상 장비 · 주문서</h2>
        <ItemSearch onSelect={(item) => { setEquipmentType(item.type); setSelectedItem(item); }} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-dim mb-1">장비 종류</label>
            <select
              value={equipmentType}
              onChange={(e) => { setEquipmentType(e.target.value); setSelectedItem(null); }}
              className="w-full px-3 py-2 pixel-input text-sm"
            >
              {Object.entries(WEAPON_SLOTS).map(([name, s]) => (
                <option key={name} value={name}>{name} ({s}칸)</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-dim mb-1">주문서 종류</label>
            <select
              value={scrollType}
              onChange={(e) => setScrollType(e.target.value)}
              className="w-full px-3 py-2 pixel-input text-sm"
            >
              {availableScrolls.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* 바를 주문서 % — 장마다 바꿀 수 있다 */}
        <div>
          <p className="text-xs text-dim mb-2">
            바를 주문서 — <span className={`font-bold ${th.text}`}>{currentPct}%</span>
            {" "}(성공 시 {scrollType.replace(" 주문서", "")} +{getStatGain(scrollType, currentPct, equipmentType)}) · 장마다 바꿔 발라도 됩니다
          </p>
          <div className="flex gap-2 flex-wrap">
            {SCROLL_TYPES.map((s) => {
              const active = currentPct === s.pct;
              const t = pctTheme(s.pct);
              return (
                <button
                  key={s.pct}
                  type="button"
                  onClick={() => setCurrentPct(s.pct)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-2 border-2 transition-colors ${active ? `${t.ring} ${t.bg}` : "border-edge bg-surface2 hover:border-maple/60"}`}
                >
                  <img src={scrollIconUrl(s.pct)} alt="" onError={hideOnError} className="w-7 h-7 object-contain [image-rendering:pixelated]" />
                  <span className={`font-pixel text-[11px] ${active ? t.text : "text-dim"}`}>{s.label}</span>
                  <span className="text-[9px] text-dim opacity-60">+{getStatGain(scrollType, s.pct, equipmentType)} · [{SCROLL_SHORTCUTS[s.pct]}]</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 무대 ── */}
      <div className="pixel-panel p-4 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-pixel text-sm text-ink">직접 발라보기 — {attempts.length + (done ? 0 : 1)}트</h2>
          <span className="text-[11px] text-dim">Space 바르기 · F 새 장비 · Q·W·E·R·T 주문서 선택</span>
        </div>
        <ScrollStage
          name={itemName}
          iconUrl={selectedItem?.icon ?? null}
          slots={slots}
          history={history}
          currentPct={currentPct}
          scrollLabel={scrollType}
          statGain={statGain}
          onApply={applyOne}
          onReset={newTry}
        />
        {done && (
          <div className="flex flex-wrap items-center gap-2 border-t border-edge pt-3">
            <span className={`px-2 py-1 text-xs font-bold ${resultTone(successes, slots)}`}>
              {attempts.length}트 결과 · {successes}/{slots}작{statGain > 0 && ` · +${statGain}`}
            </span>
            {!registerDone ? (
              <button type="button" onClick={() => setShowRegister(true)} className="pixel-card px-3 py-1.5 font-pixel text-xs text-ink">
                랭킹에 등록
              </button>
            ) : (
              <span className="text-xs text-green-600 font-medium">등록 완료!</span>
            )}
          </div>
        )}
        {showRegister && !registerDone && (
          <div className="border-2 border-edge bg-surface2 p-3 space-y-2">
            <div className="text-xs text-dim flex flex-wrap gap-3">
              <span>장비: <b className="text-ink">{itemName}</b></span>
              <span>주문서: <b className="text-ink">{scrollType}</b></span>
              <span>결과: <b className="text-ink">{successes}/{slots}작</b></span>
              {statGain > 0 && <span>스탯: <b className="text-ink">+{statGain}</b></span>}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="닉네임 입력"
                value={registerNickname}
                onChange={(e) => setRegisterNickname(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleRegister(); }}
                className="flex-1 px-3 py-2 pixel-input text-sm"
                maxLength={20}
              />
              <button type="button" onClick={handleRegister} disabled={registerLoading || !registerNickname.trim()} className="px-4 py-2 pixel-btn text-sm disabled:opacity-50">
                {registerLoading ? "등록중..." : "등록"}
              </button>
              <button type="button" onClick={() => setShowRegister(false)} className="px-3 py-2 pixel-card font-pixel text-xs text-dim">취소</button>
            </div>
          </div>
        )}
      </div>

      {/* ── 트 기록 ── */}
      <div className="pixel-panel p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-pixel text-sm text-ink">시도 기록</h2>
            <p className="text-xs text-dim mt-1">업그레이드 횟수를 다 쓴 장비마다 1트로 쌓입니다. 이 브라우저 세션에만 남습니다.</p>
          </div>
          {attempts.length > 0 && (
            <button type="button" onClick={() => setAttempts([])} className="text-xs text-dim hover:text-maple shrink-0">기록 초기화</button>
          )}
        </div>
        {summary ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <SmallStat label="총 트" value={`${summary.total}트`} />
              <SmallStat label="평균" value={`${summary.avg.toFixed(1)}작`} />
              <SmallStat label="올작" value={`${summary.all}회`} />
              <SmallStat label="최고" value={`${summary.best.n}트 · ${summary.best.successCount}작${summary.best.statGain > 0 ? ` +${summary.best.statGain}` : ""}`} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface2 text-dim">
                    <th className="text-left px-2 py-1.5 font-medium w-12">트</th>
                    <th className="text-left px-2 py-1.5 font-medium">장비 · 주문서</th>
                    <th className="text-left px-2 py-1.5 font-medium">바른 순서</th>
                    <th className="text-center px-2 py-1.5 font-medium">결과</th>
                    <th className="text-right px-2 py-1.5 font-medium">스탯</th>
                  </tr>
                </thead>
                <tbody>
                  {[...attempts].reverse().map((a) => {
                    const isBest = a.n === summary.best.n;
                    return (
                      <tr key={a.n} className={`border-t border-edge/40 ${isBest ? "bg-[color-mix(in_srgb,var(--c-maple)_8%,transparent)]" : ""}`}>
                        <td className="px-2 py-1.5 font-pixel">{a.n}트{isBest && <span className="text-maple ml-1">★</span>}</td>
                        <td className="px-2 py-1.5">
                          <span className="text-ink">{a.itemName ?? a.equipmentType}</span>
                          <span className="text-dim"> · {a.scrollType}</span>
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="inline-flex flex-wrap gap-0.5">
                            {a.slots.map((s, i) => (
                              <span key={i} className={`inline-flex items-center gap-0.5 px-1 border ${s.ok ? "border-green-400 text-green-600" : "border-edge text-dim line-through"}`} title={`${i + 1}칸 ${s.pct}% ${s.ok ? "성공" : "실패"}`}>
                                <img src={scrollIconUrl(s.pct)} alt="" onError={hideOnError} className="w-3 h-3 object-contain [image-rendering:pixelated]" />{s.pct}
                              </span>
                            ))}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`inline-block px-1.5 py-0.5 font-bold ${resultTone(a.successCount, a.slots.length)}`}>
                            {a.successCount}/{a.slots.length}작{a.successCount === a.slots.length && " 올작"}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono">{a.statGain > 0 ? `+${a.statGain}` : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-dim">주문서 {summary.scrollsUsed}장 사용 · ★ 표시가 가장 잘 나온 트입니다.</p>
          </>
        ) : (
          <p className="text-xs text-dim py-3 text-center">아직 완작한 장비가 없습니다. 위 무대에서 {slots}장을 다 바르면 1트가 기록됩니다.</p>
        )}
      </div>

      {/* ── 랭킹 ── */}
      <RankingSection refreshKey={rankingRefresh} />
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="pixel-card p-2">
      <div className="font-pixel text-[10px] text-dim">{label}</div>
      <div className="font-bold text-sm mt-0.5 truncate" title={value}>{value}</div>
    </div>
  );
}

// ─── 아이템 검색 ───
function ItemSearch({ onSelect }: { onSelect: (item: NamedItem) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<NamedItem | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.length >= 1
    ? NAMED_ITEMS.filter((i) => i.name.includes(query) || i.type.includes(query)).slice(0, 10)
    : [];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-dim mb-1">
        아이템 검색 (선택 시 장비 종류 자동 적용)
      </label>
      <div className="flex items-center gap-2 pixel-input px-3 py-2">
        {selected && (
          <img
            src={selected.icon}
            alt={selected.name}
            className="w-7 h-7 object-contain shrink-0"
          />
        )}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="예: 타임리스, 드래곤, 엔가우..."
          className="flex-1 text-sm focus:outline-none bg-transparent"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setSelected(null); }}
            className="text-dim hover:text-maple text-base leading-none"
          >
            ×
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 pixel-panel max-h-60 overflow-y-auto">
          {filtered.map((item) => (
            <button
              key={item.name}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery(item.name);
                setSelected(item);
                setOpen(false);
                onSelect(item);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)] text-left transition-colors"
            >
              <img
                src={item.icon}
                alt={item.name}
                className="w-8 h-8 object-contain shrink-0"
              />
              <div>
                <p className="text-sm font-medium text-ink">{item.name}</p>
                <p className="text-xs text-dim">{item.type}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 랭킹 ───
function RankingSection({ refreshKey }: { refreshKey: number }) {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterEquipment, setFilterEquipment] = useState("");

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
  }, [filterEquipment, fetchRankings, refreshKey]);

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
      <div className="pixel-panel p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-dim mb-1">장비 종류 필터</label>
            <select
              value={filterEquipment}
              onChange={(e) => setFilterEquipment(e.target.value)}
              className="px-3 py-2 pixel-input text-sm"
            >
              <option value="">전체</option>
              {Object.keys(WEAPON_SLOTS).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => fetchRankings(filterEquipment)}
            className="mt-5 px-4 py-2 bg-surface2 border-2 border-edge text-dim font-pixel text-sm hover:text-maple transition-colors"
          >
            새로고침
          </button>
          <span className="mt-5 text-sm text-dim">총 {total}건</span>
        </div>
      </div>

      {/* 랭킹 테이블 */}
      <div className="pixel-panel overflow-hidden">
        <div className="px-5 py-3 border-b-2 border-edge">
          <h2 className="font-bold font-pixel">시뮬레이션 랭킹</h2>
          <p className="text-xs text-dim mt-0.5">성공 횟수 기준 내림차순</p>
        </div>
        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-dim">불러오는 중...</div>
        ) : rankings.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-dim">
            아직 등록된 랭킹이 없습니다. 시뮬레이션 후 결과를 등록해보세요!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface2 text-dim">
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
                      className={`border-t border-edge/40 ${isAllSuccess ? "bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)]" : ""}`}
                    >
                      <td className="px-3 py-2.5 text-center font-bold">
                        {idx + 1 === 1 ? (
                          <span className="text-yellow-500">1</span>
                        ) : idx + 1 === 2 ? (
                          <span className="text-gray-400">2</span>
                        ) : idx + 1 === 3 ? (
                          <span className="text-orange-400">3</span>
                        ) : (
                          <span className="text-dim">{idx + 1}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-medium">{r.nickname}</td>
                      <td className="px-4 py-2.5 text-dim">{r.equipment_type}</td>
                      <td className="px-4 py-2.5 text-dim">{r.scroll_type}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md font-bold text-xs ${
                            isAllSuccess
                              ? "bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] text-maple"
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
                      <td className="px-4 py-2.5 text-center font-mono text-ink">
                        {r.total_stat_gain ?? "-"}
                      </td>
                      <td className="px-4 py-2.5 text-center text-dim text-xs">
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
