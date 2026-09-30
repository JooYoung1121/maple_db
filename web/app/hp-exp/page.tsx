"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  WEAPON_MULTIPLIERS,
  calcPhysicalDamage,
  calcMagicDamage,
  physicalHitChance,
  magicHitChance,
  type DamageResult,
} from "@/lib/damageFormula";
import { JOB_SKILL_DATA, JOB_GROUPS } from "@/lib/jobSkillData";
import { readMyMapleProfile } from "@/lib/myMaple";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface EffMob {
  id: number;
  name_kr: string | null;
  level: number;
  hp: number;
  exp: number;
  ratio: number;
  wdef: number;
  mdef: number;
  avoid: number;
  undead: number;
  map_count: number;
  total_spawns: number | null;
  spawns_estimated?: boolean;
  count?: number | null;
}

interface EffMap {
  map_id: number;
  name_kr: string | null;
  street_name: string | null;
  mobs: EffMob[];
  total_count: number | null;
  out_of_range_count: number;
  weighted_ratio: number | null;
  exp_per_gen: number | null;
  mob_rate: number | null;
  floors: number | null;
  width: number | null;
  estimated: boolean;
  variant_count?: number;
}

interface EffResponse {
  min_level: number;
  max_level: number;
  mobs: EffMob[];
  maps: EffMap[];
  total_maps: number;
  total_mobs: number;
}

// ─── 내 캐릭터 입력 (localStorage 유지) ───
// 직업을 고르면 무기·숙련도·스킬 목록이 자동 세팅되고, 스펙(스탯·공/마력·명중)만 채우면 된다.
const BASIC_ATTACK = "평타";

interface CharState {
  enabled: boolean;
  job: string; // JOB_SKILL_DATA 키 (히어로, 비숍 등 12직업)
  weapon: string; // 직업 무기 중 선택
  skill: string; // BASIC_ATTACK 또는 직업 액티브 스킬명
  mainStat: number;
  subStat: number;
  atk: number;
  mastery: number; // % — 직업 선택 시 자동, 수정 가능
  int: number;
  luk: number;
  ma: number;
  acc: number; // 물리 명중률 스탯
}

const CHAR_STORAGE_KEY = "hp_exp_char_v2";

const DEFAULT_CHAR: CharState = {
  enabled: false,
  job: "히어로",
  weapon: "두손검",
  skill: BASIC_ATTACK,
  mainStat: 100,
  subStat: 25,
  atk: 60,
  mastery: 60,
  int: 100,
  luk: 25,
  ma: 100,
  acc: 60,
};

function jobMastery(job: string): number {
  const data = JOB_SKILL_DATA[job];
  if (!data) return 60;
  return Math.max(...data.passives.map((p) => p.mastery ?? 0), 50);
}

/** 마이 프로필의 직업(계열/세부)을 JOB_SKILL_DATA 키로 매칭 */
function matchProfileJob(job: string, subJob: string): string | null {
  if (subJob) {
    if (JOB_SKILL_DATA[subJob]) return subJob;
    const partial = Object.keys(JOB_SKILL_DATA).find(
      (k) => k.includes(subJob) || subJob.includes(k),
    );
    if (partial) return partial;
  }
  return JOB_GROUPS[job]?.[0] ?? null;
}

function readChar(): CharState {
  if (typeof window === "undefined") return DEFAULT_CHAR;
  try {
    const raw = window.localStorage.getItem(CHAR_STORAGE_KEY);
    const parsed = raw ? { ...DEFAULT_CHAR, ...JSON.parse(raw) } : DEFAULT_CHAR;
    if (!JOB_SKILL_DATA[parsed.job]) parsed.job = DEFAULT_CHAR.job;
    return parsed;
  } catch {
    return DEFAULT_CHAR;
  }
}

interface MobCombat {
  avgDmg: number;
  nHitAvg: number; // 평균 데미지 기준 N방컷
  hitChance: number; // 0~1
  expectedAttacks: number; // 미스 포함 기대 타수
  expPerAttack: number; // 타수당 경험치
}

