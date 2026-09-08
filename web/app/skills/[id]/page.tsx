"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getSkill } from "@/lib/api";
import type { Skill } from "@/lib/types";

export default function SkillDetailPage() {
  const { id } = useParams();
  const [skill, setSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getSkill(Number(id))
      .then((d) => setSkill(d.skill))
      .catch(() => setSkill(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-12 text-dim">로딩 중...</div>;
  if (!skill) return <div className="text-center py-12 text-dim">스킬을 찾을 수 없습니다</div>;

  const [legacyDescription, currentDescription] = (skill.description || "").split("[메이플랜드 9/7 조정]");
  const historical = skill.job_class === "배틀메이지" || Boolean(currentDescription);

  let levelData: { level: number; effect: string }[] | null = null;
  if (skill.level_data_parsed) {
    levelData = skill.level_data_parsed;
  } else if (skill.level_data) {
    try { levelData = JSON.parse(skill.level_data); } catch { levelData = null; }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/skills" className="text-sm text-maple hover:underline">&larr; 스킬 목록</Link>
      <div className="pixel-panel p-6 mt-3">
        <h1 className="text-2xl font-bold font-pixel">{skill.skill_name}</h1>
        <div className="flex gap-2 mt-2">
          <span className="text-xs px-2 py-0.5 bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] text-maple">{skill.job_class}</span>
          {skill.job_branch && <span className="text-xs px-2 py-0.5 bg-surface2 border border-edge">{skill.job_branch}</span>}
          <span className={`text-xs px-2 py-0.5 rounded ${skill.skill_type === "passive" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
            {skill.skill_type === "passive" ? "패시브" : "액티브"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div><span className="text-sm text-dim">마스터 레벨</span><p className="font-medium">{skill.master_level ?? "-"}</p></div>
          <div><span className="text-sm text-dim">직업</span><p className="font-medium">{skill.job_class}</p></div>
        </div>
        {skill.description && (
          <div className="mt-4">
            <span className="text-sm font-semibold text-maple">{currentDescription ? "메랜 공식 · 2026-09-07 조정" : historical ? "원작 참고 · 메랜 수치 확인 필요" : "설명"}</span>
            <p className="mt-1 whitespace-pre-line leading-relaxed">{currentDescription || legacyDescription}</p>
            {currentDescription && <a href="https://maple.land/board/notices/nbudy1h3t2wjeqrx8i94yupm" target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-sm text-maple underline">공식 변경 근거 →</a>}
          </div>
        )}
      </div>

      {levelData && Array.isArray(levelData) && levelData.length > 0 && (
        <details className="mt-6" open={historical ? undefined : true}>
          <summary className="text-base font-semibold mb-3 font-pixel cursor-pointer min-h-11">{historical ? "원작 레벨별 효과 (현재 메랜 확정값 아님)" : "레벨별 효과"}</summary>
          {historical && <p className="text-sm text-dim mb-3">과거 참고 표입니다. 위 공식 조정과 다를 수 있으며 미공개 중간 레벨은 추정하지 않습니다.</p>}
          {currentDescription && <p className="text-sm text-dim mb-3 whitespace-pre-line">원작 설명: {legacyDescription}</p>}
          <div className="pixel-panel overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface2 border-b-2 border-edge">
                  <th className="px-4 py-3 text-left font-semibold text-dim w-20">레벨</th>
                  <th className="px-4 py-3 text-left font-semibold text-dim">효과</th>
                </tr>
              </thead>
              <tbody>
                {levelData.map((ld, i) => (
                  <tr key={i} className={`border-b border-edge/40 ${i % 2 === 0 ? "" : "bg-surface2"}`}>
                    <td className="px-4 py-2 font-medium text-maple">Lv.{ld.level}</td>
                    <td className="px-4 py-2 text-ink">{ld.effect}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
