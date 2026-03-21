"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getQuests } from "@/lib/api";
import type { Quest } from "@/lib/types";
import DataTable, { Column } from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import FilterPanel, { FilterDef } from "@/components/FilterPanel";
import { useQueryState } from "@/lib/useQueryState";


const columns: Column<Quest>[] = [
  { key: "name", label: "이름" },
  { key: "level_req", label: "레벨" },
  { key: "npc_start", label: "시작 NPC" },
  { key: "npc_end", label: "종료 NPC" },
];

const filters: FilterDef[] = [
  { key: "q", label: "이름 검색", type: "text", placeholder: "퀘스트 이름" },
  { key: "level_min", label: "최소 레벨", type: "number", placeholder: "0" },
  { key: "level_max", label: "최대 레벨", type: "number", placeholder: "200" },
];

function QuestsPageContent() {
  const router = useRouter();
  const { filterValues, page, setFilterValues, setPage } = useQueryState();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const perPage = 30;

  useEffect(() => {
    setLoading(true);
    getQuests({ page, per_page: perPage, ...filterValues })
      .then((d) => { setQuests(d.quests); setTotal(d.total); })
      .catch(() => setQuests([]))
      .finally(() => setLoading(false));
  }, [page, filterValues]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">퀘스트</h1>

      </div>
      <FilterPanel filters={filters} values={filterValues} onChange={setFilterValues} />
      <div className="mt-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400">로딩 중...</div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-2">총 {total}건</p>
            <DataTable columns={columns} data={quests} onRowClick={(row) => router.push(`/quests/${row.id}`)} />
            <Pagination page={page} totalPages={Math.ceil(total / perPage)} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

export default function QuestsPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-gray-400">로딩 중...</div>}>
      <QuestsPageContent />
    </Suspense>
  );
}
