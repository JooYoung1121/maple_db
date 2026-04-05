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

  if (loading) return <div className="text-center py-12 text-gray-400">로딩 중...</div>;
  if (!skill) return <div className="text-center py-12 text-gray-400">스킬을 찾을 수 없습니다</div>;

  let levelData: { level: number; effect: string }[] | null = null;
  if (skill.level_data_parsed) {
    levelData = skill.level_data_parsed;
  } else if (skill.level_data) {
    try { levelData = JSON.parse(skill.level_data); } catch { levelData = null; }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/skills" className="text-sm text-orange-500 hover:underline">&larr; 스킬 목록</Link>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mt-3">
        <h1 className="text-2xl font-bold">{skill.skill_name}</h1>
        <div className="flex gap-2 mt-2">
          <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded">{skill.job_class}</span>
          {skill.job_branch && <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">{skill.job_branch}</span>}
          <span className={`text-xs px-2 py-0.5 rounded ${skill.skill_type === "passive" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
            {skill.skill_type === "passive" ? "패시브" : "액티브"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div><span className="text-sm text-gray-500 dark:text-gray-400">마스터 레벨</span><p className="font-medium">{skill.master_level ?? "-"}</p></div>
          <div><span className="text-sm text-gray-500 dark:text-gray-400">직업</span><p className="font-medium">{skill.job_class}</p></div>
        </div>
        {skill.description && (
          <div className="mt-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">설명</span>
            <p className="mt-1">{skill.description}</p>
          </div>
        )}
      </div>

      {levelData && Array.isArray(levelData) && levelData.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3">레벨별 효과</h2>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400 w-20">레벨</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">효과</th>
                </tr>
              </thead>
              <tbody>
                {levelData.map((ld, i) => (
                  <tr key={i} className={`border-b border-gray-100 dark:border-gray-700 ${i % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-900/50"}`}>
                    <td className="px-4 py-2 font-medium text-orange-600">Lv.{ld.level}</td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{ld.effect}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
