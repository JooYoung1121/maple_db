"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { getItems } from "@/lib/api";
import type { Item } from "@/lib/types";

/* ── 무기 배율 테이블 — /nhit 엔방컷 계산기와 동일 (메이플랜드 공식 검증 완료) ── */
const WEAPON_MULTIPLIERS: Record<
  string,
  { maxMult: number; minMult: number; mainStat: "STR" | "DEX" | "LUK"; subStat: string; type: "melee" | "ranged" }
> = {
  "한손검":       { maxMult: 4.0, minMult: 4.0, mainStat: "STR", subStat: "DEX",     type: "melee"  },
  "두손검":       { maxMult: 4.6, minMult: 4.6, mainStat: "STR", subStat: "DEX",     type: "melee"  },
  "한손도끼/둔기": { maxMult: 4.4, minMult: 3.2, mainStat: "STR", subStat: "DEX",     type: "melee"  },
  "두손도끼/둔기": { maxMult: 4.8, minMult: 3.4, mainStat: "STR", subStat: "DEX",     type: "melee"  },
  "창":           { maxMult: 5.0, minMult: 3.0, mainStat: "STR", subStat: "DEX",     type: "melee"  },
  "폴암":         { maxMult: 5.0, minMult: 3.0, mainStat: "STR", subStat: "DEX",     type: "melee"  },
  "활":           { maxMult: 3.4, minMult: 3.4, mainStat: "DEX", subStat: "STR",     type: "ranged" },
  "석궁":         { maxMult: 3.6, minMult: 3.6, mainStat: "DEX", subStat: "STR",     type: "ranged" },
  "단검":         { maxMult: 3.6, minMult: 3.6, mainStat: "LUK", subStat: "STR+DEX", type: "melee"  },
  "아대/클로":    { maxMult: 3.6, minMult: 3.6, mainStat: "LUK", subStat: "STR+DEX", type: "melee"  },
  "너클":         { maxMult: 4.8, minMult: 4.8, mainStat: "STR", subStat: "DEX",     type: "melee"  },
  "건":           { maxMult: 3.6, minMult: 3.6, mainStat: "DEX", subStat: "STR",     type: "ranged" },
};

/* ── 무기 종류 (DB subcategory → 표기/배율 키) ── */
const WEAPON_TYPES: { sub: string; label: string; multKey: string | null; twoHanded: boolean }[] = [
  { sub: "One-Handed Sword", label: "한손검", multKey: "한손검", twoHanded: false },
  { sub: "Two-Handed Sword", label: "두손검", multKey: "두손검", twoHanded: true },
  { sub: "One-Handed Axe", label: "한손도끼", multKey: "한손도끼/둔기", twoHanded: false },
  { sub: "Two-Handed Axe", label: "두손도끼", multKey: "두손도끼/둔기", twoHanded: true },
  { sub: "One-Handed Blunt Weapon", label: "한손둔기", multKey: "한손도끼/둔기", twoHanded: false },
  { sub: "Two-Handed Blunt", label: "두손둔기", multKey: "두손도끼/둔기", twoHanded: true },
  { sub: "Spear", label: "창", multKey: "창", twoHanded: true },
  { sub: "Pole Arm", label: "폴암", multKey: "폴암", twoHanded: true },
  { sub: "Dagger", label: "단검", multKey: "단검", twoHanded: false },
  { sub: "Claw", label: "아대", multKey: "아대/클로", twoHanded: false },
  { sub: "Bow", label: "활", multKey: "활", twoHanded: true },
  { sub: "Crossbow", label: "석궁", multKey: "석궁", twoHanded: true },
  { sub: "Knuckle", label: "너클", multKey: "너클", twoHanded: true },
  { sub: "Gun", label: "건", multKey: "건", twoHanded: true },
  { sub: "Wand", label: "완드", multKey: null, twoHanded: false },
  { sub: "Staff", label: "스태프", multKey: null, twoHanded: true },
];

