"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSkillSimData, type SimJob, type SimSkill } from "@/lib/api";

/* ── 상수 ── */
const JOB_CLASSES = ["전사", "마법사", "궁수", "도적", "해적"] as const;
const FACTIONS = [
  { key: "adventurer", label: "모험가" },
  { key: "cygnus", label: "시그너스" },
] as const;
const BRANCH_LABELS: Record<number, string> = { 1: "1차", 2: "2차", 3: "3차", 4: "4차" };

// v1.2.x 기준 SP 규칙: 1차 전직 시 SP+1, 이후 레벨당 SP+3, 상위 전직(30/70/120) 시 SP+1
// 마법사는 8레벨 1차 전직. 시그너스는 3차(70)까지.
function firstJobLevel(jobClass: string, faction: string): number {
  return faction === "adventurer" && jobClass === "마법사" ? 8 : 10;
}
function branchUnlocks(faction: string): Record<number, number> {
  return faction === "adventurer" ? { 2: 30, 3: 70, 4: 120 } : { 2: 30, 3: 70 };
}

/* ── 레벨별 효과 렌더링: detail 템플릿의 #토큰을 수치로 치환 ── */
function renderEffect(tpl: string | null, props?: Record<string, string | number>): string {
  if (!tpl) return "";
  if (!props) return tpl;
  const keys = Object.keys(props).filter((k) => k !== "hs").sort((a, b) => b.length - a.length);
  let out = tpl;
  for (const k of keys) out = out.split(`#${k}`).join(String(props[k]));
  return out;
}