function calcMobCombat(mob: EffMob, char: CharState, charLevel: number): MobCombat | null {
  const jobData = JOB_SKILL_DATA[char.job];
  if (!jobData) return null;
  const active = jobData.actives.find((s) => s.name === char.skill);
  const skillPct = active ? active.damage : 100;
  const hits = active ? active.hits : 1;

  let dmg: DamageResult;
  let hit: number;
  if (jobData.isMagic) {
    if (char.ma <= 0) return null;
    dmg = calcMagicDamage(
      char.int, char.luk, char.ma, skillPct, 1,
      hits, charLevel, mob.level, mob.mdef,
    );
    hit = magicHitChance(char.int, char.luk, mob.avoid, charLevel, mob.level);
  } else {
    const mult = WEAPON_MULTIPLIERS[char.weapon];
    if (!mult || char.atk <= 0) return null;
    dmg = calcPhysicalDamage(
      char.mainStat, char.subStat, char.atk, mult.maxMult, mult.minMult,
      char.mastery / 100, skillPct, hits, charLevel, mob.level, mob.wdef,
    );
    hit = physicalHitChance(char.acc, mob.avoid, charLevel, mob.level);
  }
  if (dmg.avgDmg <= 0) return null;
  const nHitAvg = Math.ceil(mob.hp / dmg.avgDmg);
  // 명중률 0 = 필요명중의 절반 이하 → 전부 미스, 사냥 불가
  const expectedAttacks = hit > 0 ? nHitAvg / hit : Infinity;
  return {
    avgDmg: dmg.avgDmg,
    nHitAvg,
    hitChance: hit,
    expectedAttacks,
    expPerAttack: hit > 0 ? mob.exp / expectedAttacks : 0,
  };
}

function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

function hideOnError(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.visibility = "hidden";
}