/* ── 방어구·장신구 슬롯 ── */
const ARMOR_SLOTS: { key: string; label: string; sub: string; icon: string }[] = [
  { key: "hat", label: "모자", sub: "Hat", icon: "🎩" },
  { key: "top", label: "상의", sub: "Top", icon: "👕" },
  { key: "bottom", label: "하의", sub: "Bottom", icon: "👖" },
  { key: "overall", label: "전신", sub: "Overall", icon: "🥋" },
  { key: "shoes", label: "신발", sub: "Shoes", icon: "👟" },
  { key: "glove", label: "장갑", sub: "Glove", icon: "🧤" },
  { key: "cape", label: "망토", sub: "Cape", icon: "🧣" },
  { key: "shield", label: "방패", sub: "Shield", icon: "🛡️" },
  { key: "earrings", label: "귀고리", sub: "Earrings", icon: "💎" },
  { key: "face", label: "얼굴장식", sub: "Face Accessory", icon: "😎" },
  { key: "eye", label: "눈장식", sub: "Eye Decoration", icon: "👓" },
  { key: "pendant", label: "펜던트", sub: "Pendant", icon: "📿" },
];

const JOBS = ["전사", "마법사", "궁수", "도적", "해적"] as const;
type Job = (typeof JOBS)[number];

const STAT_KEYS = ["STR", "DEX", "INT", "LUK"] as const;
type StatKey = (typeof STAT_KEYS)[number];

/* 장비 stats JSON 키 → 표기 */
const INC_LABELS: Record<string, string> = {
  incSTR: "힘", incDEX: "민첩", incINT: "지능", incLUK: "행운",
  incPAD: "공격력", incMAD: "마력", incPDD: "물리방어", incMDD: "마법방어",
  incACC: "명중", incEVA: "회피", incSpeed: "이동속도", incJump: "점프력",
  incMHP: "HP", incMMP: "MP",
};

interface EquippedItem {
  item: Item;
  stats: Record<string, number>;
}

type Equipped = Record<string, EquippedItem | null>; // key: "weapon" | armor slot key

const PRESET_KEY = "gear_sim_presets_v1";

