"use client";

/* 주문서 시뮬레이터 — /scroll(확률 계산기)에 탭으로 있던 '시뮬레이션·랭킹'을 v4.13.0에서 분리·개편.
 * - 연출 무대(ScrollStage)에서 장비에 10·30·60·70·100% 주문서를 한 장씩 바른다
 * - 트(완작 1회) 단위 기록: 몇 트에 몇 작·스탯 얼마가 나왔는지 쌓이고 요약된다
 * - 완작 결과는 기존 /api/scroll-rankings 에 그대로 등록 (랭킹 데이터 호환)
 *
 * 화면 구성(v4.15.0): 공용 시뮬 키트(components/sim/SimKit) — 왼쪽 아이템 카드(DB REQ·기본 옵션 + 주문서로 오른 스탯)
 * · ① 주문서 강화(% 카드 Q·W·E·R·T + 새 장비 + 무대) · ② 사용 내역(%별 주문서 개수 × 단가, 거래소 시세 자동 단가)
 * · 기록 로그(Space/A 바르기, F 새 장비, V 전체 리셋, M 사운드) · URL ?equip=&scroll=&item= 공유 */

import Link from "next/link";
import PageGuide from "@/components/PageGuide";
import { PAGE_GUIDES } from "@/lib/pageGuides";
import { Suspense, useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  SCROLL_TYPES, SCROLL_SHORTCUTS, WEAPON_SLOTS, NAMED_ITEMS,
  getScrollsForEquipment, getStatGain, pctTheme, scrollIconUrl, hideOnError,
  type NamedItem,
} from "@/lib/scrollData";
import { getItem } from "@/lib/api";
import type { Item } from "@/lib/types";
import { useMarketPrices } from "@/lib/useMarketPrice";
import {
  SimActionCard, SimItemCard, SimLedger, SimLog, SimToolbar, formatMeso,
  useSimHotkeys, useSimLog, useSimSound, type SimStatLine,
} from "@/components/sim/SimKit";
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

const HOTKEY_LEGEND = "Q·W·E·R·T 주문서 % · Space/A 바르기 · F 새 장비 · V 전체 리셋 · M 사운드";

/* 주문서 종류 → 아이템 카드에 표시할 옵션 줄 라벨 · DB stats 키 */
const SCROLL_STAT_KEY: Record<string, { label: string; key: string }> = {
  "공격력 주문서": { label: "공격력", key: "incPAD" },
  "마력 주문서": { label: "마력", key: "incMAD" },
  "STR 주문서": { label: "STR", key: "incSTR" },
  "DEX 주문서": { label: "DEX", key: "incDEX" },
  "INT 주문서": { label: "INT", key: "incINT" },
  "LUK 주문서": { label: "LUK", key: "incLUK" },
  "HP 주문서": { label: "HP", key: "incMHP" },
  "이동속도 주문서": { label: "이동속도", key: "incSpeed" },
};
const CARD_STAT_ORDER: { label: string; key: string }[] = [
  { label: "공격력", key: "incPAD" }, { label: "마력", key: "incMAD" },
  { label: "STR", key: "incSTR" }, { label: "DEX", key: "incDEX" }, { label: "INT", key: "incINT" }, { label: "LUK", key: "incLUK" },
  { label: "HP", key: "incMHP" }, { label: "MP", key: "incMMP" }, { label: "물리방어", key: "incPDD" }, { label: "마법방어", key: "incMDD" },
  { label: "명중", key: "incACC" }, { label: "회피", key: "incEVA" }, { label: "이동속도", key: "incSpeed" }, { label: "점프", key: "incJump" },
];

function parseStats(statsJson: string | null | undefined): Record<string, number> {
  if (!statsJson) return {};
  try {
    const raw = JSON.parse(statsJson) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) if (typeof v === "number") out[k] = v;
    return out;
  } catch { return {}; }
}

function namedItemId(item: NamedItem | null): number | null {
  const m = item?.icon.match(/\/item\/(\d+)/);
  return m ? Number(m[1]) : null;
}

