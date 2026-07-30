"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  applyMapleWarrior,
  calculateDamageRange,
  DAMAGE_FORMULA_SOURCES,
  DEFAULT_WEAPON_BY_JOB,
  WEAPON_FORMULAS,
  type JobGroup,
  type StatKey,
} from "@/lib/damageFormula";
import { readMyMapleProfile } from "@/lib/myMaple";

const JOBS: { key: JobGroup; icon: string }[] = [
  { key: "전사", icon: "⚔️" },
  { key: "마법사", icon: "🔮" },
  { key: "궁수", icon: "🏹" },
  { key: "도적", icon: "🗡️" },
  { key: "해적", icon: "⚓" },
];

const STAT_META: Record<StatKey, { label: string; color: string }> = {
  STR: { label: "힘", color: "text-mush" },
  DEX: { label: "민첩", color: "text-slime" },
  INT: { label: "지능", color: "text-skill" },
  LUK: { label: "행운", color: "text-[#8b5cf6]" },
};

interface CalculatorState {
  job: JobGroup;
  weaponKey: string;
  level: number;
  pure: Record<StatKey, number>;
  gear: Record<StatKey, number>;
  equipmentAttack: number;
  consumableAttack: number;
  skillAttack: number;
  mapleWarrior: boolean;
  mapleWarriorRate: number;
  mastery: number;
}

const STORAGE_KEY = "damage_calculator_v1";

const DEFAULT_STATE: CalculatorState = {
  job: "도적",
  weaponKey: "claw",
  level: 70,
  pure: { STR: 4, DEX: 40, INT: 4, LUK: 310 },
  gear: { STR: 0, DEX: 20, INT: 0, LUK: 35 },
  equipmentAttack: 70,
  consumableAttack: 8,
  skillAttack: 0,
  mapleWarrior: false,
  mapleWarriorRate: 10,
  mastery: 60,
};

// 사용자가 제공한 레퍼런스 화면의 수치. 최대 스공 5,560으로 역산 검증한다.
const REFERENCE_EXAMPLE: CalculatorState = {
  job: "도적",
  weaponKey: "claw",
  level: 183,
  pure: { STR: 4, DEX: 52, INT: 4, LUK: 885 },
  gear: { STR: 36, DEX: 105, INT: 0, LUK: 90 },
  equipmentAttack: 117,
  consumableAttack: 17,
  skillAttack: 4,
  mapleWarrior: true,
  mapleWarriorRate: 10,
  mastery: 60,
};

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function normalizeState(value: Partial<CalculatorState>): CalculatorState {
  const job = JOBS.some((item) => item.key === value.job) ? value.job as JobGroup : DEFAULT_STATE.job;
  const allowedWeapons = WEAPON_FORMULAS.filter((item) => item.jobs.includes(job));
  const weaponKey = allowedWeapons.some((item) => item.key === value.weaponKey)
    ? value.weaponKey as string
    : DEFAULT_WEAPON_BY_JOB[job];

  return {
    ...DEFAULT_STATE,
    ...value,
    job,
    weaponKey,
    level: Math.min(200, Math.max(1, safeNumber(value.level, DEFAULT_STATE.level))),
    pure: {
      STR: safeNumber(value.pure?.STR, DEFAULT_STATE.pure.STR),
      DEX: safeNumber(value.pure?.DEX, DEFAULT_STATE.pure.DEX),
      INT: safeNumber(value.pure?.INT, DEFAULT_STATE.pure.INT),
      LUK: safeNumber(value.pure?.LUK, DEFAULT_STATE.pure.LUK),
    },
    gear: {
      STR: safeNumber(value.gear?.STR),
      DEX: safeNumber(value.gear?.DEX),
      INT: safeNumber(value.gear?.INT),
      LUK: safeNumber(value.gear?.LUK),
    },
    equipmentAttack: safeNumber(value.equipmentAttack),
    consumableAttack: safeNumber(value.consumableAttack),
    skillAttack: safeNumber(value.skillAttack),
    mapleWarrior: Boolean(value.mapleWarrior),
    mapleWarriorRate: Math.min(20, safeNumber(value.mapleWarriorRate, 10)),
    mastery: Math.min(100, safeNumber(value.mastery, 60)),
  };
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-dim">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(event) => {
          const next = safeNumber(event.target.value);
          onChange(max === undefined ? Math.max(min, next) : Math.min(max, Math.max(min, next)));
        }}
        className="pixel-input w-full px-3 py-2.5 text-right font-mono text-sm"
      />
    </label>
  );
}

