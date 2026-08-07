"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSkills } from "@/lib/api";
import type { Skill } from "@/lib/types";
import DataTable, { Column } from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import FilterPanel, { FilterDef } from "@/components/FilterPanel";
import { useQueryState } from "@/lib/useQueryState";
import CanonDiffInfo from "@/components/CanonDiffInfo";
import DatasetComparisonNotice from "@/components/DatasetComparisonNotice";
import { getEntityCanonDiffs } from "@/lib/entityCanonDiffs";

const JOB_TABS = ["전체", "전사", "마법사", "궁수", "도적", "해적"];

const columns: Column<Skill>[] = [
  { key: "skill_name", label: "스킬명", render: (r) => {
    const entries = getEntityCanonDiffs("skill", undefined, r.skill_name);
    return (
      <span className="inline-flex items-center gap-2">
        {r.skill_name}
        {entries.map((entry) => <CanonDiffInfo key={entry.id} entry={entry} compact align="left" />)}
      </span>
    );
  } },
  { key: "job_class", label: "직업" },
  { key: "job_branch", label: "차수" },
  { key: "master_level", label: "마스터레벨" },
  { key: "skill_type", label: "타입", render: (r) => r.skill_type === "passive" ? "패시브" : "액티브" },
];

function SkillsPageContent() {
  const router = useRouter();
  const { filterValues, page, setFilterValues, setPage } = useQueryState();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const perPage = 30;

  // job_class는 filterValues에서 관리 (URL 동기화)
  const activeTab = filterValues.job_class || "전체";

  const setActiveTab = (tab: string) => {
    const newFilters = { ...filterValues };
    if (tab === "전체") {
      delete newFilters.job_class;
    } else {
      newFilters.job_class = tab;
    }
    setFilterValues(newFilters);
  };

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string | number> = { page, per_page: perPage, ...filterValues };
    getSkills(params as Parameters<typeof getSkills>[0])
      .then((d) => { setSkills(d.skills); setTotal(d.total); })
      .catch(() => setSkills([]))
      .finally(() => setLoading(false));
  }, [page, filterValues]);

  const filters: FilterDef[] = [
    { key: "q", label: "스킬 검색", type: "text", placeholder: "스킬 이름", suggestType: "skill" },
    { key: "job_branch", label: "차수", type: "select", options: [
      { value: "1차", label: "1차" }, { value: "2차", label: "2차" },
      { value: "3차", label: "3차" }, { value: "4차", label: "4차" },
    ]},
    { key: "skill_type", label: "타입", type: "select", options: [
      { value: "active", label: "액티브" }, { value: "passive", label: "패시브" },
    ]},
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 font-pixel">스킬</h1>
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
        현재 스킬 DB는 과거 수집 데이터가 섞여 있어 메랜 기준 정규 리빌드가 필요합니다. 직업별 스킬 배치와 마스터레벨은 검증 중인 참고 정보로 봐주세요.
      </div>
      <DatasetComparisonNotice type="skill" className="mb-4" />
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {JOB_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm whitespace-nowrap transition-colors ${
              activeTab === tab
                ? "pixel-btn"
                : "bg-surface2 font-pixel text-dim hover:text-maple"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <FilterPanel filters={filters} values={filterValues} onChange={setFilterValues} />
      <div className="mt-4">
        {loading ? (
          <div className="text-center py-12 text-dim">로딩 중...</div>
        ) : (
          <>
            <p className="text-sm text-dim mb-2">총 {total.toLocaleString()}건</p>
            <DataTable columns={columns} data={skills} onRowClick={(row) => router.push(`/skills/${row.id}`)} />
            <Pagination page={page} totalPages={Math.ceil(total / perPage)} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

export default function SkillsPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-dim">로딩 중...</div>}>
      <SkillsPageContent />
    </Suspense>
  );
}
