/**
 * 스킬 레벨별 수치 — 정본은 web/data/skillLevels.json
 * (scripts/export_skill_levels.py 가 sim_skills(KMST 크롤)에서 생성, 35스킬).
 * DB에 없는 스킬(4차 일부·해적 다수)은 jobSkillData 하드코딩 만렙값을
 * min~max 선형 보간하는 기존 방식으로 폴백한다.
 */
import curvesJson from "@/data/skillLevels.json";
import type { ActiveSkill } from "@/lib/jobSkillData";

export interface SkillLevelEntry {
  damage: number; // 물리 = 데미지 %, 마법 = 스킬 기본 공격력 (calcMagicDamage의 skillPct 자리)
  hits: number;
  mobs: number;
}

interface SkillCurve {
  sourceId: number;
  maxLevel: number;
  levels: SkillLevelEntry[];
}

const CURVES = curvesJson as Record<string, SkillCurve>;

export function hasLevelCurve(name: string): boolean {
  return !!CURVES[name];
}

export function skillMaxLevel(skill: ActiveSkill): number {
  return CURVES[skill.name]?.maxLevel ?? skill.maxLevel;
}

/** 해당 스킬 레벨의 수치 — DB 곡선 우선, 없으면 하드코딩 선형 보간 */
export function skillAtLevel(skill: ActiveSkill, level: number): SkillLevelEntry {
  const curve = CURVES[skill.name];
  if (curve) {
    const idx = Math.min(Math.max(1, Math.round(level)), curve.maxLevel) - 1;
    return curve.levels[idx];
  }
  const clamped = Math.min(Math.max(1, Math.round(level)), skill.maxLevel);
  const t = skill.maxLevel > 1 ? (clamped - 1) / (skill.maxLevel - 1) : 1;
  return {
    damage: skill.minDamage + (skill.damage - skill.minDamage) * t,
    hits: skill.hits,
    mobs: skill.mobs ?? 1,
  };
}
