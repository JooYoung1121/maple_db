"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getNpcs } from "@/lib/api";
import type { Npc } from "@/lib/types";
import DataTable, { Column } from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import FilterPanel, { FilterDef } from "@/components/FilterPanel";
import ExportButton from "@/components/ExportButton";

const columns: Column<Npc>[] = [
  { key: "name", label: "이름" },
  { key: "map_name", label: "위치" },
  { key: "is_shop", label: "상점", render: (r) => r.is_shop ? "Y" : "" },
];

const filters: FilterDef[] = [
  { key: "q", label: "이름 검색", type: "text", placeholder: "NPC 이름" },
  { key: "is_shop", label: "상점만", type: "toggle", placeholder: "상점 NPC만 보기" },
];

export default function NpcsPage() {
  const router = useRouter();
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const perPage = 30;

  useEffect(() => {
    setLoading(true);
    getNpcs({ page, per_page: perPage, ...filterValues })
      .then((d) => { setNpcs(d.npcs); setTotal(d.total); })
      .catch(() => setNpcs([]))
      .finally(() => setLoading(false));
  }, [page, filterValues]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">NPC</h1>
        <ExportButton entityType="npcs" />
      </div>
      <FilterPanel filters={filters} values={filterValues} onChange={(v) => { setFilterValues(v); setPage(1); }} />
      <div className="mt-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400">로딩 중...</div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-2">총 {total}건</p>
            <DataTable columns={columns} data={npcs} onRowClick={(row) => router.push(`/npcs/${row.id}`)} />
            <Pagination page={page} totalPages={Math.ceil(total / perPage)} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