/* ── 공유 해시 인코딩 ── */
function encodeBuild(faction: string, jobClass: string, path2: number | null, levels: Record<number, number>): string {
  const lv = Object.entries(levels)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => `${id}.${v}`)
    .join("_");
  return `f=${faction === "cygnus" ? "c" : "a"}&j=${encodeURIComponent(jobClass)}&p=${path2 ?? ""}&s=${lv}`;
}
function decodeBuild(hash: string) {
  const sp = new URLSearchParams(hash.replace(/^#/, ""));
  const jobClass = sp.get("j") ? decodeURIComponent(sp.get("j")!) : null;
  if (!jobClass || !(JOB_CLASSES as readonly string[]).includes(jobClass)) return null;
  const faction = sp.get("f") === "c" ? "cygnus" : "adventurer";
  const path2 = sp.get("p") ? Number(sp.get("p")) : null;
  const levels: Record<number, number> = {};
  for (const pair of (sp.get("s") ?? "").split("_")) {
    const [id, v] = pair.split(".");
    if (id && v && Number(v) > 0) levels[Number(id)] = Number(v);
  }
  return { faction, jobClass, path2, levels };
}

/* ── 스킬 한 줄 ── */
function SkillRow({
  skill, level, allSkillsById, levels, onChange, expanded, onToggle,
}: {
  skill: SimSkill;
  level: number;
  allSkillsById: Map<number, SimSkill>;
  levels: Record<number, number>;
  onChange: (skill: SimSkill, delta: number, big: boolean) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const reqEntries = Object.entries(skill.required_skills);
  const reqMet = reqEntries.every(([rid, rlv]) => (levels[Number(rid)] ?? 0) >= rlv);
  const maxed = level >= skill.master_level;
  const props = level > 0 ? skill.level_properties[level - 1] : undefined;
  const nextProps = !maxed ? skill.level_properties[level] : undefined;

  return (
    <div className={`pixel-card ${level > 0 ? "border-maple/60" : ""}`}>
      <div className="flex items-center gap-3 p-2">
        <img
          src={skill.icon_path ?? ""}
          alt=""
          className={`w-8 h-8 object-contain shrink-0 [image-rendering:pixelated] ${level === 0 ? "grayscale opacity-40" : ""}`}
        />
        <button onClick={onToggle} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium truncate ${level > 0 ? "text-ink" : "text-dim"}`}>{skill.name}</span>
            {!reqMet && <span className="font-pixel text-[10px] text-red-500 shrink-0">선행 필요</span>}
          </div>
          {props && (
            <div className="text-xs text-dim truncate">{renderEffect(skill.detail_template, props)}</div>
          )}
        </button>
        <span className={`font-pixel text-xs w-14 text-right shrink-0 ${maxed ? "text-maple" : "text-dim"}`}>
          {level}/{skill.master_level}
        </span>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={(e) => onChange(skill, -1, e.shiftKey)}
            disabled={level === 0}
            className="w-7 h-7 pixel-card font-pixel text-sm disabled:opacity-30"
            title="Shift+클릭: -5"
          >
            −
          </button>
          <button
            onClick={(e) => onChange(skill, +1, e.shiftKey)}
            disabled={maxed || !reqMet}
            className="w-7 h-7 pixel-btn text-sm disabled:opacity-30"
            title="Shift+클릭: +5"
          >
            +
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t-2 border-edge text-sm space-y-2">
          <p className="text-dim whitespace-pre-line">{skill.description}</p>
          {reqEntries.length > 0 && (
            <div className="text-xs">
              <span className="font-pixel text-dim">선행 스킬: </span>
              {reqEntries.map(([rid, rlv]) => {
                const rs = allSkillsById.get(Number(rid));
                const ok = (levels[Number(rid)] ?? 0) >= rlv;
                return (
                  <span key={rid} className={`mr-2 ${ok ? "text-green-500" : "text-red-500"}`}>
                    {rs?.name ?? rid} Lv.{rlv} {ok ? "✓" : "✗"}
                  </span>
                );
              })}
            </div>
          )}
          {props && (
            <div className="text-xs">
              <span className="font-pixel text-maple">현재 Lv.{level}: </span>
              <span className="text-ink">{renderEffect(skill.detail_template, props)}</span>
            </div>
          )}
          {nextProps && (
            <div className="text-xs">
              <span className="font-pixel text-dim">다음 Lv.{level + 1}: </span>
              <span className="text-dim">{renderEffect(skill.detail_template, nextProps)}</span>
            </div>
          )}
          {skill.weapons.length > 0 && (
            <div className="text-xs text-dim">사용 무기: {skill.weapons.join(", ")}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SkillSimPage() {
  const [faction, setFaction] = useState<string>("adventurer");
  const [jobClass, setJobClass] = useState<string>("전사");
  const [jobs, setJobs] = useState<SimJob[]>([]);
  const [skills, setSkills] = useState<SimSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [path2, setPath2] = useState<number | null>(null);
  const [levels, setLevels] = useState<Record<number, number>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [hashApplied, setHashApplied] = useState(false);

  // 최초 진입 시 공유 해시 복원
  useEffect(() => {
    const decoded = typeof window !== "undefined" && window.location.hash.length > 1
      ? decodeBuild(window.location.hash) : null;
    if (decoded) {
      setFaction(decoded.faction);
      setJobClass(decoded.jobClass);
      setPath2(decoded.path2);
      setLevels(decoded.levels);
    }
    setHashApplied(true);
  }, []);

  // 데이터 로드
  useEffect(() => {
    if (!hashApplied) return;
    setLoading(true);
    setError(null);
    getSkillSimData(jobClass, faction)
      .then((d) => {
        setJobs(d.jobs);
        setSkills(d.skills);
      })
      .catch(() => setError("스킬 데이터를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [jobClass, faction, hashApplied]);

  const skillsById = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const branch2Jobs = useMemo(() => jobs.filter((j) => j.branch === 2), [jobs]);

  // 2차 경로 기본값 보정
  useEffect(() => {
    if (branch2Jobs.length === 0) return;
    if (path2 === null || !branch2Jobs.some((j) => j.id === path2)) {
      setPath2(branch2Jobs[0].id);
    }
  }, [branch2Jobs, path2]);

  // 선택된 전직 체인: 1차 → path2 → 3차 → 4차
  const chain = useMemo(() => {
    const first = jobs.find((j) => j.branch === 1);
    if (!first) return [] as SimJob[];
    const out = [first];
    let cur: SimJob | undefined = jobs.find((j) => j.id === path2) ?? branch2Jobs[0];
    while (cur) {
      out.push(cur);
      const parentId: number = cur.id;
      cur = jobs.find((j) => j.parent_id === parentId);
    }
    return out;
  }, [jobs, path2, branch2Jobs]);

  const chainSkills = useMemo(
    () => chain.map((job) => ({ job, list: skills.filter((s) => s.job_id === job.id) })),
    [chain, skills]
  );

  // SP 계산
  const first = firstJobLevel(jobClass, faction);
  const unlocks = branchUnlocks(faction);
  const invested = useMemo(() => {
    const byBranch: Record<number, number> = {};
    let total = 0;
    for (const { job, list } of chainSkills) {
      const sum = list.reduce((acc, s) => acc + (levels[s.id] ?? 0), 0);
      byBranch[job.branch] = sum;
      total += sum;
    }
    return { byBranch, total };
  }, [chainSkills, levels]);

  const totalSP = useCallback(
    (L: number) => {
      if (L < first) return 0;
      let sp = 1 + 3 * (L - first);
      for (const u of Object.values(unlocks)) if (L >= u) sp += 1;
      return sp;
    },
    [first, unlocks]
  );

  const requiredLevel = useMemo(() => {
    if (invested.total === 0) return null;
    let L = first;
    for (const [b, u] of Object.entries(unlocks)) {
      if ((invested.byBranch[Number(b)] ?? 0) > 0) L = Math.max(L, u);
    }
    const maxL = faction === "adventurer" ? 200 : 120;
    while (totalSP(L) < invested.total && L < maxL) L++;
    return L;
  }, [invested, first, unlocks, faction, totalSP]);

  const remainingSP = requiredLevel !== null ? totalSP(requiredLevel) - invested.total : 0;

  // 스킬 증감 (Shift = 5)
  const changeLevel = useCallback(
    (skill: SimSkill, delta: number, big: boolean) => {
      const step = big ? 5 : 1;
      setLevels((prev) => {
        const cur = prev[skill.id] ?? 0;
        let next = cur + delta * step;
        if (delta > 0) {
          next = Math.min(next, skill.master_level);
        } else {
          // 이 스킬을 선행으로 요구하는(포인트가 찍힌) 스킬이 있으면 그 요구 레벨 밑으로 못 내림
          let floor = 0;
          for (const s of skills) {
            if ((prev[s.id] ?? 0) > 0 && s.required_skills[String(skill.id)]) {
              floor = Math.max(floor, s.required_skills[String(skill.id)]);
            }
          }
          next = Math.max(next, floor, 0);
        }
        if (next === cur) return prev;
        return { ...prev, [skill.id]: next };
      });
    },
    [skills]
  );

  const resetAll = useCallback(() => setLevels({}), []);

  const share = useCallback(() => {
    const hash = encodeBuild(faction, jobClass, path2, levels);
    const url = `${window.location.origin}${window.location.pathname}#${hash}`;
    window.history.replaceState(null, "", `#${hash}`);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [faction, jobClass, path2, levels]);

  // 직업/진영 변경 시 빌드 초기화 (해시 복원 직후는 제외)
  const switchClass = (cls: string) => {
    if (cls === jobClass) return;
    setJobClass(cls);
    setPath2(null);
    setLevels({});
    setExpandedId(null);
  };
  const switchFaction = (f: string) => {
    if (f === faction) return;
    setFaction(f);
    setPath2(null);
    setLevels({});
    setExpandedId(null);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 font-pixel">스킬 시뮬레이터</h1>
      <p className="text-dim mb-6">
        직업별 스킬 트리를 미리 계획해보세요. 선행 스킬 조건과 필요 레벨이 자동 계산됩니다.
        <span className="font-pixel text-xs ml-2 text-dim">(Shift+클릭: 5씩 증감)</span>
      </p>

      {/* 진영 + 직업 선택 */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex bg-surface2 p-1">
          {FACTIONS.map((f) => (
            <button
              key={f.key}
              onClick={() => switchFaction(f.key)}
              className={`px-4 py-2 text-sm transition ${faction === f.key ? "pixel-btn" : "font-pixel text-dim hover:text-maple"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {JOB_CLASSES.map((cls) => (
            <button
              key={cls}
              onClick={() => switchClass(cls)}
              className={`px-4 py-2 text-sm transition ${jobClass === cls ? "pixel-btn" : "pixel-card font-pixel text-dim"}`}
            >
              {cls}
            </button>
          ))}
        </div>
      </div>

      {/* 2차 전직 경로 선택 */}
      {branch2Jobs.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <span className="font-pixel text-xs text-dim self-center">전직 경로:</span>
          {branch2Jobs.map((j) => (
            <button
              key={j.id}
              onClick={() => { setPath2(j.id); setExpandedId(null); }}
              className={`px-3 py-1.5 text-sm transition ${path2 === j.id ? "pixel-btn" : "pixel-card font-pixel text-dim"}`}
            >
              {j.name_ko}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-dim">
          <div className="w-8 h-8 border-2 border-maple border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          스킬 데이터 로딩 중...
        </div>
      ) : error ? (
        <div className="pixel-panel p-8 text-center text-dim">{error}</div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_280px] gap-4 items-start">
          {/* 스킬북 (차수별) */}
          <div className="space-y-4">
            {chainSkills.map(({ job, list }) => (
              <div key={job.id} className="pixel-panel p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-pixel text-sm text-ink">
                    <span className="text-maple">{BRANCH_LABELS[job.branch]}</span> {job.name_ko}
                    <span className="text-xs text-dim ml-2">
                      Lv.{job.branch === 1 ? first : unlocks[job.branch]}~
                    </span>
                  </h2>
                  <span className="font-pixel text-xs text-dim">
                    투자 SP {invested.byBranch[job.branch] ?? 0}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {list.map((s) => (
                    <SkillRow
                      key={s.id}
                      skill={s}
                      level={levels[s.id] ?? 0}
                      allSkillsById={skillsById}
                      levels={levels}
                      onChange={changeLevel}
                      expanded={expandedId === s.id}
                      onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 요약 패널 */}
          <div className="pixel-panel p-4 lg:sticky lg:top-20 space-y-3">
            <h2 className="font-pixel text-sm text-ink">빌드 요약</h2>
            <div className="text-center py-3 bg-surface2 border-2 border-edge">
              {requiredLevel !== null ? (
                <>
                  <div className="font-pixel text-2xl text-maple">Lv.{requiredLevel}</div>
                  <div className="text-xs text-dim mt-1">이 빌드에 필요한 레벨</div>
                  {remainingSP > 0 && (
                    <div className="text-xs text-dim">잔여 SP {remainingSP}</div>
                  )}
                </>
              ) : (
                <div className="text-sm text-dim py-2">스킬에 SP를 투자해보세요</div>
              )}
            </div>
            <div className="space-y-1 text-sm">
              {chainSkills.map(({ job }) => (
                <div key={job.id} className="flex justify-between">
                  <span className="text-dim">{BRANCH_LABELS[job.branch]} {job.name_ko}</span>
                  <span className="font-pixel text-xs text-ink">{invested.byBranch[job.branch] ?? 0} SP</span>
                </div>
              ))}
              <div className="flex justify-between border-t-2 border-edge pt-1 mt-1">
                <span className="font-pixel text-xs text-dim">총 투자</span>
                <span className="font-pixel text-xs text-maple">{invested.total} SP</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={share} className="flex-1 px-3 py-2 pixel-btn text-sm">
                {copied ? "복사 완료!" : "빌드 공유"}
              </button>
              <button onClick={resetAll} className="px-3 py-2 pixel-card font-pixel text-xs text-dim">
                초기화
              </button>
            </div>
            <p className="text-[11px] text-dim leading-relaxed">
              SP 규칙: 1차 전직 시 +1, 레벨당 +3, 상위 전직 시 +1.
              {faction === "adventurer" && jobClass === "마법사" ? " 마법사는 8레벨 전직." : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