function ResultMetric({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-3 border-b border-edge/60 py-2 last:border-b-0">
      <span className="text-xs text-dim">{label}</span>
      <span className={`font-mono font-bold tabular-nums ${emphasis ? "text-lg text-maple" : "text-sm text-ink"}`}>{value}</span>
    </div>
  );
}

export default function DamageCalculatorPage() {
  const [form, setForm] = useState<CalculatorState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const [profileHint, setProfileHint] = useState<{ job: JobGroup; level: number } | null>(null);
  const [savedAt, setSavedAt] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setForm(normalizeState(JSON.parse(raw)));
      const profile = readMyMapleProfile();
      if (JOBS.some((item) => item.key === profile.job)) {
        setProfileHint({ job: profile.job as JobGroup, level: profile.level });
      }
    } catch {
      // 저장값이 깨졌다면 안전한 기본값을 사용한다.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
      setSavedAt(new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date()));
    } catch {
      setSavedAt("");
    }
  }, [form, loaded]);

  const availableWeapons = useMemo(
    () => WEAPON_FORMULAS.filter((item) => item.jobs.includes(form.job)),
    [form.job],
  );
  const weapon = WEAPON_FORMULAS.find((item) => item.key === form.weaponKey) ?? availableWeapons[0];
  const finalStats = useMemo(
    () => applyMapleWarrior(form.pure, form.gear, form.mapleWarrior, form.mapleWarriorRate),
    [form.pure, form.gear, form.mapleWarrior, form.mapleWarriorRate],
  );
  const totalAttack = form.equipmentAttack + form.consumableAttack + form.skillAttack;
  const damage = useMemo(
    () => calculateDamageRange({ stats: finalStats, totalAttack, mastery: form.mastery, weapon }),
    [finalStats, totalAttack, form.mastery, weapon],
  );
  const noWarriorStats = useMemo(
    () => applyMapleWarrior(form.pure, form.gear, false, form.mapleWarriorRate),
    [form.pure, form.gear, form.mapleWarriorRate],
  );
  const noWarriorDamage = useMemo(
    () => calculateDamageRange({ stats: noWarriorStats, totalAttack, mastery: form.mastery, weapon }),
    [noWarriorStats, totalAttack, form.mastery, weapon],
  );
  const totalMagic = finalStats.INT + totalAttack;
  const mapleWarriorGain = form.mapleWarrior && damage && noWarriorDamage
    ? damage.maximum - noWarriorDamage.maximum
    : 0;

  function changeJob(job: JobGroup) {
    setForm((current) => ({ ...current, job, weaponKey: DEFAULT_WEAPON_BY_JOB[job] }));
  }

  function updateStat(group: "pure" | "gear", key: StatKey, value: number) {
    setForm((current) => ({ ...current, [group]: { ...current[group], [key]: value } }));
  }

  function applyProfile() {
    if (!profileHint) return;
    setForm((current) => ({
      ...current,
      job: profileHint.job,
      level: profileHint.level,
      weaponKey: DEFAULT_WEAPON_BY_JOB[profileHint.job],
    }));
  }

  const mainLabel = weapon.kind === "magic" ? "총 마력" : "최대 스공";
  const mainValue = weapon.kind === "magic" ? totalMagic : Math.round(damage?.maximum ?? 0);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="pixel-badge bg-[color-mix(in_srgb,var(--c-maple)_15%,transparent)] text-[10px] text-maple">NEW</span>
          <span className="text-xs text-dim">메이플랜드 · 빅뱅 전 공식 기준</span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-pixel text-2xl font-bold text-ink sm:text-3xl">🧮 스공 계산기</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-dim">
              순수 스탯과 장비 옵션만 입력하면 메이플 용사·도핑·버프를 반영한 상태창 공격 범위를 바로 계산합니다.
            </p>
          </div>
          <Link href="/gear-sim" className="pixel-btn shrink-0 px-4 py-2 text-center text-xs">
            장비 DB로 세팅하기 →
          </Link>
        </div>
      </header>

      {profileHint && (
        <div className="mb-4 flex flex-col gap-2 border-2 border-skill/50 bg-[color-mix(in_srgb,var(--c-skill)_9%,transparent)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            <span aria-hidden>🍁</span> 내 메랜 프로필의 <strong>{profileHint.job} Lv.{profileHint.level}</strong>을 불러올 수 있어요.
          </p>
          <button onClick={applyProfile} className="text-left text-xs font-semibold text-skill hover:underline sm:text-right">
            직업·레벨 적용
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <section className="pixel-panel p-4 sm:p-5" aria-labelledby="character-heading">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-maple">Step 1</p>
                <h2 id="character-heading" className="mt-1 font-pixel text-sm font-bold">직업과 무기</h2>
              </div>
              <span className="text-[11px] text-dim">결과는 자동 계산</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="group" aria-label="직업 계열">
              {JOBS.map((job) => (
                <button
                  key={job.key}
                  type="button"
                  aria-pressed={form.job === job.key}
                  onClick={() => changeJob(job.key)}
                  className={`min-h-11 border-2 px-2 py-2 text-xs font-semibold transition-colors ${
                    form.job === job.key
                      ? "border-maple bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] text-maple"
                      : "border-edge bg-surface2 text-dim hover:border-maple hover:text-maple"
                  }`}
                >
                  <span className="mr-1" aria-hidden>{job.icon}</span>{job.key}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-dim">무기 종류</span>
                <select
                  value={form.weaponKey}
                  onChange={(event) => setForm((current) => ({ ...current, weaponKey: event.target.value }))}
                  className="pixel-input w-full px-3 py-2.5 text-sm"
                >
                  {availableWeapons.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}{item.kind === "physical" ? ` · ${item.maxMultiplier.toFixed(1)}배` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <NumberField
                label="캐릭터 레벨"
                value={form.level}
                min={1}
                max={200}
                onChange={(level) => setForm((current) => ({ ...current, level }))}
              />
            </div>
          </section>

          <section className="pixel-panel p-4 sm:p-5" aria-labelledby="stats-heading">
            <div className="mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-maple">Step 2</p>
              <h2 id="stats-heading" className="mt-1 font-pixel text-sm font-bold">스탯 입력</h2>
              <p className="mt-1 text-[11px] text-dim">순수 스탯은 AP 분배값, 장비·기타는 모든 장비 옵션의 합계를 입력하세요.</p>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[520px]">
                <div className="grid grid-cols-[84px_1fr_1fr_110px] gap-2 px-1 pb-2 text-center text-[10px] font-semibold text-dim">
                  <span className="text-left">능력치</span>
                  <span>순수</span>
                  <span>장비·기타</span>
                  <span>최종</span>
                </div>
                <div className="space-y-2">
                  {(Object.keys(STAT_META) as StatKey[]).map((key) => {
                    const warriorBonus = form.mapleWarrior ? Math.floor(form.pure[key] * form.mapleWarriorRate / 100) : 0;
                    return (
                      <div key={key} className="grid grid-cols-[84px_1fr_1fr_110px] items-center gap-2">
                        <div>
                          <strong className={`font-mono text-sm ${STAT_META[key].color}`}>{key}</strong>
                          <span className="ml-1 text-[10px] text-dim">{STAT_META[key].label}</span>
                        </div>
                        <input
                          aria-label={`${STAT_META[key].label} 순수 스탯`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={form.pure[key]}
                          onChange={(event) => updateStat("pure", key, safeNumber(event.target.value))}
                          className="pixel-input w-full px-2 py-2 text-right font-mono text-sm"
                        />
                        <input
                          aria-label={`${STAT_META[key].label} 장비 및 기타 스탯`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={form.gear[key]}
                          onChange={(event) => updateStat("gear", key, safeNumber(event.target.value))}
                          className="pixel-input w-full px-2 py-2 text-right font-mono text-sm"
                        />
                        <div className="text-right">
                          <strong className="font-mono text-sm tabular-nums">{finalStats[key].toLocaleString()}</strong>
                          {warriorBonus > 0 && <p className="text-[9px] text-maple">메용 +{warriorBonus}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="pixel-panel p-4 sm:p-5" aria-labelledby="buff-heading">
            <div className="mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-maple">Step 3</p>
              <h2 id="buff-heading" className="mt-1 font-pixel text-sm font-bold">공격력과 버프</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <NumberField
                label={`장비 ${weapon.kind === "magic" ? "마력" : "공격력"} 합`}
                value={form.equipmentAttack}
                onChange={(equipmentAttack) => setForm((current) => ({ ...current, equipmentAttack }))}
              />
              <NumberField
                label={`도핑 ${weapon.kind === "magic" ? "마력" : "공격력"}`}
                value={form.consumableAttack}
                onChange={(consumableAttack) => setForm((current) => ({ ...current, consumableAttack }))}
              />
              <NumberField
                label={`스킬 ${weapon.kind === "magic" ? "마력" : "공격력"}`}
                value={form.skillAttack}
                onChange={(skillAttack) => setForm((current) => ({ ...current, skillAttack }))}
              />
            </div>
            <div className="mt-4 grid gap-3 border-t border-edge/70 pt-4 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3 border-2 border-edge bg-surface2 px-3 py-2.5">
                <label className="flex min-w-0 cursor-pointer items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={form.mapleWarrior}
                    onChange={(event) => setForm((current) => ({ ...current, mapleWarrior: event.target.checked }))}
                    className="h-4 w-4 accent-maple"
                  />
                  메이플 용사 적용
                </label>
                <label className="flex items-center gap-1 text-[11px] text-dim">
                  <span>증가율</span>
                  <input
                    aria-label="메이플 용사 스탯 증가율"
                    type="number"
                    min={0}
                    max={20}
                    value={form.mapleWarriorRate}
                    onChange={(event) => setForm((current) => ({ ...current, mapleWarriorRate: Math.min(20, safeNumber(event.target.value)) }))}
                    disabled={!form.mapleWarrior}
                    className="pixel-input w-14 px-1 py-1 text-right font-mono disabled:opacity-50"
                  />
                  %
                </label>
              </div>
              {weapon.kind === "physical" ? (
                <div className="border-2 border-edge bg-surface2 px-3 py-2.5">
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <label htmlFor="mastery" className="font-semibold">무기 숙련도</label>
                    <span className="font-mono text-maple">{form.mastery}%</span>
                  </div>
                  <input
                    id="mastery"
                    type="range"
                    min={10}
                    max={90}
                    step={5}
                    value={form.mastery}
                    onChange={(event) => setForm((current) => ({ ...current, mastery: Number(event.target.value) }))}
                    className="w-full accent-maple"
                  />
                </div>
              ) : (
                <div className="border-2 border-edge bg-surface2 px-3 py-2.5 text-[11px] leading-5 text-dim">
                  마법사는 상태창의 총 마력(INT + 마력)을 표시합니다. 스킬별 피해는 엔방컷에서 계산하세요.
                </div>
              )}
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setForm(REFERENCE_EXAMPLE)} className="border-2 border-edge bg-surface px-3 py-2 text-xs font-semibold text-ink hover:border-maple hover:text-maple">
              레퍼런스 예시 불러오기
            </button>
            <button type="button" onClick={() => setForm(DEFAULT_STATE)} className="px-3 py-2 text-xs text-dim hover:text-maple">
              기본값으로 초기화
            </button>
            <span className="ml-auto text-[10px] text-dim" role="status">
              {savedAt ? `이 기기에 자동 저장 · ${savedAt}` : "입력값은 이 기기에 자동 저장됩니다"}
            </span>
          </div>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start" aria-label="계산 결과">
          <div className="overflow-hidden border-2 border-maple bg-surface shadow-[4px_4px_0_rgba(0,0,0,0.22)]" aria-live="polite">
            <div className="border-b-2 border-maple bg-[linear-gradient(135deg,color-mix(in_srgb,var(--c-maple)_18%,var(--c-surface)),var(--c-surface))] p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-pixel text-xs text-maple">{mainLabel}</span>
                <span className="pixel-badge bg-surface2 text-[9px] text-dim">Lv.{form.level} {form.job}</span>
              </div>
              <p className="mt-3 font-mono text-4xl font-black tracking-tight text-maple tabular-nums sm:text-5xl">
                {Math.round(mainValue).toLocaleString()}
              </p>
              <p className="mt-2 text-[11px] text-dim">
                {weapon.label} · {weapon.kind === "physical" ? `주스탯 ${weapon.mainStat} × ${weapon.maxMultiplier.toFixed(1)}` : "INT + 총 마력"}
              </p>
            </div>

            <div className="p-5">
              <h2 className="mb-2 font-pixel text-xs font-bold">최종 적용 스탯</h2>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(STAT_META) as StatKey[]).map((key) => (
                  <div key={key} className="border-2 border-edge bg-surface2 px-3 py-2">
                    <span className={`font-mono text-[10px] font-bold ${STAT_META[key].color}`}>{key}</span>
                    <p className="font-mono text-lg font-bold tabular-nums">{finalStats[key].toLocaleString()}</p>
                    <p className="truncate text-[9px] text-dim">
                      순수 {form.pure[key]} + 장비 {form.gear[key]}
                      {form.mapleWarrior ? ` + 메용 ${Math.floor(form.pure[key] * form.mapleWarriorRate / 100)}` : ""}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t-2 border-edge pt-2">
                {weapon.kind === "physical" && damage ? (
                  <>
                    <ResultMetric label="최소 범위" value={Math.round(damage.minimum).toLocaleString()} />
                    <ResultMetric label="평균 범위" value={Math.round(damage.average).toLocaleString()} />
                    <ResultMetric label="최대 범위" value={Math.round(damage.maximum).toLocaleString()} emphasis />
                  </>
                ) : (
                  <ResultMetric label="INT + 마력" value={`${finalStats.INT.toLocaleString()} + ${totalAttack.toLocaleString()}`} emphasis />
                )}
                <ResultMetric
                  label={`총 ${weapon.kind === "magic" ? "마력" : "공격력"}`}
                  value={`${totalAttack.toLocaleString()} (${form.equipmentAttack}+${form.consumableAttack}+${form.skillAttack})`}
                />
              </div>

              {damage && (
                <div className="mt-4 border-2 border-edge bg-bg p-3">
                  <h3 className="font-pixel text-[11px] font-bold text-maple">효율 비교</h3>
                  <div className="mt-2 space-y-1 text-[11px] text-dim">
                    <p className="flex justify-between gap-2">
                      <span>공격력 +1</span>
                      <strong className="font-mono text-ink">최대 스공 +{damage.attackGain.toFixed(1)}</strong>
                    </p>
                    <p className="flex justify-between gap-2">
                      <span>{weapon.mainStat} +1</span>
                      <strong className="font-mono text-ink">최대 스공 +{damage.mainStatGain.toFixed(1)}</strong>
                    </p>
                    <p className="flex justify-between gap-2 border-t border-edge/60 pt-1">
                      <span>공격력 1 환산</span>
                      <strong className="font-mono text-maple">{weapon.mainStat} 약 {damage.attackToMainStat.toFixed(2)}</strong>
                    </p>
                    {mapleWarriorGain > 0 && (
                      <p className="flex justify-between gap-2">
                        <span>메이플 용사 기여</span>
                        <strong className="font-mono text-maple">+{Math.round(mapleWarriorGain).toLocaleString()}</strong>
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link href="/nhit" className="border-2 border-edge px-3 py-2 text-center text-[11px] font-semibold hover:border-maple hover:text-maple">
                  이 스공으로 엔방컷
                </Link>
                <Link href="/gear-sim" className="border-2 border-edge px-3 py-2 text-center text-[11px] font-semibold hover:border-maple hover:text-maple">
                  장비 조합 비교
                </Link>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <details className="pixel-panel mt-7 p-4 sm:p-5">
        <summary className="cursor-pointer font-pixel text-xs font-bold text-ink">계산 기준과 데이터 출처</summary>
        <div className="mt-4 grid gap-5 text-xs leading-6 text-dim md:grid-cols-2">
          <div>
            <h2 className="mb-1 font-semibold text-ink">물리 상태창 범위</h2>
            <p>
              최대값은 (주스탯 × 무기계수 + 부스탯) × 총 공격력 ÷ 100,
              최소값은 (주스탯 × 최소계수 × 0.9 × 숙련도 + 부스탯) × 총 공격력 ÷ 100으로 계산합니다.
              단검·아대는 STR과 DEX를 모두 부스탯에 포함합니다.
            </p>
          </div>
          <div>
            <h2 className="mb-1 font-semibold text-ink">주의할 점</h2>
            <p>
              상태창 범위는 장비 비교용 지표입니다. 실제 피해에는 스킬 배율, 몬스터 방어력, 레벨 차이, 속성, 크리티컬 등이 추가됩니다.
              마법사는 스킬별 공식 차이가 커 이 페이지에서는 총 마력까지만 제공합니다.
            </p>
          </div>
          <div className="md:col-span-2">
            <h2 className="mb-1 font-semibold text-ink">교차 확인한 자료</h2>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {DAMAGE_FORMULA_SOURCES.map((source) => (
                <li key={source.href}>
                  <a href={source.href} target="_blank" rel="noreferrer" className="text-maple hover:underline">
                    {source.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </div>
  );
}
