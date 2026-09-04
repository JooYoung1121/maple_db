"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { searchSuggest, getItem, registerEnhanceShowcase, getEnhanceShowcase, type EnhanceShowcase } from "@/lib/api";
import type { MakerData, SearchSuggestion } from "@/lib/types";
import { ShowcaseCard } from "./EnhanceShowcase";
import {
  STAT_LABEL, SUBCAT_KIND, isWeaponKind, gemsForKind, gemIconUrl, type Gem,
  optRange, rollDeviation, deviationStats,
  scrollSeriesFor, scrollIconUrl, rollScroll, type ScrollSeries,
  growTableFor, rollGrowth, MAX_GROW_LEVEL, EXP_PER_LEVEL, huntExp,
  mergeStats, orderedStatEntries, isGrowthItemName, itemGrade, GRADE_COLOR,
  type Stats, type StatKey,
} from "@/lib/enhanceSim";

const JOBS = ["초보자", "전사", "마법사", "궁수", "도적", "해적"] as const;
const SCROLL_PCTS = [10, 60, 100] as const;
const PCT_KEY: Record<number, string> = { 10: "Q", 60: "W", 100: "E" };

const PCT_THEME: Record<number, { ring: string; text: string; bg: string }> = {
  10: { ring: "border-red-400/70", text: "text-red-400", bg: "bg-red-500/10" },
  60: { ring: "border-orange-400/70", text: "text-orange-400", bg: "bg-orange-500/10" },
  100: { ring: "border-sky-400/70", text: "text-sky-400", bg: "bg-sky-500/10" },
};

interface LoadedItem {
  id: number;
  nameKr: string;
  nameEn: string;
  iconUrl: string;
  kind: string; // 한글 장비 종류
  jobReq: string;
  attackSpeed: string;
  slots: number;
  reqLevel: number;
  base: Stats;
  req: Partial<Record<string, number>>;
  isGrowth: boolean;
}

interface ScrollSlot { pct: number; ok: boolean }

const hideImg = (e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.visibility = "hidden"; };

// 리버스·타임리스 장비만 (한글명 또는 영문명 접두 기준)
function isReverseOrTimeless(s: SearchSuggestion): boolean {
  const kr = s.name_kr ?? "";
  const en = s.name ?? "";
  return /^(리버스|타임리스)\s/.test(kr.trim()) || /^(Reverse|Timeless)\s/i.test(en.trim());
}

function statText(stats: Stats): string {
  const e = orderedStatEntries(stats);
  if (!e.length) return "-";
  return e.map(([k, v]) => `${STAT_LABEL[k]} ${v >= 0 ? "+" : ""}${v}`).join(", ");
}

