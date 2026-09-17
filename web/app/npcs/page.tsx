"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getNpcs } from "@/lib/api";
import type { Npc } from "@/lib/types";
import DataTable, { Column } from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import FilterPanel, { FilterDef } from "@/components/FilterPanel";
import { useQueryState } from "@/lib/useQueryState";
import DatasetComparisonNotice from "@/components/DatasetComparisonNotice";


const columns: Column<Npc>[] = [
  { key: "name", label: "이름", render: (r) => r.name_kr ? <><span>{r.name_kr}</span> <span className="text-dim text-xs">({r.name})</span></> : r.name },
  { key: "map_name", label: "위치" },
  { key: "is_shop", label: "상점", render: (r) => r.is_shop ? "상점" : "일반" },
];

const filters: FilterDef[] = [
  { key: "q", label: "이름 검색", type: "text", placeholder: "NPC 이름", suggestType: "npc" },
  { key: "is_shop", label: "NPC 종류", type: "select", options: [{ value: "1", label: "상점 NPC" }, { value: "0", label: "일반 NPC" }] },
];

function NpcsPageContent() {
  const router = useRouter();
  const { filterValues, page, setFilterValues, setPage } = useQueryState();
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const perPage = 30;

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(false);
    getNpcs({ page, per_page: perPage, ...filterValues })
      .then((d) => { if (!cancelled) { setNpcs(d.npcs); setTotal(d.total); } })
      .catch(() => { if (!cancelled) { setNpcs([]); setTotal(0); setError(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, filterValues, retry]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-pixel text-2xl font-bold">NPC</h1>

      </div>
      <DatasetComparisonNotice type="npc" className="mb-4" />
      <FilterPanel filters={filters} values={filterValues} onChange={setFilterValues} />
      <div className="mt-4">
        {loading ? (
          <div className="text-center py-12 text-dim">로딩 중...</div>
        ) : error ? (
          <div role="alert" className="pixel-panel p-8 text-center"><p>목록을 불러오지 못했습니다.</p><button onClick={() => setRetry((v) => v + 1)} className="mt-3 text-maple">다시 시도</button></div>
        ) : (
          <>
            <p className="text-sm text-dim mb-2">총 {total.toLocaleString()}건</p>
            <DataTable columns={columns} data={npcs} onRowClick={(row) => router.push(`/npcs/${row.id}`)} />
            <Pagination page={page} totalPages={Math.ceil(total / perPage)} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

export default function NpcsPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-dim">로딩 중...</div>}>
      <NpcsPageContent />
    </Suspense>
  );
}
