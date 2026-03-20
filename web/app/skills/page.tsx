"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSkills } from "@/lib/api";
import type { Skill } from "@/lib/types";
import DataTable, { Column } from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import FilterPanel, { FilterDef } from "@/components/FilterPanel";

const JOB_TABS = ["전체", "전사", "마법사", "궁수", "도적", "해적"];

const columns: Column<Skill>[] = [
  { key: "skill_name", label: "스킬명" },
  { key: "job_class", label: "직업" },
  { key: "job_branch", label: "차수" },
  { key: "master_level", label: "마스터레벨" },
  { key: "skill_type", label: "타입", render: (r) => r.skill_type === "passive" ? "패시브" : "액티브" },
];

export default function SkillsPage() {
  const router = useRouter();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState("전체");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const perPage = 30;

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string | number> = { page, per_page: perPage, ...filterValues };
    if (activeTab !== "전체") {
      params.job_class = activeTab;
    }
    getSkills(params as Parameters<typeof getSkills>[0])
      .then((d) => { setSkills(d.skills); setTotal(d.total); })
      .catch(() => setSkills([]))
      .finally(() => setLoading(false));
  }, [page, filterValues, activeTab]);

  const filters: FilterDef[] = [
    { key: "q", label: "스킬 검색", type: "text", placeholder: "스킬 이름" },
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
      <h1 className="text-2xl font-bold mb-4">스킬</h1>
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {JOB_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab
                ? "bg-orange-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <FilterPanel filters={filters} values={filterValues} onChange={(v) => { setFilterValues(v); setPage(1); }} />
      <div className="mt-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400">로딩 중...</div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-2">총 {total}건</p>
            <DataTable columns={columns} data={skills} onRowClick={(row) => router.push(`/skills/${row.id}`)} />
            <Pagination page={page} totalPages={Math.ceil(total / perPage)} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