function parseStats(item: Item): Record<string, number> {
  try {
    const raw = item.stats ? JSON.parse(item.stats) : {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) {
      const n = Number(v);
      if (!isNaN(n) && n !== 0) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

function statSummary(stats: Record<string, number>): string {
  return Object.entries(stats)
    .filter(([k]) => k.startsWith("inc"))
    .map(([k, v]) => `${INC_LABELS[k] ?? k}+${v}`)
    .join(" ");
}

function jobMatches(item: Item, job: Job): boolean {
  if (!item.job_req || item.job_req === "공용") return true;
  return item.job_req.includes(job);
}

/* ── 아이템 선택 패널 ── */
function ItemPicker({
  slotLabel, subcategory, job, level, onPick, onClose,
}: {
  slotLabel: string;
  subcategory: string;
  job: Job;
  level: number;
  onPick: (item: Item) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [jobOnly, setJobOnly] = useState(true);
  const [levelCap, setLevelCap] = useState(true);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      getItems({
        subcategory,
        q: q || undefined,
        level_max: levelCap ? level : undefined,
        per_page: 100,
        sort: "level_desc",
      })
        .then((d) => setResults(d.items))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, subcategory, level, levelCap]);

  const filtered = useMemo(
    () => (jobOnly ? results.filter((it) => jobMatches(it, job)) : results),
    [results, jobOnly, job]
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="pixel-panel w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-edge">
          <h3 className="font-pixel font-bold">{slotLabel} 선택</h3>
          <button onClick={onClose} className="text-dim hover:text-maple p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-4 py-3 border-b border-edge/60 space-y-2">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="아이템 이름 검색"
            className="w-full pixel-input px-3 py-2 text-sm"
            autoFocus
          />
          <div className="flex gap-3 text-xs text-dim">
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={jobOnly} onChange={(e) => setJobOnly(e.target.checked)} className="accent-maple" />
              내 직업({job}) + 공용만
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={levelCap} onChange={(e) => setLevelCap(e.target.checked)} className="accent-maple" />
              레벨 {level} 이하만
            </label>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-dim text-sm">검색 중...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-dim text-sm">결과 없음</div>
          ) : (
            filtered.map((it) => {
              const stats = parseStats(it);
              return (
                <button
                  key={it.id}
                  onClick={() => onPick(it)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)] border-b border-edge/40"
                >
                  {it.icon_url && <img src={it.icon_url} alt="" className="w-8 h-8 object-contain shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {it.name_kr || it.name}
                      <span className="text-dim font-normal ml-1.5 text-xs">Lv.{it.level_req}</span>
                    </p>
                    <p className="text-[11px] text-dim truncate">{statSummary(stats) || "옵션 없음"}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 메인 ── */
export default function GearSimPage() {
  const [job, setJob] = useState<Job>("전사");
  const [level, setLevel] = useState(70);
  const [baseStats, setBaseStats] = useState<Record<StatKey, number>>({ STR: 300, DEX: 60, INT: 4, LUK: 4 });
  const [bonus, setBonus] = useState({ atk: 0, matk: 0, STR: 0, DEX: 0, INT: 0, LUK: 0 }); // 작·버프 수동 보정
  const [mastery, setMastery] = useState(60); // 최소뎀용 마스터리 %
  const [weaponType, setWeaponType] = useState(WEAPON_TYPES[0]);
  const [equipped, setEquipped] = useState<Equipped>({});
  const [picker, setPicker] = useState<{ slotKey: string; slotLabel: string; sub: string } | null>(null);
  const [presets, setPresets] = useState<{ name: string; data: string }[]>([]);
  const [loaded, setLoaded] = useState(false);

  /* 저장/복원 */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("gear_sim_current_v1");
      if (raw) {
        const d = JSON.parse(raw);
        if (d.job) setJob(d.job);
        if (d.level) setLevel(d.level);
        if (d.baseStats) setBaseStats(d.baseStats);
        if (d.bonus) setBonus(d.bonus);
        if (d.mastery) setMastery(d.mastery);
        if (d.weaponTypeSub) {
          const wt = WEAPON_TYPES.find((w) => w.sub === d.weaponTypeSub);
          if (wt) setWeaponType(wt);
        }
        if (d.equipped) setEquipped(d.equipped);
      }
      const p = localStorage.getItem(PRESET_KEY);
      if (p) setPresets(JSON.parse(p));
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(
        "gear_sim_current_v1",
        JSON.stringify({ job, level, baseStats, bonus, mastery, weaponTypeSub: weaponType.sub, equipped })
      );
    } catch { /* ignore */ }
  }, [job, level, baseStats, bonus, mastery, weaponType, equipped, loaded]);

  /* 장착 (충돌 규칙: 전신↔상하의, 두손무기↔방패) */
  const equip = useCallback((slotKey: string, item: Item) => {
    setEquipped((prev) => {
      const next = { ...prev, [slotKey]: { item, stats: parseStats(item) } };
      if (slotKey === "overall") { next.top = null; next.bottom = null; }
      if (slotKey === "top" || slotKey === "bottom") next.overall = null;
      if (slotKey === "weapon" && weaponType.twoHanded) next.shield = null;
      return next;
    });
    setPicker(null);
  }, [weaponType]);

  const unequip = useCallback((slotKey: string) => {
    setEquipped((prev) => ({ ...prev, [slotKey]: null }));
  }, []);

  /* 무기 종류 변경 시 기존 무기 해제 */
  const changeWeaponType = useCallback((sub: string) => {
    const wt = WEAPON_TYPES.find((w) => w.sub === sub);
    if (!wt) return;
    setWeaponType(wt);
    setEquipped((prev) => ({ ...prev, weapon: null, ...(wt.twoHanded ? { shield: null } : {}) }));
  }, []);

  /* ── 합산 ── */
  const totals = useMemo(() => {
    const sum: Record<string, number> = {
      STR: baseStats.STR + bonus.STR, DEX: baseStats.DEX + bonus.DEX,
      INT: baseStats.INT + bonus.INT, LUK: baseStats.LUK + bonus.LUK,
      atk: bonus.atk, matk: bonus.matk,
      acc: 0, eva: 0, speed: 0, jump: 0, hp: 0, mp: 0, pdd: 0, mdd: 0,
    };
    const map: Record<string, string> = {
      incSTR: "STR", incDEX: "DEX", incINT: "INT", incLUK: "LUK",
      incPAD: "atk", incMAD: "matk", incACC: "acc", incEVA: "eva",
      incSpeed: "speed", incJump: "jump", incMHP: "hp", incMMP: "mp",
      incPDD: "pdd", incMDD: "mdd",
    };
    for (const eq of Object.values(equipped)) {
      if (!eq) continue;
      for (const [k, v] of Object.entries(eq.stats)) {
        const key = map[k];
        if (key) sum[key] += v;
      }
    }
    return sum;
  }, [baseStats, bonus, equipped]);

  /* ── 데미지 (nhit 공식, 스킬 100%·동레벨·방어 0 기준의 순수 지표) ── */
  const damage = useMemo(() => {
    const mult = weaponType.multKey ? WEAPON_MULTIPLIERS[weaponType.multKey] : null;
    if (!mult) return null; // 완드/스태프 — 마법뎀은 스킬 의존이라 표시하지 않음
    const main = totals[mult.mainStat];
    const sub = mult.subStat === "STR+DEX" ? totals.STR + totals.DEX : totals[mult.subStat];
    const atk = totals.atk;
    if (atk <= 0) return null;
    const maxDmg = (main * mult.maxMult + sub) * (atk / 100);
    const minDmg = (main * mult.minMult * 0.9 * (mastery / 100) + sub) * (atk / 100);
    return { maxDmg, minDmg };
  }, [totals, weaponType, mastery]);

  /* ── 요구조건 미달 체크 ── */
  const unmetSlots = useMemo(() => {
    const unmet: string[] = [];
    for (const [key, eq] of Object.entries(equipped)) {
      if (!eq) continue;
      const req = eq.stats;
      if (eq.item.level_req > level) { unmet.push(key); continue; }
      if (
        (req.reqSTR ?? 0) > totals.STR || (req.reqDEX ?? 0) > totals.DEX ||
        (req.reqINT ?? 0) > totals.INT || (req.reqLUK ?? 0) > totals.LUK
      ) unmet.push(key);
    }
    return unmet;
  }, [equipped, level, totals]);

  /* ── 프리셋 ── */
  const savePreset = useCallback(() => {
    const name = prompt("프리셋 이름을 입력하세요");
    if (!name?.trim()) return;
    const data = JSON.stringify({ job, level, baseStats, bonus, mastery, weaponTypeSub: weaponType.sub, equipped });
    setPresets((prev) => {
      const next = [...prev.filter((p) => p.name !== name.trim()), { name: name.trim(), data }];
      localStorage.setItem(PRESET_KEY, JSON.stringify(next));
      return next;
    });
  }, [job, level, baseStats, bonus, mastery, weaponType, equipped]);

  const loadPreset = useCallback((data: string) => {
    try {
      const d = JSON.parse(data);
      setJob(d.job); setLevel(d.level); setBaseStats(d.baseStats); setBonus(d.bonus);
      setMastery(d.mastery ?? 60);
      const wt = WEAPON_TYPES.find((w) => w.sub === d.weaponTypeSub);
      if (wt) setWeaponType(wt);
      setEquipped(d.equipped ?? {});
    } catch { /* ignore */ }
  }, []);

  const deletePreset = useCallback((name: string) => {
    setPresets((prev) => {
      const next = prev.filter((p) => p.name !== name);
      localStorage.setItem(PRESET_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  /* 슬롯 렌더 (무기 슬롯 + 방어구/장신구) */
  const allSlots: { key: string; label: string; sub: string; icon: string }[] = [
    { key: "weapon", label: `무기 (${weaponType.label})`, sub: weaponType.sub, icon: "⚔️" },
    ...ARMOR_SLOTS,
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-1 font-pixel">🧰 장비 세팅 시뮬레이터</h1>
      <p className="text-sm text-dim mb-6">
        장비를 조합해 스탯 합계와 기본 데미지를 확인하세요. 작(주문서) 결과는 아래 <span className="text-maple">추가 보정</span>에 합산 입력하면 됩니다.
        세팅은 브라우저에 저장됩니다.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── 좌: 캐릭터 설정 ── */}
        <div className="space-y-4">
          <div className="pixel-panel p-4">
            <h2 className="font-pixel font-bold text-sm mb-3">캐릭터</h2>
            <div className="flex flex-wrap gap-1 mb-3">
              {JOBS.map((j) => (
                <button
                  key={j}
                  onClick={() => setJob(j)}
                  className={`px-2.5 py-1.5 text-xs transition-colors ${job === j ? "pixel-btn" : "bg-surface2 font-pixel text-dim hover:text-maple"}`}
                >
                  {j}
                </button>
              ))}
            </div>
            <label className="block text-xs text-dim mb-1">레벨</label>
            <input
              type="number" min={1} max={200} value={level}
              onChange={(e) => setLevel(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              className="w-full pixel-input px-3 py-2 text-sm mb-3"
            />
            <label className="block text-xs text-dim mb-1">순수 스탯 (AP 분배 기준)</label>
            <div className="grid grid-cols-2 gap-2">
              {STAT_KEYS.map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="text-xs font-mono w-8 text-dim">{k}</span>
                  <input
                    type="number" min={0} value={baseStats[k]}
                    onChange={(e) => setBaseStats((p) => ({ ...p, [k]: Math.max(0, Number(e.target.value) || 0) }))}
                    className="w-full pixel-input px-2 py-1.5 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="pixel-panel p-4">
            <h2 className="font-pixel font-bold text-sm mb-1">추가 보정</h2>
            <p className="text-[11px] text-dim mb-3">작(주문서)·버프 등으로 붙는 수치를 합산해서 입력하세요</p>
            <div className="grid grid-cols-2 gap-2">
              {([["atk", "공격력 +"], ["matk", "마력 +"], ["STR", "힘 +"], ["DEX", "민첩 +"], ["INT", "지능 +"], ["LUK", "행운 +"]] as const).map(([k, label]) => (
                <div key={k}>
                  <label className="block text-[11px] text-dim mb-0.5">{label}</label>
                  <input
                    type="number" value={bonus[k]}
                    onChange={(e) => setBonus((p) => ({ ...p, [k]: Number(e.target.value) || 0 }))}
                    className="w-full pixel-input px-2 py-1.5 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 프리셋 */}
          <div className="pixel-panel p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-pixel font-bold text-sm">프리셋</h2>
              <button onClick={savePreset} className="pixel-btn px-2.5 py-1 text-xs">현재 세팅 저장</button>
            </div>
            {presets.length === 0 ? (
              <p className="text-xs text-dim">저장된 프리셋이 없습니다</p>
            ) : (
              <div className="space-y-1">
                {presets.map((p) => (
                  <div key={p.name} className="flex items-center gap-2">
                    <button onClick={() => loadPreset(p.data)} className="flex-1 text-left text-sm text-ink hover:text-maple truncate">
                      {p.name}
                    </button>
                    <button onClick={() => deletePreset(p.name)} className="text-dim hover:text-red-500 text-xs">삭제</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 중: 장비 슬롯 ── */}
        <div>
          <div className="pixel-panel p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-pixel font-bold text-sm">장비</h2>
              <select
                value={weaponType.sub}
                onChange={(e) => changeWeaponType(e.target.value)}
                className="pixel-input px-2 py-1 text-xs"
              >
                {WEAPON_TYPES.map((w) => (
                  <option key={w.sub} value={w.sub}>{w.label}{w.twoHanded ? " (두손)" : ""}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              {allSlots.map((slot) => {
                const eq = equipped[slot.key];
                const disabled =
                  (slot.key === "shield" && weaponType.twoHanded) ||
                  (slot.key === "overall" && (!!equipped.top || !!equipped.bottom)) ||
                  ((slot.key === "top" || slot.key === "bottom") && !!equipped.overall);
                const unmet = unmetSlots.includes(slot.key);
                return (
                  <div
                    key={slot.key}
                    className={`flex items-center gap-2 border-2 px-2.5 py-2 ${
                      unmet ? "border-red-400" : "border-edge"
                    } ${disabled ? "opacity-40" : ""}`}
                  >
                    <span className="text-base w-6 text-center shrink-0">{slot.icon}</span>
                    <div className="flex-1 min-w-0">
                      {eq ? (
                        <>
                          <p className="text-xs font-medium truncate flex items-center gap-1">
                            {eq.item.icon_url && <img src={eq.item.icon_url} alt="" className="w-5 h-5 object-contain inline" />}
                            {eq.item.name_kr || eq.item.name}
                            {unmet && <span className="text-red-500 text-[10px] font-pixel shrink-0">착용불가</span>}
                          </p>
                          <p className="text-[10px] text-dim truncate">{statSummary(eq.stats) || "옵션 없음"}</p>
                        </>
                      ) : (
                        <p className="text-xs text-dim">{slot.label}</p>
                      )}
                    </div>
                    <button
                      onClick={() => !disabled && setPicker({ slotKey: slot.key, slotLabel: slot.label, sub: slot.sub })}
                      disabled={disabled}
                      className="pixel-btn px-2 py-1 text-[11px] shrink-0 disabled:opacity-50"
                    >
                      {eq ? "교체" : "장착"}
                    </button>
                    {eq && (
                      <button onClick={() => unequip(slot.key)} className="text-dim hover:text-red-500 shrink-0" title="해제">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {weaponType.twoHanded && (
              <p className="text-[11px] text-dim mt-2">두손 무기 선택 중 — 방패 슬롯이 비활성화됩니다</p>
            )}
          </div>
        </div>

        {/* ── 우: 합계 + 데미지 ── */}
        <div className="space-y-4">
          <div className="pixel-panel p-4">
            <h2 className="font-pixel font-bold text-sm mb-3">스탯 합계 <span className="text-dim font-normal text-[11px]">(순수+장비+보정)</span></h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {([["STR", "힘"], ["DEX", "민첩"], ["INT", "지능"], ["LUK", "행운"]] as const).map(([k, label]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-dim">{label}</span>
                  <span className="font-mono font-medium">
                    {totals[k]}
                    {totals[k] !== baseStats[k as StatKey] && (
                      <span className="text-maple text-xs ml-1">({baseStats[k as StatKey]}+{totals[k] - baseStats[k as StatKey]})</span>
                    )}
                  </span>
                </div>
              ))}
              <div className="flex justify-between col-span-2 border-t border-edge/60 pt-1.5 mt-1">
                <span className="text-dim">공격력</span>
                <span className="font-mono font-bold text-maple">{totals.atk}</span>
              </div>
              <div className="flex justify-between col-span-2">
                <span className="text-dim">마력</span>
                <span className="font-mono font-bold text-blue-500">{totals.matk}</span>
              </div>
              {([["acc", "명중"], ["eva", "회피"], ["speed", "이동속도"], ["jump", "점프력"], ["pdd", "물리방어"], ["mdd", "마법방어"], ["hp", "HP"], ["mp", "MP"]] as const).map(([k, label]) =>
                totals[k] !== 0 ? (
                  <div key={k} className="flex justify-between">
                    <span className="text-dim">{label}</span>
                    <span className="font-mono">{totals[k] > 0 ? `+${totals[k]}` : totals[k]}</span>
                  </div>
                ) : null
              )}
            </div>
          </div>

          <div className="pixel-panel p-4">
            <h2 className="font-pixel font-bold text-sm mb-1">기본 데미지</h2>
            <p className="text-[11px] text-dim mb-3">스킬 100%·동레벨·몹 방어 0 기준 평타 지표 — 실전 계산은 <Link href="/nhit" className="text-maple hover:underline">엔방컷 계산기</Link></p>
            {damage ? (
              <>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-dim">최대 데미지</span>
                  <span className="font-mono font-bold text-maple">{Math.floor(damage.maxDmg).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-dim">최소 데미지</span>
                  <span className="font-mono">{Math.floor(damage.minDmg).toLocaleString()}</span>
                </div>
                <label className="block text-[11px] text-dim mb-1">마스터리 (최소뎀 계산용): {mastery}%</label>
                <input
                  type="range" min={10} max={90} step={5} value={mastery}
                  onChange={(e) => setMastery(Number(e.target.value))}
                  className="w-full accent-maple"
                />
              </>
            ) : weaponType.multKey === null ? (
              <p className="text-sm text-dim">
                완드/스태프의 마법 데미지는 스킬(속성·숙련도)에 크게 의존해 여기서는 표시하지 않습니다.
                총 마력 <span className="font-mono font-bold text-blue-500">{totals.matk}</span> 기준으로{" "}
                <Link href="/nhit" className="text-maple hover:underline">엔방컷 계산기</Link>에서 스킬별로 확인하세요.
              </p>
            ) : (
              <p className="text-sm text-dim">무기를 장착하거나 추가 보정에 공격력을 입력하면 계산됩니다.</p>
            )}
          </div>

          {unmetSlots.length > 0 && (
            <div className="border-2 border-red-400 bg-red-50 dark:bg-red-950/30 p-3">
              <p className="text-xs text-red-600 dark:text-red-400">
                ⚠ 착용 조건(레벨/스탯) 미달 장비가 {unmetSlots.length}개 있습니다. 빨간 테두리 슬롯을 확인하세요.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 참고 */}
      <div className="pixel-panel p-5 mt-6">
        <h2 className="font-bold mb-3 font-pixel">참고사항</h2>
        <ul className="space-y-1.5">
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            데미지 공식과 무기 배율은 엔방컷 계산기와 동일한 값(메이플랜드 실측 검증)을 사용합니다.
          </li>
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            아이템 옵션은 기본(무작) 수치입니다. 작 결과는 좌측 &quot;추가 보정&quot;에 합산해서 입력하세요.
          </li>
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            착용 조건 체크는 합계 스탯(장비 포함) 기준의 근사치로, 실제 게임의 착용 순서에 따른 차이는 반영하지 않습니다.
          </li>
        </ul>
      </div>

      {picker && (
        <ItemPicker
          slotLabel={picker.slotLabel}
          subcategory={picker.sub}
          job={job}
          level={level}
          onPick={(item) => equip(picker.slotKey, item)}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