export default function ItemEnhanceSimulator({ makerData }: { makerData: MakerData | null }) {
  const [item, setItem] = useState<LoadedItem | null>(null);
  const [loadingItem, setLoadingItem] = useState(false);

  // ① 제작
  const [gemSel, setGemSel] = useState<(number | null)[]>([null, null, null]); // itemId or null
  const [useAccel, setUseAccel] = useState(false);
  const [crafted, setCrafted] = useState(false);
  const [destroyed, setDestroyed] = useState(false);
  const [gemAdd, setGemAdd] = useState<Stats>({});
  const [deviation, setDeviation] = useState<Stats>({});

  // ③ 주문서
  const [seriesId, setSeriesId] = useState<string>("");
  const [scrollSlots, setScrollSlots] = useState<ScrollSlot[]>([]);

  // ④ 성장 — 연속 클릭 stale-closure 방지용 ref가 권위값, state는 렌더용
  const [level, setLevel] = useState(0);
  const [exp, setExp] = useState(0);
  const [growAdd, setGrowAdd] = useState<Stats>({});
  const growthRef = useRef({ level: 0, exp: 0 });

  // ⑤ 단가
  const [prices, setPrices] = useState<Record<string, number>>({});

  // 행동 로그 (최근이 위로)
  const [log, setLog] = useState<{ at: number; text: string }[]>([]);
  const pushLog = useCallback((text: string) => {
    setLog((prev) => [{ at: Date.now(), text }, ...prev].slice(0, 40));
  }, []);

  // 명예의전당 등록·공유
  const [regNick, setRegNick] = useState("");
  const [regBusy, setRegBusy] = useState(false);
  const [regError, setRegError] = useState("");
  const [sharedId, setSharedId] = useState<number | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  // 공유 링크로 열린 남의 결과
  const [shared, setShared] = useState<EnhanceShowcase | null>(null);

  const gems = useMemo(() => (item ? gemsForKind(item.kind) : []), [item]);
  const seriesList = useMemo(() => (item ? scrollSeriesFor(item.kind) : []), [item]);
  const series = useMemo(() => seriesList.find((s) => s.id === seriesId) ?? seriesList[0], [seriesList, seriesId]);
  const growTable = useMemo(() => (item ? growTableFor(item.kind, item.jobReq) : null), [item]);
  const canGrow = !!(item && item.isGrowth && growTable);

  const resetEnhance = useCallback((silent = false) => {
    setGemSel([null, null, null]);
    setUseAccel(false);
    setCrafted(false);
    setDestroyed(false);
    setGemAdd({});
    setDeviation({});
    setScrollSlots([]);
    setLevel(0);
    setExp(0);
    setGrowAdd({});
    growthRef.current = { level: 0, exp: 0 };
    if (!silent) { setLog([]); pushLog("전체 리셋"); }
  }, [pushLog]);

  const loadItem = useCallback(async (id: number, fallbackName: string, iconUrl: string | null) => {
    setLoadingItem(true);
    try {
      const { item: it } = await getItem(id);
      const raw = it.stats ? (typeof it.stats === "string" ? JSON.parse(it.stats) : it.stats) : {};
      const base: Stats = {};
      const req: Record<string, number> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v !== "number") continue;
        if (k.startsWith("req")) req[k] = v;
        else base[k as StatKey] = v;
      }
      const nameKr = it.names_en?.find((n) => n.source === "mapleland-current")?.name_en
        ?? it.names_en?.find((n) => n.source === "kms")?.name_en
        ?? fallbackName;
      const kind = SUBCAT_KIND[it.subcategory ?? ""] ?? (it.subcategory ?? "");
      const loaded: LoadedItem = {
        id,
        nameKr,
        nameEn: it.name,
        iconUrl: `/api/icon/item/${id}`, // 프록시 — 검색/DB의 외부 URL 대신 서버 캐시 사용
        kind,
        jobReq: it.job_req ?? "",
        attackSpeed: it.attack_speed ?? "",
        slots: it.upgrade_slots ?? 0,
        reqLevel: it.level_req ?? req["reqLevel"] ?? 0,
        base,
        req,
        isGrowth: isGrowthItemName(nameKr),
      };
      setItem(loaded);
      resetEnhance(true);
      setLog([]);
      setSeriesId(scrollSeriesFor(kind)[0]?.id ?? "");
    } catch {
      // 아이템 로드 실패 — 조용히 무시
    } finally {
      setLoadingItem(false);
    }
  }, [resetEnhance]);

  // ── ① 제작하기 ──
  const doCraft = useCallback(() => {
    if (!item) return;
    // 촉진제: 10% 파괴
    if (useAccel && Math.random() < 0.1) {
      setDestroyed(true);
      setCrafted(false);
      setGemAdd({});
      setDeviation({});
      pushLog("💥 촉진제 제작 실패 — 재료 소멸");
      return;
    }
    const g: Stats = {};
    for (const id of gemSel) {
      if (id == null) continue;
      const gem = gems.find((x) => x.itemId === id);
      if (gem) g[gem.stat] = (g[gem.stat] ?? 0) + gem.amount;
    }
    const dev: Stats = {};
    for (const k of deviationStats(item.base)) {
      dev[k] = rollDeviation(item.base[k] as number, useAccel);
    }
    setGemAdd(g);
    setDeviation(dev);
    setCrafted(true);
    setDestroyed(false);
    // 제작하면 주문서·성장은 새 장비 기준으로 초기화
    setScrollSlots([]);
    setLevel(0);
    setExp(0);
    setGrowAdd({});
    growthRef.current = { level: 0, exp: 0 };
    const gemNames = gemSel.map((id) => gems.find((x) => x.itemId === id)?.name).filter(Boolean);
    const devTxt = orderedStatEntries(dev).filter(([, v]) => v !== 0).map(([k, v]) => `${STAT_LABEL[k]}${v > 0 ? "+" : ""}${v}${v > 0 ? "상" : "하"}`).join(", ");
    pushLog(`제작 완료${useAccel ? "(촉진제)" : ""}${gemNames.length ? ` · 보석 ${gemNames.join("/")}` : ""} · 옵션 ${devTxt || "정옵"}`);
  }, [item, gemSel, gems, useAccel, pushLog]);

  // ── ③ 주문서 1장 ──
  const applyScroll = useCallback((pct: number) => {
    if (!item || !series) return;
    if (scrollSlots.length >= item.slots) return;
    const ok = rollScroll(pct);
    const slotNo = scrollSlots.length + 1;
    setScrollSlots((prev) => [...prev, { pct, ok }]);
    const gain = ok ? ` (${STAT_LABEL[series.stat]}+${series.byPct[pct] ?? 0})` : "";
    pushLog(`${slotNo}번째 · ${pct}% 주문서 → ${ok ? "성공" : "실패"}${gain}`);
  }, [item, series, scrollSlots.length, pushLog]);

  const resetScrolls = useCallback(() => {
    setScrollSlots((prev) => { if (prev.length) pushLog("주문서 초기화"); return []; });
  }, [pushLog]);

  const scrollAdd = useMemo(() => {
    if (!series) return {} as Stats;
    let n = 0;
    for (const s of scrollSlots) if (s.ok) n += series.byPct[s.pct] ?? 0;
    return n ? ({ [series.stat]: n } as Stats) : ({} as Stats);
  }, [scrollSlots, series]);

  // ── ④ 사냥하기 ── ref가 권위값이라 연속 클릭에도 LEV가 정확히 누적된다
  const hunt = useCallback(() => {
    if (!canGrow || !growTable) return;
    const g = growthRef.current;
    if (g.level >= MAX_GROW_LEVEL) return;
    let e = g.exp + huntExp();
    let lv = g.level;
    let add: Stats = {};
    while (e >= EXP_PER_LEVEL && lv < MAX_GROW_LEVEL) {
      e -= EXP_PER_LEVEL;
      lv += 1;
      add = mergeStats(add, rollGrowth(growTable));
    }
    const nextExp = lv >= MAX_GROW_LEVEL ? 0 : e;
    growthRef.current = { level: lv, exp: nextExp };
    setLevel(lv);
    setExp(nextExp);
    if (lv > g.level) {
      setGrowAdd((prev) => mergeStats(prev, add));
      const addTxt = orderedStatEntries(add).map(([k, v]) => `${STAT_LABEL[k]}+${v}`).join(", ");
      pushLog(`🔺 레벨업! LEV ${lv}${lv >= MAX_GROW_LEVEL ? "(MAX)" : ""}${addTxt ? ` · 성장 ${addTxt}` : ""}`);
    }
  }, [canGrow, growTable, pushLog]);

  // 최종 스탯 = 기본 + 보석 + 편차 + 주문서 + 성장
  const finalStats = useMemo(
    () => mergeStats(item?.base ?? {}, gemAdd, deviation, scrollAdd, growAdd),
    [item, gemAdd, deviation, scrollAdd, growAdd]
  );

  // ── 재료(사용 내역) — maker_data 에서 base 이름으로 매칭 ──
  const materials = useMemo(() => {
    if (!item || !makerData?.equipment) return [] as { name: string; qty: number }[];
    const baseName = item.nameKr.replace(/^(리버스|타임리스)\s*/, "").trim();
    const grade = item.nameKr.startsWith("타임리스") ? "timeless" : "reverse";
    const eq = makerData.equipment.find((e) => e.name === baseName);
    const g = grade === "timeless" ? eq?.timeless : eq?.reverse;
    return g?.materials ?? [];
  }, [item, makerData]);

  const scrollCounts = useMemo(() => {
    const c: Record<number, number> = { 10: 0, 60: 0, 100: 0 };
    for (const s of scrollSlots) c[s.pct] = (c[s.pct] ?? 0) + 1;
    return c;
  }, [scrollSlots]);

  // 사용 내역 라인 (아이템 1 + 재료 + 주문서)
  const ledger = useMemo(() => {
    const lines: { key: string; label: string; qty: number; icon?: string }[] = [];
    if (item) lines.push({ key: "item", label: "아이템", qty: 1, icon: item.iconUrl });
    for (const m of materials) lines.push({ key: `mat-${m.name}`, label: m.name, qty: m.qty });
    for (const pct of SCROLL_PCTS) {
      if (scrollCounts[pct]) lines.push({ key: `scr-${pct}`, label: `${pct}% 주문서`, qty: scrollCounts[pct], icon: scrollIconUrl(pct) });
    }
    return lines;
  }, [item, materials, scrollCounts]);

  const totalCost = useMemo(() => {
    return ledger.reduce((sum, l) => sum + (prices[l.key] ?? 0) * l.qty, 0);
  }, [ledger, prices]);

  const remainSlots = item ? item.slots - scrollSlots.length : 0;

  // 강화 요약 — 성공/실패, (+N) 표기, 등급 색상
  const scrollSuccess = useMemo(() => scrollSlots.filter((s) => s.ok).length, [scrollSlots]);
  const scrollFail = scrollSlots.length - scrollSuccess;
  const touched = crafted || scrollSlots.length > 0 || level > 0;
  const grade = useMemo(
    () => (item ? itemGrade(item.base, finalStats, touched) : null),
    [item, finalStats, touched]
  );

  // 키보드 단축키
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA")) return;
      if (e.code === "KeyT") { e.preventDefault(); doCraft(); }
      else if (e.code === "KeyG") { e.preventDefault(); hunt(); }
      else if (e.code === "KeyV") { e.preventDefault(); resetEnhance(); }
      else if (e.code === "KeyR") { e.preventDefault(); resetScrolls(); }
      else {
        const map: Record<string, number> = { KeyQ: 10, KeyW: 60, KeyE: 100 };
        if (map[e.code] != null) { e.preventDefault(); applyScroll(map[e.code]); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, doCraft, hunt, resetEnhance, applyScroll]);

  // 공유 링크(?showcase=ID)로 열렸으면 남의 결과 로드
  useEffect(() => {
    try {
      const id = new URLSearchParams(window.location.search).get("showcase");
      if (id) getEnhanceShowcase(Number(id)).then((d) => setShared(d.showcase)).catch(() => {});
    } catch { /* ignore */ }
  }, []);

  // 명예의전당 등록
  const registerShowcase = useCallback(() => {
    if (!item || !grade) return;
    if (!regNick.trim()) { setRegError("닉네임을 입력하세요"); return; }
    setRegBusy(true);
    setRegError("");
    registerEnhanceShowcase({
      nickname: regNick.trim(),
      item_id: item.id,
      item_name: item.nameKr,
      kind: item.kind,
      icon_url: item.iconUrl,
      base_stats: item.base,
      final_stats: finalStats,
      grade_key: grade.key,
      grade_name: grade.name,
      grade_sum: grade.sum,
      level,
      success_count: scrollSuccess,
      fail_count: scrollFail,
      scroll_detail: scrollSlots,
      gems: gemSel.map((id) => gems.find((g) => g.itemId === id)?.name).filter(Boolean),
      used_accel: useAccel,
      cost: totalCost,
    })
      .then((d) => { setSharedId(d.showcase.id); pushLog(`🏆 명예의전당 등록 (#${d.showcase.id})`); })
      .catch((e) => setRegError(String(e.message)))
      .finally(() => setRegBusy(false));
  }, [item, grade, regNick, finalStats, level, scrollSuccess, scrollFail, scrollSlots, gemSel, gems, useAccel, totalCost, pushLog]);

  const copyShareLink = useCallback(() => {
    if (sharedId == null) return;
    const url = `${window.location.origin}/maker?showcase=${sharedId}`;
    navigator.clipboard.writeText(url).then(() => { setShareCopied(true); setTimeout(() => setShareCopied(false), 1500); });
  }, [sharedId]);

  return (
    <div className="space-y-4">
      {shared && (
        <div className="pixel-panel p-4 border-maple">
          <div className="flex items-center justify-between mb-2">
            <span className="font-pixel text-sm text-maple">🔗 {shared.nickname}님의 강화 결과</span>
            <button onClick={() => setShared(null)} className="text-xs text-dim hover:text-maple">닫고 내가 강화하기 ✕</button>
          </div>
          <ShowcaseCard s={shared} />
        </div>
      )}

      <ItemSearchBar onPick={loadItem} />

      {!item ? (
        <div className="pixel-panel p-10 text-center text-dim text-sm">
          {loadingItem ? "불러오는 중..." : "리버스·타임리스 장비를 검색해 선택하세요. 메이커 제작 · 주문서 강화 · 성장까지 시뮬됩니다."}
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,17rem)_1fr] gap-4 items-start">
          {/* ── 좌측: 아이템 정보 카드 ── */}
          <div className="pixel-panel p-4 space-y-3">
            <p className={`font-pixel text-center ${grade ? GRADE_COLOR[grade.key] : "text-ink"}`}>
              {item.nameKr}{scrollSuccess > 0 && <span> (+{scrollSuccess})</span>}
            </p>
            {canGrow && (
              <p className="text-center text-[11px] font-pixel">
                <span className="text-maple">ITEM LEV {level >= MAX_GROW_LEVEL ? "MAX" : `${level} / ${MAX_GROW_LEVEL}`}</span>
              </p>
            )}
            <div className="flex justify-center">
              <div className="w-16 h-16 flex items-center justify-center border-2 border-edge bg-surface2">
                <img src={item.iconUrl} alt={item.nameKr} onError={hideImg} className="w-12 h-12 object-contain [image-rendering:pixelated]" />
              </div>
            </div>
            <div className="text-[11px] text-dim space-y-0.5">
              <div className="flex justify-between"><span>REQ LEV</span><span className="text-ink">{item.reqLevel}</span></div>
              {(["reqSTR", "reqDEX", "reqINT", "reqLUK"] as const).map((k) =>
                item.req[k] ? (
                  <div key={k} className="flex justify-between"><span>{k.replace("req", "REQ ")}</span><span className="text-ink">{item.req[k]}</span></div>
                ) : null
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 text-[11px] font-pixel py-1 border-y border-edge/50">
              {JOBS.map((j) => {
                const on = j === "초보자" ? false : item.jobReq.includes(j) || item.jobReq === "" || item.jobReq.includes("공용");
                return <span key={j} className={on ? "text-maple" : "text-dim/40"}>{j}</span>;
              })}
            </div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between"><span className="text-dim">장비분류</span><span>{item.kind}</span></div>
              {(Object.keys(finalStats) as StatKey[]).length > 0 && orderedStatEntries(finalStats).map(([k, v]) => {
                const b = item.base[k] ?? 0;
                const up = v - b;
                return (
                  <div key={k} className="flex justify-between">
                    <span className="text-dim">{STAT_LABEL[k]}</span>
                    <span className="font-mono">
                      <b className={up > 0 ? "text-maple" : ""}>+{v}</b>
                      {up !== 0 && <span className="text-[10px] text-dim ml-1">({b}{up >= 0 ? "+" : ""}{up})</span>}
                    </span>
                  </div>
                );
              })}
              {item.attackSpeed && <div className="flex justify-between"><span className="text-dim">공격속도</span><span>{item.attackSpeed}</span></div>}
              <div className="flex justify-between"><span className="text-dim">업그레이드</span><span>{remainSlots} / {item.slots}칸</span></div>
            </div>

            {/* 강화 요약 */}
            {touched && (
              <div className="pt-2 border-t border-edge/50 space-y-1.5 text-[11px]">
                {orderedStatEntries(gemAdd).length > 0 && (
                  <p className="text-center text-maple font-pixel">강화보석 옵션 부여 적용</p>
                )}
                <div className="flex items-center justify-center gap-2 font-mono">
                  <span className="text-red-400">10% {scrollCounts[10] ?? 0}</span>
                  <span className="text-dim">·</span>
                  <span className="text-orange-400">60% {scrollCounts[60] ?? 0}</span>
                  <span className="text-dim">·</span>
                  <span className="text-sky-400">100% {scrollCounts[100] ?? 0}</span>
                </div>
                <p className="text-center text-dim">
                  성공 <b className="text-green-500">{scrollSuccess}</b> / 실패 <b className="text-red-400">{scrollFail}</b>
                </p>
                {grade && (
                  <p className="text-center font-pixel">
                    <span className={GRADE_COLOR[grade.key]}>{grade.name}</span>
                    {grade.sum !== 0 && <span className="text-dim ml-1">{grade.sum > 0 ? "+" : ""}{grade.sum}</span>}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── 우측: 순번 섹션 ── */}
          <div className="space-y-4 min-w-0">
            {/* ① 메이커 제작 */}
            <section className="pixel-panel p-4">
              <SectionHead n="①" title="메이커 제작" />
              <div className="grid sm:grid-cols-3 gap-2 mt-3">
                {[0, 1, 2].map((i) => {
                  // 같은 보석 중복 금지 — 다른 슬롯이 고른 보석은 제외(자기 슬롯의 현재 선택은 유지)
                  const takenElsewhere = new Set(gemSel.filter((v, j) => j !== i && v != null) as number[]);
                  const avail = gems.filter((g) => g.itemId === gemSel[i] || !takenElsewhere.has(g.itemId));
                  return (
                    <GemSelect key={i} gems={avail} value={gemSel[i]} onChange={(v) => setGemSel((prev) => prev.map((x, j) => (j === i ? v : x)))} />
                  );
                })}
              </div>
              <label className="flex items-center gap-2 mt-3 text-xs text-dim cursor-pointer">
                <input type="checkbox" checked={useAccel} onChange={(e) => setUseAccel(e.target.checked)} className="accent-maple" />
                촉진제 사용 · <b className="text-ink">{item.kind} 제작의 촉진제</b> — 편차 하옵 차단, 대가 10% 파괴
              </label>
              <button onClick={doCraft} className="w-full mt-3 py-2.5 pixel-btn font-pixel text-sm">제작하기 (T)</button>
              {destroyed && <p className="text-center text-red-400 text-xs font-pixel mt-2">💥 촉진제 제작 실패 — 재료 소멸</p>}
              {crafted && !destroyed && <p className="text-center text-maple text-xs font-pixel mt-2">✅ 제작 완료</p>}
            </section>

            {/* ② 아이템 옵션(편차) */}
            <section className="pixel-panel p-4">
              <SectionHead n="②" title="아이템 옵션" right={crafted ? undefined : "제작 후 표시"} />
              {crafted ? (
                <div className="mt-2 text-sm">
                  {(() => {
                    const devEntries = (Object.keys(deviation) as StatKey[]).filter((k) => (deviation[k] ?? 0) !== 0);
                    if (!devEntries.length) return <p className="text-ink">정옵 <span className="text-dim text-xs">(편차 없음)</span></p>;
                    return (
                      <div className="flex flex-wrap gap-2">
                        {devEntries.map((k) => {
                          const d = deviation[k] as number;
                          return (
                            <span key={k} className={`px-2 py-1 border-2 text-xs ${d > 0 ? "border-maple text-maple" : "border-red-400 text-red-400"}`}>
                              {STAT_LABEL[k]} {d > 0 ? "+" : ""}{d}{d > 0 ? "상" : "하"}
                            </span>
                          );
                        })}
                      </div>
                    );
                  })()}
                  <p className="text-[11px] text-dim mt-2">편차 폭 = min(⌊기본/10⌋+1, 5). 촉진제 시 하옵이 정옵으로 흡수됩니다.</p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-dim">제작하면 스탯별 편차(정옵·상옵·하옵)가 굴려집니다.</p>
              )}
            </section>

            {/* ③ 주문서 강화 */}
            <section className="pixel-panel p-4">
              <SectionHead n="③" title="주문서 강화" right={`남은 횟수 ${remainSlots} / ${item.slots}`} />
              {seriesList.length > 1 && (
                <select value={series?.id} onChange={(e) => { setSeriesId(e.target.value); }} className="pixel-input px-3 py-2 text-sm mt-3">
                  {seriesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              {seriesList.length === 1 && <p className="text-xs text-dim mt-3">{series?.name}</p>}
              <div className="grid grid-cols-4 gap-2 mt-3">
                {SCROLL_PCTS.map((pct) => {
                  const th = PCT_THEME[pct];
                  const val = series?.byPct[pct] ?? 0;
                  return (
                    <button
                      key={pct}
                      onClick={() => applyScroll(pct)}
                      disabled={remainSlots <= 0}
                      className={`flex flex-col items-center gap-1 py-3 border-2 transition-colors disabled:opacity-40 ${th.ring} hover:${th.bg}`}
                    >
                      <img src={scrollIconUrl(pct)} alt="" onError={hideImg} className="w-8 h-8 object-contain [image-rendering:pixelated]" />
                      <span className={`font-pixel text-xs ${th.text}`}>{PCT_KEY[pct]}</span>
                      <span className="font-pixel text-sm text-ink">{pct}%</span>
                      {series && <span className="text-[10px] text-dim">{STAT_LABEL[series.stat]} +{val}</span>}
                    </button>
                  );
                })}
                <button onClick={resetScrolls} className="flex flex-col items-center justify-center gap-1 py-3 border-2 border-edge text-dim hover:text-maple hover:border-maple transition-colors">
                  <span className="text-lg">↺</span>
                  <span className="font-pixel text-xs">R</span>
                  <span className="font-pixel text-xs">초기화</span>
                </button>
              </div>
              {/* 슬롯 표시 */}
              {item.slots > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {Array.from({ length: item.slots }).map((_, i) => {
                    const s = scrollSlots[i];
                    return (
                      <div key={i} className={`w-9 h-9 flex items-center justify-center border-2 text-xs font-pixel ${
                        !s ? "border-edge text-dim/50" : s.ok ? "border-green-400 bg-green-500/10 text-green-500" : "border-red-400 bg-red-500/10 text-red-400"
                      }`}>
                        {!s ? i + 1 : s.ok ? "✔" : "✕"}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ④ 성장 */}
            <section className="pixel-panel p-4">
              <SectionHead
                n="④"
                title="성장"
                badge={canGrow ? `LEV ${level} / ${MAX_GROW_LEVEL}` : undefined}
                right={canGrow ? `리버스·타임리스 · 레벨업 ${MAX_GROW_LEVEL}회` : undefined}
              />
              {canGrow ? (
                <div className="mt-3">
                  <div className="h-2 bg-surface2 border border-edge overflow-hidden">
                    <div className="h-full bg-maple transition-[width] duration-200" style={{ width: `${level >= MAX_GROW_LEVEL ? 100 : (exp / EXP_PER_LEVEL) * 100}%` }} />
                  </div>
                  <p className="text-xs text-dim mt-1">{level >= MAX_GROW_LEVEL ? "MAX 도달" : `${exp} / ${EXP_PER_LEVEL}`}</p>
                  <button onClick={hunt} disabled={level >= MAX_GROW_LEVEL} className="w-full mt-2 py-2.5 pixel-btn font-pixel text-sm disabled:opacity-40">
                    {level >= MAX_GROW_LEVEL ? "성장 완료" : "사냥하기 (G)"}
                  </button>
                  {orderedStatEntries(growAdd).length > 0 && (
                    <p className="text-[11px] text-maple mt-2">누적 성장: {statText(growAdd)}</p>
                  )}
                  <p className="text-[11px] text-dim mt-1">※ 사냥당 경험치는 체험용 더미값입니다</p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-dim">이 장비는 성장(레벨업) 대상이 아닙니다. (리버스·타임리스만 성장)</p>
              )}
            </section>

            {/* ⑤ 사용 내역 */}
            <section className="pixel-panel p-4">
              <SectionHead n="⑤" title="사용 내역" right="누적 개수 × 단가 = 비용" />
              <div className="mt-3 space-y-1.5">
                {ledger.map((l) => (
                  <div key={l.key} className="flex items-center gap-2 text-sm">
                    <div className="w-7 h-7 flex items-center justify-center border border-edge bg-surface2 shrink-0">
                      {l.icon ? <img src={l.icon} alt="" onError={hideImg} className="w-5 h-5 object-contain [image-rendering:pixelated]" /> : <span className="text-[10px] text-dim">?</span>}
                    </div>
                    <span className="flex-1 min-w-0 truncate text-ink">{l.label}</span>
                    <span className="text-dim text-xs shrink-0">× {l.qty}</span>
                    <input
                      type="number" min={0} placeholder="단가"
                      value={prices[l.key] ?? ""}
                      onChange={(e) => setPrices((p) => ({ ...p, [l.key]: Math.max(0, Number(e.target.value) || 0) }))}
                      className="pixel-input px-2 py-1 text-xs w-24 text-right"
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-edge/60">
                <button onClick={() => resetEnhance()} className="px-3 py-1.5 text-xs font-pixel border-2 border-edge text-dim hover:text-maple transition-colors">전체 리셋 (V)</button>
                <span className="font-pixel text-sm">합계 <b className="text-maple">{totalCost.toLocaleString("ko-KR")}</b> 메소</span>
              </div>
            </section>

            {/* 행동 로그 */}
            <section className="pixel-panel p-4">
              <div className="flex items-center gap-2">
                <h3 className="font-pixel text-sm text-ink flex items-center gap-2"><span className="text-maple">⑥</span> 행동 로그</h3>
                {log.length > 0 && (
                  <button onClick={() => setLog([])} className="ml-auto text-[11px] text-dim hover:text-maple">지우기</button>
                )}
              </div>
              {log.length === 0 ? (
                <p className="mt-2 text-xs text-dim">제작·주문서·성장 기록이 여기에 순서대로 쌓입니다.</p>
              ) : (
                <div className="mt-3 max-h-56 overflow-y-auto space-y-1 pr-1">
                  {log.map((l, i) => (
                    <div key={`${l.at}-${i}`} className={`flex gap-2 text-xs ${i === 0 ? "text-ink" : "text-dim"}`}>
                      <span className="font-mono text-dim shrink-0">
                        {new Date(l.at).toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                      <span className="min-w-0">{l.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 명예의전당 등록·공유 */}
            <section className="pixel-panel p-4">
              <h3 className="font-pixel text-sm text-ink flex items-center gap-2"><span className="text-maple">🏆</span> 명예의전당</h3>
              {!touched ? (
                <p className="mt-2 text-xs text-dim">강화를 진행하면 결과를 명예의전당에 등록하고 공유 링크를 받을 수 있습니다.</p>
              ) : sharedId != null ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-maple font-pixel">✅ 등록 완료 (#{sharedId})</span>
                  <button onClick={copyShareLink} className="pixel-btn px-3 py-1.5 text-xs">{shareCopied ? "복사됨!" : "🔗 공유 링크 복사"}</button>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="text" value={regNick} maxLength={16}
                    onChange={(e) => setRegNick(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) registerShowcase(); }}
                    placeholder="닉네임"
                    className="pixel-input px-3 py-2 text-sm w-32"
                  />
                  <button onClick={registerShowcase} disabled={regBusy} className="pixel-btn px-4 py-2 text-sm font-pixel disabled:opacity-50">
                    {regBusy ? "등록중..." : "명예의전당에 등록"}
                  </button>
                  {grade && <span className={`text-xs font-pixel ${GRADE_COLOR[grade.key]}`}>{grade.name}{grade.sum > 0 ? ` +${grade.sum}` : ""}</span>}
                </div>
              )}
              {regError && <p className="text-xs text-red-500 mt-2">{regError}</p>}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHead({ n, title, badge, right }: { n: string; title: string; badge?: string; right?: string }) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="font-pixel text-sm text-ink flex items-center gap-2">
        <span className="text-maple">{n}</span> {title}
        {badge && <span className="text-[11px] px-1.5 py-0.5 border border-maple text-maple">{badge}</span>}
      </h3>
      {right && <span className="ml-auto text-[11px] text-dim">{right}</span>}
    </div>
  );
}

function GemSelect({ gems, value, onChange }: { gems: Gem[]; value: number | null; onChange: (v: number | null) => void }) {
  const sel = gems.find((g) => g.itemId === value) ?? null;
  return (
    <div className="flex items-center gap-1.5 pixel-input px-2 py-1.5">
      <div className="w-6 h-6 flex items-center justify-center shrink-0">
        {sel ? <img src={gemIconUrl(sel.itemId)} alt="" onError={hideImg} className="w-5 h-5 object-contain [image-rendering:pixelated]" /> : <span className="text-dim text-xs">💎</span>}
      </div>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none"
      >
        <option value="">보석 없음</option>
        {gems.map((g) => (
          <option key={g.itemId} value={g.itemId}>{g.name} (+{g.amount})</option>
        ))}
      </select>
    </div>
  );
}

// ── 아이템 검색 바 ──
function ItemSearchBar({ onPick }: { onPick: (id: number, name: string, icon: string | null) => void }) {
  const [q, setQ] = useState("");
  const [sug, setSug] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const onChange = (v: string) => {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 1) { setSug([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      try {
        // 리버스·타임리스 장비만 — 넉넉히 받아 필터 후 상위 10개
        const d = await searchSuggest(v.trim(), 30, "item");
        const filtered = d.suggestions.filter(isReverseOrTimeless).slice(0, 10);
        setSug(filtered);
        setOpen(filtered.length > 0);
      } catch { setSug([]); }
    }, 250);
  };

  const POPULAR = [
    { id: 1472071, name: "리버스 람피온" },
    { id: 1402047, name: "리버스 니플하임" },
    { id: 1432049, name: "리버스 알슈피스" },
  ];

  return (
    <div ref={box} className="relative">
      <input
        value={q}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => sug.length > 0 && setOpen(true)}
        placeholder="강화할 아이템 검색 — 리버스 니플하임, 자쿰의 투구..."
        className="pixel-input w-full px-4 py-3 text-sm"
      />
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <span className="text-[11px] text-dim">인기</span>
        {POPULAR.map((p) => (
          <button key={p.id} onClick={() => { setQ(p.name); setOpen(false); onPick(p.id, p.name, null); }}
            className="flex items-center gap-1 px-2 py-1 text-xs border-2 border-edge bg-surface2 hover:border-maple transition-colors">
            <img src={`/api/icon/item/${p.id}`} alt="" onError={hideImg} className="w-5 h-5 object-contain [image-rendering:pixelated]" />
            {p.name}
          </button>
        ))}
      </div>
      {open && sug.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 pixel-panel max-h-72 overflow-y-auto">
          {sug.map((s) => (
            <button key={s.entity_id} onClick={() => { setQ(s.name_kr || s.name); setOpen(false); onPick(s.entity_id, s.name_kr || s.name, s.icon_url); }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)] text-left transition-colors">
              {s.icon_url && <img src={`/api/icon/item/${s.entity_id}`} alt="" onError={hideImg} className="w-8 h-8 object-contain [image-rendering:pixelated] shrink-0" />}
              <span className="text-sm text-ink truncate">{s.name_kr || s.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
