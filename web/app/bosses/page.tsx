"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBosses } from "@/lib/api";
import type { Boss } from "@/lib/types";
import DataTable, { Column } from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import FilterPanel, { FilterDef } from "@/components/FilterPanel";
import { useQueryState } from "@/lib/useQueryState";

interface BossRow extends Boss {
  name_kr?: string | null;
}

const columns: Column<BossRow>[] = [
  { key: "name", label: "이름", render: (r) => r.name_kr ? <><span>{r.name_kr}</span> <span className="text-gray-400 text-xs">({r.name})</span></> : r.name },
  { key: "level", label: "레벨" },
  { key: "hp", label: "HP", render: (r) => (r.hp ?? 0).toLocaleString() },
  { key: "spawn_time", label: "젠타임", render: (r) => r.spawn_time || "-" },
  { key: "spawn_map", label: "스폰맵", render: (r) => r.spawn_map || "-" },
  { key: "drop_count", label: "드롭", render: (r) => r.drop_count ?? 0 },
];

const filters: FilterDef[] = [
  { key: "q", label: "이름 검색", type: "text", placeholder: "보스 이름" },
  { key: "level_min", label: "최소 레벨", type: "number", placeholder: "0" },
  { key: "level_max", label: "최대 레벨", type: "number", placeholder: "200" },
];

function BossesPageContent() {
  const router = useRouter();
  const { filterValues, page, setFilterValues, setPage } = useQueryState();
  const [bosses, setBosses] = useState<BossRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const perPage = 30;

  useEffect(() => {
    setLoading(true);
    getBosses({ page, per_page: perPage, ...filterValues })
      .then((d) => { setBosses(d.bosses); setTotal(d.total); })
      .catch(() => setBosses([]))
      .finally(() => setLoading(false));
  }, [page, filterValues]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">보스 몬스터</h1>
      </div>
      <FilterPanel filters={filters} values={filterValues} onChange={setFilterValues} />
      <div className="mt-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400">로딩 중...</div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-2">총 {total.toLocaleString()}건</p>
            <DataTable columns={columns} data={bosses} onRowClick={(row) => router.push(`/mobs/${row.id}`)} />
            <Pagination page={page} totalPages={Math.ceil(total / perPage)} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

export default function BossesPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-gray-400">로딩 중...</div>}>
      <BossesPageContent />
    </Suspense>
  );
}