// 체경비 등급 색 — 낮을수록 꿀
function ratioClass(r: number | null): string {
  if (r === null) return "text-dim";
  if (r <= 20) return "text-emerald-600 dark:text-emerald-400";
  if (r <= 35) return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

function ratioLabel(r: number | null): string {
  if (r === null) return "-";
  if (r <= 20) return "꿀";
  if (r <= 35) return "보통";
  return "빡셈";
}

function hitClass(hit: number): string {
  if (hit >= 0.95) return "text-emerald-600 dark:text-emerald-400";
  if (hit >= 0.7) return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

// 스폰 분포 요약 — 층수·가로폭으로 지형 성격 추정
function terrainSummary(floors: number | null, width: number | null): string | null {
  if (floors === null || width === null) return null;
  if (floors <= 2 && width >= 900) return "일자형";
  if (floors >= 8) return "복층";
  return `${floors}층`;
}

// 지형 기반 직업 적합 힌트 — 스킬 범위·이동기까지 계산하진 못하므로 참고 배지만 제공
function terrainHint(floors: number | null, width: number | null): string | null {
  if (floors === null || width === null) return null;
  if (floors <= 2 && width >= 900) return "근접 동선 편함";
  if (floors >= 5) return "원거리·텔레포트 유리";
  return null;
}

function NumField({
  label, value, onChange, width = "w-20",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  width?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-dim">{label}</span>
      <input
        type="number"
        value={value}
        min={0}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className={`${width} rounded border border-edge bg-surface px-2 py-1.5 text-sm text-ink`}
      />
    </label>
  );
}

export default function HpExpPage() {
  const [level, setLevel] = useState<number | "">("");
  const [range, setRange] = useState(10);
  const [sort, setSort] = useState<"ratio" | "exp">("ratio");
  const [minCount, setMinCount] = useState(3);
  const [tab, setTab] = useState<"maps" | "mobs">("maps");
  const [data, setData] = useState<EffResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [char, setChar] = useState<CharState>(DEFAULT_CHAR);
  const [charLoaded, setCharLoaded] = useState(false);
  const [mySort, setMySort] = useState(false); // 내 캐릭터 효율(타수당 경험치)순

  useEffect(() => {
    const saved =
      typeof window !== "undefined" && !!window.localStorage.getItem(CHAR_STORAGE_KEY);
    const base = readChar();
    const profile = readMyMapleProfile();
    if (!saved) {
      // 저장된 캐릭터가 없으면 마이 프로필의 직업으로 초기 세팅
      const job = matchProfileJob(profile.job, profile.subJob);
      if (job && JOB_SKILL_DATA[job]) {
        base.job = job;
        base.weapon = JOB_SKILL_DATA[job].weapons[0];
        base.mastery = jobMastery(job);
      }
    }
    setChar(base);
    if (profile.level > 1) setLevel((prev) => (prev === "" ? profile.level : prev));
    setCharLoaded(true);
  }, []);

  useEffect(() => {
    if (!charLoaded || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CHAR_STORAGE_KEY, JSON.stringify(char));
    } catch {
      /* 저장 실패는 무시 — 입력 자체는 동작 */
    }
  }, [char, charLoaded]);

  const patchChar = (patch: Partial<CharState>) => setChar((c) => ({ ...c, ...patch }));

  // 직업 변경 시 무기·숙련도·스킬을 그 직업 기준으로 재세팅
  const changeJob = (job: string) => {
    const data = JOB_SKILL_DATA[job];
    if (!data) return;
    setChar((c) => ({
      ...c,
      job,
      weapon: data.weapons.includes(c.weapon) ? c.weapon : data.weapons[0],
      skill: BASIC_ATTACK,
      mastery: jobMastery(job),
    }));
  };

  const [minLv, maxLv] = useMemo(() => {
    if (level === "" || !Number.isFinite(Number(level))) return [1, 200];
    const lv = Number(level);
    return [Math.max(1, lv - range), Math.min(200, lv + range)];
  }, [level, range]);

  useEffect(() => {
    // 캐릭터 레벨이 없으면 추천을 만들지 않는다 — 입력(또는 프로필 로드)이 선행 조건
    if (level === "") {
      setData(null);
      setLoading(false);
      setError(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(false);
    const qs = new URLSearchParams({
      min_level: String(minLv),
      max_level: String(maxLv),
      sort,
      min_count: String(minCount),
    });
    fetch(`${API_BASE}/api/efficiency?${qs}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: EffResponse) => {
        if (alive) setData(d);
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [level, minLv, maxLv, sort, minCount]);

  // 내 캐릭터 계산 활성 조건: 토글 on + 레벨 입력
  const charActive = char.enabled && level !== "";
  const charLevel = level === "" ? 0 : Number(level);

  const combatByMob = useMemo(() => {
    if (!charActive || !data) return new Map<number, MobCombat>();
    const out = new Map<number, MobCombat>();
    const seen = new Map<number, EffMob>();
    for (const mob of data.mobs) seen.set(mob.id, mob);
    for (const m of data.maps) for (const mob of m.mobs) if (!seen.has(mob.id)) seen.set(mob.id, mob);
    for (const [id, mob] of seen) {
      const c = calcMobCombat(mob, char, charLevel);
      if (c) out.set(id, c);
    }
    return out;
  }, [charActive, data, char, charLevel]);

  // 맵별 내 캐릭터 효율: 젠 가중 타수당 경험치 = Σ(count×exp) ÷ Σ(count×기대타수)
  const mapScore = useMemo(() => {
    const out = new Map<number, number>();
    if (!charActive || !data) return out;
    for (const m of data.maps) {
      let totalExp = 0;
      let totalAttacks = 0;
      let covered = false;
      for (const mob of m.mobs) {
        const c = combatByMob.get(mob.id);
        const cnt = mob.count ?? 0;
        // 명중 불가 몹은 사냥 대상에서 제외하고 나머지로 효율을 낸다
        if (!c || !cnt || c.hitChance <= 0) continue;
        covered = true;
        totalExp += mob.exp * cnt;
        totalAttacks += c.expectedAttacks * cnt;
      }
      if (covered && totalAttacks > 0) out.set(m.map_id, totalExp / totalAttacks);
    }
    return out;
  }, [charActive, data, combatByMob]);

  const sortedMobs = useMemo(() => {
    if (!data) return [];
    if (!charActive || !mySort) return data.mobs;
    return [...data.mobs].sort((a, b) => {
      const ca = combatByMob.get(a.id)?.expPerAttack ?? -1;
      const cb = combatByMob.get(b.id)?.expPerAttack ?? -1;
      return cb - ca;
    });
  }, [data, charActive, mySort, combatByMob]);

  const sortedMaps = useMemo(() => {
    if (!data) return [];
    if (!charActive || !mySort) return data.maps;
    return [...data.maps].sort((a, b) => {
      const sa = mapScore.get(a.map_id) ?? -1;
      const sb = mapScore.get(b.map_id) ?? -1;
      return sb - sa;
    });
  }, [data, charActive, mySort, mapScore]);

  const jobData = JOB_SKILL_DATA[char.job];
  const weaponMult = jobData && !jobData.isMagic ? WEAPON_MULTIPLIERS[char.weapon] : null;
  const activeSkill = jobData?.actives.find((s) => s.name === char.skill);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="font-pixel text-2xl font-bold text-ink">체경비 사냥터</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-dim">
          체경비 = 몹 체력 ÷ 경험치. <span className="font-semibold text-ink">경험치 1을 얻기 위해 깎아야 하는 체력</span>이라
          낮을수록 꿀입니다. 맵별 몹 마릿수·배치(스폰 데이터)와 조합해 어디로 가면 좋을지 추천하고,
          내 캐릭터를 입력하면 <span className="font-semibold text-ink">N방컷·명중률·타수당 경험치</span>까지 계산합니다.
        </p>
      </header>

      {level === "" && (
        <section className="pixel-panel p-6 sm:p-8">
          <h2 className="font-pixel text-lg font-bold text-ink">🍄 내 캐릭터부터 알려주세요</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-dim">
            체경비 사냥터는 <span className="font-semibold text-ink">캐릭터 레벨·직업 기준 맞춤 추천</span> 페이지예요.
            레벨을 입력하면 그 레벨대 사냥터·몬스터가 나오고, 스펙까지 입력하면 N방컷·명중률·타수당
            경험치로 &quot;내 효율순&quot; 추천까지 계산합니다.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-dim">내 레벨</span>
              <input
                type="number"
                min={1}
                max={200}
                value={level}
                placeholder="예: 45"
                autoFocus
                onChange={(e) => {
                  const v = e.target.value;
                  setLevel(v === "" ? "" : Math.max(1, Math.min(200, Number(v))));
                }}
                className="w-28 rounded border border-edge bg-surface px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-dim">직업</span>
              <select
                value={char.job}
                onChange={(e) => changeJob(e.target.value)}
                className="rounded border border-edge bg-surface px-2 py-2 text-sm text-ink"
              >
                {Object.entries(JOB_GROUPS).map(([group, jobs]) => (
                  <optgroup key={group} label={group}>
                    {jobs.map((j) => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-3 text-xs text-dim">
            <Link href="/me" className="text-maple hover:underline">마이페이지</Link>에 캐릭터 프로필(레벨·직업)을
            저장해두면 다음부터 자동으로 불러옵니다.
          </p>
        </section>
      )}

      {level !== "" && (
        <>
      <section className="pixel-panel p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="mb-1 block text-xs text-dim">내 레벨</span>
            <input
              type="number"
              min={1}
              max={200}
              value={level}
              placeholder="레벨"
              onChange={(e) => {
                const v = e.target.value;
                setLevel(v === "" ? "" : Math.max(1, Math.min(200, Number(v))));
              }}
              className="w-24 rounded border border-edge bg-surface px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-dim">몹 레벨 범위 (±{range})</span>
            <input
              type="range"
              min={3}
              max={30}
              value={range}
              onChange={(e) => setRange(Number(e.target.value))}
              className="w-40 accent-[var(--maple,#f97316)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-dim">최소 마릿수</span>
            <select
              value={minCount}
              onChange={(e) => setMinCount(Number(e.target.value))}
              className="rounded border border-edge bg-surface px-2 py-2 text-sm text-ink"
            >
              <option value={1}>전체</option>
              <option value={3}>3마리+</option>
              <option value={6}>6마리+</option>
              <option value={10}>10마리+</option>
            </select>
          </label>
          <div className="text-sm text-dim">
            대상 몹: <span className="font-semibold text-maple">Lv.{minLv} ~ {maxLv}</span>
          </div>
          <div className="ml-auto flex gap-1">
            {([
              ["ratio", "체경비순"],
              ["exp", "한 젠 경험치순"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  setSort(key);
                  setMySort(false);
                }}
                className={`pixel-btn px-3 py-2 text-xs ${sort === key && !mySort ? "bg-maple text-white" : ""}`}
              >
                {label}
              </button>
            ))}
            {charActive && (
              <button
                onClick={() => setMySort(true)}
                className={`pixel-btn px-3 py-2 text-xs ${mySort ? "bg-maple text-white" : ""}`}
                title="미스 확률을 포함한 기대 타수당 경험치가 높은 순"
              >
                내 효율순
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ─── 내 캐릭터 ─── */}
      <section className="pixel-panel p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-pixel text-sm font-bold text-ink">⚔️ 내 캐릭터로 계산</h2>
          <button
            onClick={() => patchChar({ enabled: !char.enabled })}
            className={`pixel-btn px-3 py-1.5 text-xs ${char.enabled ? "bg-maple text-white" : ""}`}
          >
            {char.enabled ? "켜짐" : "꺼짐"}
          </button>
          <span className="ml-auto text-[11px] text-dim">
            정밀 계산·원킬컷 역산은 <Link href="/nhit" className="text-maple hover:underline">엔방컷 계산기</Link>
          </span>
        </div>

        {char.enabled && (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="mb-1 block text-[11px] text-dim">직업</span>
                <select
                  value={char.job}
                  onChange={(e) => changeJob(e.target.value)}
                  className="rounded border border-edge bg-surface px-2 py-1.5 text-sm text-ink"
                >
                  {Object.entries(JOB_GROUPS).map(([group, jobs]) => (
                    <optgroup key={group} label={group}>
                      {jobs.map((j) => (
                        <option key={j} value={j}>{j}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-dim">스킬</span>
                <select
                  value={char.skill}
                  onChange={(e) => patchChar({ skill: e.target.value })}
                  className="rounded border border-edge bg-surface px-2 py-1.5 text-sm text-ink"
                >
                  <option value={BASIC_ATTACK}>평타 (100%)</option>
                  {jobData?.actives.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name} ({s.damage}%{s.hits > 1 ? ` ×${s.hits}타` : ""})
                    </option>
                  ))}
                </select>
              </label>
              {jobData && !jobData.isMagic ? (
                <>
                  {(jobData.weapons.length > 1) && (
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-dim">무기</span>
                      <select
                        value={char.weapon}
                        onChange={(e) => patchChar({ weapon: e.target.value })}
                        className="rounded border border-edge bg-surface px-2 py-1.5 text-sm text-ink"
                      >
                        {jobData.weapons.map((w) => (
                          <option key={w} value={w}>{w}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <NumField
                    label={`주스탯 ${weaponMult ? `(${weaponMult.mainStat} 총합)` : "(총합)"}`}
                    value={char.mainStat}
                    onChange={(v) => patchChar({ mainStat: v })}
                  />
                  <NumField
                    label={`부스탯 ${weaponMult ? `(${weaponMult.subStat} 총합)` : "(총합)"}`}
                    value={char.subStat}
                    onChange={(v) => patchChar({ subStat: v })}
                  />
                  <NumField label="공격력" value={char.atk} onChange={(v) => patchChar({ atk: v })} />
                  <NumField label="숙련도 %" value={char.mastery} onChange={(v) => patchChar({ mastery: Math.min(100, v) })} width="w-16" />
                  <NumField label="명중률" value={char.acc} onChange={(v) => patchChar({ acc: v })} width="w-16" />
                </>
              ) : (
                <>
                  <NumField label="INT (총합)" value={char.int} onChange={(v) => patchChar({ int: v })} />
                  <NumField label="LUK (총합)" value={char.luk} onChange={(v) => patchChar({ luk: v })} />
                  <NumField label="마력" value={char.ma} onChange={(v) => patchChar({ ma: v })} />
                </>
              )}
            </div>
            <p className="text-[11px] leading-4 text-dim">
              {activeSkill
                ? `${activeSkill.name}: 데미지 ${activeSkill.damage}%${activeSkill.hits > 1 ? ` × ${activeSkill.hits}타` : ""}${(activeSkill.mobs ?? 1) > 1 ? ` · 최대 ${activeSkill.mobs}마리 (계산은 단일 대상 기준)` : ""} · 숙련도 ${jobData?.isMagic ? "60% 고정" : `${char.mastery}%`}`
                : `평타 100% · 숙련도 ${jobData?.isMagic ? "60% 고정" : `${char.mastery}% (직업 마스터리 자동 반영)`}`}
              {" — "}명중률·데미지 공식은 빅뱅 전 커뮤니티 역산 공식 기반 참고치입니다
              (속성·크리티컬 미반영, 스킬은 만렙 수치 — 상세 시뮬레이션은 엔방컷 계산기).
            </p>
          </div>
        )}
      </section>

      <nav className="flex gap-1">
        {([
          ["maps", "맵 추천"],
          ["mobs", "몹 랭킹"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`pixel-btn px-4 py-2 text-sm ${tab === key ? "bg-maple text-white" : ""}`}
          >
            {label}
          </button>
        ))}
        {data && tab === "maps" && data.total_maps > data.maps.length && (
          <span className="ml-auto self-center text-xs text-dim">
            조건에 맞는 맵 {formatNumber(data.total_maps)}개 중 상위 {data.maps.length}개 표시
          </span>
        )}
      </nav>

      {loading && <div className="pixel-panel p-8 text-center text-sm text-dim">불러오는 중...</div>}
      {error && <div className="pixel-panel p-8 text-center text-sm text-red-500">데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>}

      {!loading && !error && data && tab === "maps" && (
        <section className="space-y-3">
          {data.maps.length === 0 && (
            <div className="pixel-panel p-8 text-center text-sm text-dim">이 레벨 범위에 추천할 맵이 없습니다. 범위를 넓혀보세요.</div>
          )}
          {sortedMaps.map((m, i) => {
            const score = mapScore.get(m.map_id);
            return (
              <article key={m.map_id} className="pixel-panel p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-pixel text-sm font-bold text-dim">#{i + 1}</span>
                  <Link href={`/maps/${m.map_id}`} className="font-semibold text-ink hover:text-maple">
                    {m.name_kr || `맵 ${m.map_id}`}
                  </Link>
                  {m.street_name && <span className="text-xs text-dim">{m.street_name}</span>}
                  <span className={`ml-auto font-pixel text-sm font-bold ${ratioClass(m.weighted_ratio)}`}>
                    체경비 {m.weighted_ratio ?? "-"} · {ratioLabel(m.weighted_ratio)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dim">
                  {m.total_count === null ? (
                    <span>마릿수 미상 (구조물 젠 등) — 서식 몹 기준 추천</span>
                  ) : (
                    <span>
                      총 <span className="font-semibold text-ink">{m.total_count}마리</span>
                      {m.estimated ? " (추정)" : " 젠"}
                    </span>
                  )}
                  {m.exp_per_gen !== null && <span>한 젠 경험치 <span className="font-semibold text-ink">{formatNumber(m.exp_per_gen)}</span></span>}
                  {m.mob_rate !== null && m.mob_rate !== 1 && (
                    <span className={m.mob_rate > 1 ? "text-emerald-600 dark:text-emerald-400" : ""}>젠 배율 ×{m.mob_rate}</span>
                  )}
                  {terrainSummary(m.floors, m.width) && <span>지형 {terrainSummary(m.floors, m.width)}</span>}
                  {terrainHint(m.floors, m.width) && (
                    <span className="text-skill" title="스폰 좌표 분포로 추정한 참고 배지 — 스킬 범위·이동기는 계산에 미반영">
                      {terrainHint(m.floors, m.width)}
                    </span>
                  )}
                  {m.width !== null && m.width > 0 && <span>폭 {formatNumber(m.width)}px</span>}
                  {(m.variant_count ?? 1) > 1 && <span>동일 구성 {m.variant_count}개 구역</span>}
                  {m.out_of_range_count > 0 && <span className="text-amber-600 dark:text-amber-400">범위 밖 몹 +{m.out_of_range_count}마리 주의</span>}
                  {charActive && score !== undefined && (
                    <span className="font-semibold text-maple">내 타수당 EXP {score.toFixed(1)}</span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.mobs.map((mob) => {
                    const c = combatByMob.get(mob.id);
                    return (
                      <Link
                        key={mob.id}
                        href={`/mobs/${mob.id}`}
                        className="flex items-center gap-1.5 rounded bg-surface2 px-2 py-1 text-xs text-ink hover:text-maple"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`${API_BASE}/api/icon/mob/${mob.id}`} alt="" className="h-6 w-6 object-contain" loading="lazy" onError={hideOnError} />
                        <span>{mob.name_kr || mob.id}</span>
                        {mob.count !== null && mob.count !== undefined && <span className="text-dim">×{mob.count}</span>}
                        <span className={`font-semibold ${ratioClass(mob.ratio)}`}>{mob.ratio}</span>
                        {charActive && c && (
                          <span className="text-dim">
                            · <span className="font-semibold text-ink">{c.nHitAvg}방</span>
                            <span className={hitClass(c.hitChance)}> {Math.round(c.hitChance * 100)}%</span>
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {!loading && !error && data && tab === "mobs" && (
        <section className="pixel-panel overflow-x-auto">
          <table className={`w-full text-sm ${charActive ? "min-w-[920px]" : "min-w-[640px]"}`}>
            <thead className="border-b border-edge text-left text-xs text-dim">
              <tr>
                <th className="px-4 py-2">몹</th>
                <th className="px-4 py-2">Lv</th>
                <th className="px-4 py-2">HP</th>
                <th className="px-4 py-2">EXP</th>
                <th className="px-4 py-2">체경비</th>
                {charActive && (
                  <>
                    <th className="px-4 py-2" title="평균 데미지 기준 필요 타수">N방컷</th>
                    <th className="px-4 py-2" title="내 명중률 vs 몹 회피 (레벨차 반영)">명중률</th>
                    <th className="px-4 py-2" title="미스 포함 기대 타수당 얻는 경험치">타수당 EXP</th>
                  </>
                )}
                <th className="px-4 py-2">서식 맵</th>
                <th className="px-4 py-2">총 마릿수</th>
              </tr>
            </thead>
            <tbody>
              {sortedMobs.map((mob) => {
                const c = combatByMob.get(mob.id);
                return (
                  <tr key={mob.id} className="border-b border-edge/40 last:border-0">
                    <td className="px-4 py-2">
                      <Link href={`/mobs/${mob.id}`} className="flex items-center gap-2 font-medium text-ink hover:text-maple">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`${API_BASE}/api/icon/mob/${mob.id}`} alt="" className="h-7 w-7 object-contain" loading="lazy" onError={hideOnError} />
                        {mob.name_kr || mob.id}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-dim">{mob.level}</td>
                    <td className="px-4 py-2 text-dim">{formatNumber(mob.hp)}</td>
                    <td className="px-4 py-2 text-dim">{formatNumber(mob.exp)}</td>
                    <td className={`px-4 py-2 font-pixel font-bold ${ratioClass(mob.ratio)}`}>{mob.ratio}</td>
                    {charActive && (
                      <>
                        <td className="px-4 py-2 font-semibold text-ink">{c ? `${c.nHitAvg}방` : "-"}</td>
                        <td className={`px-4 py-2 font-semibold ${c ? hitClass(c.hitChance) : "text-dim"}`}>
                          {c ? `${Math.round(c.hitChance * 100)}%` : "-"}
                        </td>
                        <td className="px-4 py-2 font-semibold text-maple">
                          {c ? (c.hitChance > 0 ? c.expPerAttack.toFixed(1) : "사냥 불가") : "-"}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-2 text-dim">{mob.map_count > 0 ? `${mob.map_count}곳` : "-"}</td>
                    <td className="px-4 py-2 text-dim">
                      {mob.total_spawns !== null
                        ? `${mob.total_spawns}마리${mob.spawns_estimated ? " (추정)" : ""}`
                        : "미상"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <section className="rounded-lg border border-edge bg-surface2 p-4 text-xs leading-relaxed text-dim">
        <p>
          · 마릿수·배치는 원작(GMS) 스폰 데이터 기준이며, 메이플랜드의 실제 젠 수·리젠 속도와 다를 수 있습니다.
          젠 배율(×)은 맵의 리젠 속도 계수로, &quot;한 젠 경험치순&quot; 정렬에 보정 반영됩니다.
          에델슈타인 몹의 경험치는 9/7 커뮤니티 실측(본섭 환산)이 반영돼 있습니다.
        </p>
        <p className="mt-1">
          · 파티퀘스트·전직 시험·이벤트 인스턴스의 맵과 전용 몹은 일반 사냥터가 아니라서 추천에서 제외했습니다.
        </p>
        <p className="mt-1">
          · <span className="font-semibold text-ink">계산에 반영되는 것</span>: 레벨 차 페널티, 몹 방어(물/마), 명중률(미스 확률), 데미지 편차.{" "}
          <span className="font-semibold text-ink">반영되지 않는 것</span>: 스킬 범위(다수기 동시 타격), 이동기·점프 동선, 몹 공격에 따른 생존/포션 비용 —
          지형 배지(일자형/복층)는 이를 가늠하는 참고 정보입니다.
        </p>
        <p className="mt-1">
          · N방컷·명중률은 빅뱅 전 커뮤니티 역산 공식 기반 참고치입니다 — 원킬컷 역산·타수 분포 시뮬레이션은{" "}
          <Link href="/nhit" className="text-maple hover:underline">엔방컷 계산기</Link>,
          직업별 추천은 <Link href="/hunt" className="text-maple hover:underline">사냥터 추천</Link>,
          한타임 계산은 <Link href="/exp" className="text-maple hover:underline">경험치 계산기</Link>를 참고.
        </p>
      </section>
        </>
      )}
    </div>
  );
}