function resultTone(successCount: number, total: number): string {
  if (successCount === total) return "bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] text-maple";
  if (successCount >= Math.ceil(total * 0.7)) return "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300";
  if (successCount >= Math.ceil(total * 0.4)) return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";
  return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300";
}

function replaceParams(params: Record<string, string | null>) {
  try {
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v); else url.searchParams.delete(k);
    }
    window.history.replaceState(null, "", url.toString());
  } catch { /* ignore */ }
}

export default function ScrollSimPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-dim">로딩 중...</div>}>
      <ScrollSim />
    </Suspense>
  );
}

function ScrollSim() {
  const searchParams = useSearchParams();
  const [equipmentType, setEquipmentType] = useState("한손검");
  const [selectedItem, setSelectedItem] = useState<NamedItem | null>(null);
  const [scrollType, setScrollType] = useState("공격력 주문서");
  const [currentPct, setCurrentPct] = useState(60);
  const [history, setHistory] = useState<StageSlot[]>([]); // 현재 트에서 사용한 장
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [rankingRefresh, setRankingRefresh] = useState(0);
  const [itemMeta, setItemMeta] = useState<Record<number, Item | null>>({});

  const log = useSimLog();
  const sound = useSimSound();

  // 등록
  const [showRegister, setShowRegister] = useState(false);
  const [registerNickname, setRegisterNickname] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerDone, setRegisterDone] = useState(false);

  const slots = WEAPON_SLOTS[equipmentType] ?? 7;
  const availableScrolls = useMemo(() => getScrollsForEquipment(equipmentType), [equipmentType]);
  const itemName = selectedItem ? selectedItem.name : equipmentType;
  const dbId = namedItemId(selectedItem);
  const meta = dbId !== null ? itemMeta[dbId] : null;

  // URL 초기 적용
  const urlApplied = useRef(false);
  useEffect(() => {
    if (urlApplied.current) return;
    urlApplied.current = true;
    const equip = searchParams.get("equip");
    const scroll = searchParams.get("scroll");
    const named = searchParams.get("item");
    const found = named ? NAMED_ITEMS.find((i) => i.name === named) : null;
    if (found) { setSelectedItem(found); setEquipmentType(found.type); }
    else if (equip && WEAPON_SLOTS[equip]) setEquipmentType(equip);
    if (scroll) setScrollType(scroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    replaceParams({ equip: equipmentType, scroll: scrollType, item: selectedItem?.name ?? null });
  }, [equipmentType, scrollType, selectedItem]);

  useEffect(() => {
    if (availableScrolls.length > 0 && !availableScrolls.includes(scrollType)) setScrollType(availableScrolls[0]);
  }, [availableScrolls, scrollType]);

  // 아이템 카드 메타 (REQ·기본 옵션)
  useEffect(() => {
    if (dbId === null || itemMeta[dbId] !== undefined) return;
    let cancelled = false;
    getItem(dbId)
      .then((d) => { if (!cancelled) setItemMeta((prev) => ({ ...prev, [dbId]: d.item })); })
      .catch(() => { if (!cancelled) setItemMeta((prev) => ({ ...prev, [dbId]: null })); });
    return () => { cancelled = true; };
  }, [dbId, itemMeta]);

  // 장비 변경 → 현재 트 초기화 (기록은 유지)
  const prevEquip = useRef(`${equipmentType}|${slots}`);
  useEffect(() => {
    const key = `${equipmentType}|${slots}`;
    if (prevEquip.current !== key) {
      prevEquip.current = key;
      setHistory([]);
      setShowRegister(false);
      setRegisterDone(false);
      log.push(`대상 변경 → ${itemName} (${equipmentType} · ${slots}칸)`, "info");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentType, slots]);

  const successes = history.filter((h) => h.ok).length;
  const done = history.length >= slots;
  const statGain = history.reduce((acc, h) => acc + (h.ok ? getStatGain(scrollType, h.pct, equipmentType) : 0), 0);
  const currentTry = attempts.length + (done ? 0 : 1);
  const statLabel = scrollType.replace(" 주문서", "");

  /* 한 장 바르기 — 성공 판정. 마지막 장이면 트 기록에 추가 */
  const applyOne = useCallback((): StageRoll | null => {
    if (history.length >= slots) return null;
    const ok = Math.random() * 100 < currentPct;
    const gain = ok ? getStatGain(scrollType, currentPct, equipmentType) : 0;
    const next = [...history, { pct: currentPct, ok }];
    setHistory(next);
    const prefix = `${currentTry}트 ${next.length}/${slots}장 ${currentPct}%`;
    if (ok) { log.push(`${prefix} 성공 · ${statLabel} +${gain}`, "ok"); sound.play("success"); }
    else { log.push(`${prefix} 실패`, "fail"); sound.play("fail"); }
    if (next.length >= slots) {
      const successCount = next.filter((h) => h.ok).length;
      const total = next.reduce((acc, h) => acc + (h.ok ? getStatGain(scrollType, h.pct, equipmentType) : 0), 0);
      setAttempts((prev) => [
        ...prev,
        { n: prev.length + 1, equipmentType, itemName: selectedItem?.name ?? null, scrollType, slots: next, successCount, statGain: total },
      ]);
      const all = successCount === slots;
      log.push(`${currentTry}트 완료 — ${successCount}/${slots}작${total > 0 ? ` · ${statLabel} +${total}` : ""}${all ? " ★ 올작" : ""}`, all ? "best" : "warn");
      if (all) sound.play("fanfare");
    }
    return { success: ok, gain };
  }, [history, slots, currentPct, scrollType, equipmentType, selectedItem, currentTry, statLabel, log, sound]);

  const newTry = useCallback(() => {
    if (history.length > 0 && history.length < slots) log.push(`${currentTry}트 중단 (${history.length}/${slots}장) — 새 장비`, "info");
    setHistory([]);
    setShowRegister(false);
    setRegisterDone(false);
  }, [history.length, slots, currentTry, log]);

  const resetAll = useCallback(() => {
    setHistory([]);
    setAttempts([]);
    setShowRegister(false);
    setRegisterDone(false);
    log.clear();
    log.push("전체 리셋 — 사용 내역·시도 기록 초기화", "info");
  }, [log]);

  const pickPct = useCallback((pct: number) => { setCurrentPct(pct); sound.play("click"); }, [sound]);

  useSimHotkeys({
    KeyQ: () => pickPct(10),
    KeyW: () => pickPct(30),
    KeyE: () => pickPct(60),
    KeyR: () => pickPct(70),
    KeyT: () => pickPct(100),
    KeyV: resetAll,
    KeyM: sound.toggle,
  });

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
      log.push(`랭킹 등록 — ${registerNickname.trim()} · ${successes}/${slots}작`, "info");
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

  /* ── 사용 내역: %별 주문서 개수 · 장비 개수 (완작 + 진행 중) ── */
  const usage = useMemo(() => {
    const byPct: Record<number, number> = {};
    for (const a of attempts) for (const s of a.slots) byPct[s.pct] = (byPct[s.pct] ?? 0) + 1;
    for (const s of history) byPct[s.pct] = (byPct[s.pct] ?? 0) + 1;
    return { items: attempts.length + (history.length > 0 ? 1 : 0), byPct };
  }, [attempts, history]);

  const scrollMarketName = (pct: number) => `${equipmentType} ${scrollType} ${pct}%`;
  const ledgerPcts = SCROLL_TYPES.map((s) => s.pct).filter((pct) => (usage.byPct[pct] ?? 0) > 0 || pct === currentPct);
  const market = useMarketPrices([itemName, ...ledgerPcts.map(scrollMarketName)]);
  const [unitPrices, setUnitPrices] = useState<Record<string, number | null>>({});
  const autoFilled = useRef<Record<string, boolean>>({});
  useEffect(() => {
    setUnitPrices((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [name, mp] of Object.entries(market)) {
        if (mp && next[name] === undefined && !autoFilled.current[name]) {
          autoFilled.current[name] = true;
          next[name] = mp.price;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [market]);
  const unitOf = (name: string) => (unitPrices[name] === undefined ? null : unitPrices[name]);
  const ledgerRows = [
    { key: itemName, icon: selectedItem?.icon ?? null, label: itemName, count: usage.items, unitPrice: unitOf(itemName), market: market[itemName] ?? null },
    ...ledgerPcts.map((pct) => {
      const name = scrollMarketName(pct);
      return { key: name, icon: scrollIconUrl(pct), label: name, count: usage.byPct[pct] ?? 0, unitPrice: unitOf(name), market: market[name] ?? null };
    }),
  ];
  const costOfAttempt = (a: AttemptRecord) =>
    a.slots.reduce((sum, s) => sum + (unitOf(`${a.equipmentType} ${a.scrollType} ${s.pct}%`) ?? 0), 0) + (unitOf(a.itemName ?? a.equipmentType) ?? 0);
  const totalCost = attempts.reduce((sum, a) => sum + costOfAttempt(a), 0)
    + history.reduce((sum, s) => sum + (unitOf(scrollMarketName(s.pct)) ?? 0), 0)
    + (history.length > 0 ? (unitOf(itemName) ?? 0) : 0);

  /* ── 아이템 카드 옵션 줄: DB 기본 옵션 + 주문서로 오른 스탯 ── */
  const cardStats: SimStatLine[] = useMemo(() => {
    const base = parseStats(meta?.stats);
    const gainKey = SCROLL_STAT_KEY[scrollType];
    const lines: SimStatLine[] = [];
    for (const { label, key } of CARD_STAT_ORDER) {
      const b = base[key] ?? 0;
      const g = gainKey && gainKey.key === key ? statGain : 0;
      if (b > 0 || g > 0 || (gainKey && gainKey.key === key)) lines.push({ label, base: b, current: b + g });
    }
    return lines;
  }, [meta, scrollType, statGain]);

  const th = pctTheme(currentPct);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <SimToolbar
        backHref="/scroll"
        backLabel="확률 계산기"
        title={<span>🎲 주문서 시뮬레이터 <span className="text-dim text-sm font-normal">— {itemName}</span></span>}
        right={PAGE_GUIDES["/scroll-sim"] ? <PageGuide guide={PAGE_GUIDES["/scroll-sim"]} /> : null}
      />
      <p className="text-sm text-dim">
        장비를 고르고 <b className="text-ink">10·30·60·70·100% 주문서</b>를 한 장씩 발라봅니다. 업그레이드 횟수를 다 쓰면 1트로 기록되고,
        몇 트에 몇 작·스탯 얼마가 나왔는지 아래에 쌓입니다. 확률·기대값 계산은{" "}
        <Link href="/scroll" className="text-maple underline">주문서 확률 계산기</Link>, 혼돈의 주문서는{" "}
        <Link href="/chaos" className="text-maple underline">혼줌 시뮬레이터</Link>에서.
      </p>

      {/* ── 설정 ── */}
      <div className="pixel-panel p-4 space-y-3">
        <ItemSearch
          selected={selectedItem}
          onSelect={(item) => { setEquipmentType(item.type); setSelectedItem(item); }}
          onClear={() => setSelectedItem(null)}
        />
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
      </div>

      {/* ── 아이템 카드 + ① 주문서 강화 ── */}
      <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-4 items-start">
        <SimItemCard
          name={itemName}
          subName={meta?.name && meta.name !== itemName ? meta.name : selectedItem ? null : "장비 종류만 선택됨"}
          icon={selectedItem?.icon ?? null}
          reqLevel={meta?.level_req ?? null}
          jobReq={meta?.job_req ?? null}
          category={equipmentType}
          stats={cardStats}
          slotsTotal={slots}
          slotsUsed={history.length}
          note={selectedItem ? null : <span>아이템을 검색해 고르면 요구 레벨·기본 옵션이 함께 표시됩니다. 지금은 <b className="text-ink">{equipmentType}</b> 공용 설정({slots}칸)입니다.</span>}
        />

        <div className="space-y-4 min-w-0">
          <section className="pixel-panel p-4 space-y-3" aria-label="주문서 강화">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-pixel text-sm text-ink">① 주문서 강화 <span className="text-dim font-normal">— {currentTry}트</span></h2>
              <span className="text-[11px] text-dim">남은 횟수 <b className={done ? "text-red-500" : "text-maple"}>{Math.max(0, slots - history.length)}</b> / {slots}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SCROLL_TYPES.map((s) => (
                <SimActionCard
                  key={s.pct}
                  icon={<img src={scrollIconUrl(s.pct)} alt="" onError={hideOnError} className="w-9 h-9 object-contain [image-rendering:pixelated]" />}
                  hotkey={SCROLL_SHORTCUTS[s.pct]}
                  title={`${statLabel} ${s.label}`}
                  subtitle={`성공 시 +${getStatGain(scrollType, s.pct, equipmentType)}`}
                  active={currentPct === s.pct}
                  onClick={() => pickPct(s.pct)}
                />
              ))}
              <SimActionCard icon="↺" hotkey="F" title="새 장비" subtitle={history.length > 0 && !done ? `${currentTry}트 중단하고 처음부터` : "처음부터"} onClick={newTry} disabled={history.length === 0} />
              <SimActionCard icon="🧹" hotkey="V" title="전체 리셋" subtitle="사용 내역·기록 초기화" tone="danger" onClick={resetAll} />
            </div>
            <p className="text-xs text-dim">
              선택한 주문서 <span className={`font-bold ${th.text}`}>{currentPct}%</span> — Space/A 로 한 장씩 바릅니다. 장마다 %를 바꿔 발라도 됩니다.
            </p>
            {/* 무대 내부 폭(이미지+툴팁)이 좁은 화면보다 넓을 수 있어 가로 스크롤로 감싼다 */}
            <div className="overflow-x-auto">
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
            </div>
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
          </section>

          <SimLedger
            rows={ledgerRows}
            onUnitPriceChange={(key, price) => setUnitPrices((prev) => ({ ...prev, [key]: price }))}
            onResetAll={resetAll}
            resetHotkey="V"
            footnote="단가는 메소 단위. '시세' 버튼은 거래소 최근 일봉 판매 매물 평균가(아이템 시세 메뉴와 동일 출처)입니다. 장비 종류만 고른 경우 장비 단가는 직접 입력하세요."
          />
        </div>
      </div>

      {/* ── 기록 로그 ── */}
      <SimLog entries={log.entries} hotkeyLegend={HOTKEY_LEGEND} soundOn={sound.enabled} onToggleSound={sound.toggle} onClear={log.clear} />

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
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <SmallStat label="총 트" value={`${summary.total}트`} />
              <SmallStat label="평균" value={`${summary.avg.toFixed(1)}작`} />
              <SmallStat label="올작" value={`${summary.all}회`} />
              <SmallStat label="최고" value={`${summary.best.n}트 · ${summary.best.successCount}작${summary.best.statGain > 0 ? ` +${summary.best.statGain}` : ""}`} />
              <SmallStat label="누적 비용" value={totalCost > 0 ? `${formatMeso(totalCost)} 메소` : "단가 입력"} />
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
                    <th className="text-right px-2 py-1.5 font-medium">비용</th>
                  </tr>
                </thead>
                <tbody>
                  {[...attempts].reverse().map((a) => {
                    const isBest = a.n === summary.best.n;
                    const cost = costOfAttempt(a);
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
                        <td className="px-2 py-1.5 text-right font-mono text-dim">{cost > 0 ? formatMeso(cost) : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-dim">주문서 {summary.scrollsUsed}장 사용 · ★ 표시가 가장 잘 나온 트입니다. 비용은 ② 사용 내역의 단가로 계산합니다.</p>
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
function ItemSearch({ selected, onSelect, onClear }: { selected: NamedItem | null; onSelect: (item: NamedItem) => void; onClear: () => void }) {
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 외부(URL 복원 등)에서 선택이 바뀌면 입력칸도 따라간다
  useEffect(() => { if (selected) setQuery(selected.name); }, [selected]);

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
        아이템 검색 (선택 시 장비 종류 자동 적용 · 요구 레벨·기본 옵션 표시)
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
            if (selected) onClear();
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="예: 타임리스, 드래곤, 엔가우..."
          className="flex-1 text-sm focus:outline-none bg-transparent"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); onClear(); }}
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
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery(item.name);
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
