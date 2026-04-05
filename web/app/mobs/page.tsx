"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMobs } from "@/lib/api";
import type { Mob } from "@/lib/types";
import DataTable, { Column } from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import FilterPanel, { FilterDef, SortOption } from "@/components/FilterPanel";
import { useQueryState } from "@/lib/useQueryState";


interface MobRow extends Mob {
  name_kr?: string | null;
}

const columns: Column<MobRow>[] = [
  { key: "name", label: "이름", render: (r) => r.name_kr ? <><span>{r.name_kr}</span> <span className="text-gray-400 text-xs">({r.name})</span></> : r.name },
  { key: "level", label: "레벨" },
  { key: "hp", label: "HP", render: (r) => (r.hp ?? 0).toLocaleString() },
  { key: "exp", label: "EXP", render: (r) => (r.exp ?? 0).toLocaleString() },
  { key: "is_boss", label: "보스", render: (r) => r.is_boss ? "Y" : "" },
];

const filters: FilterDef[] = [
  { key: "q", label: "이름 검색", type: "text", placeholder: "몬스터 이름" },
  { key: "level_min", label: "최소 레벨", type: "number", placeholder: "0" },
  { key: "level_max", label: "최대 레벨", type: "number", placeholder: "200" },
  { key: "is_boss", label: "보스만", type: "toggle", placeholder: "보스 몬스터만 보기" },
];

const sortOptions: SortOption[] = [
  { value: "", label: "레벨 낮은순" },
  { value: "level_desc", label: "레벨 높은순" },
  { value: "hp_desc", label: "HP 높은순" },
  { value: "exp_desc", label: "경험치 높은순" },
  { value: "name_asc", label: "이름순" },
];

function MobsPageContent() {
  const router = useRouter();
  const { filterValues, page, sortValue, setFilterValues, setPage, setSortValue } = useQueryState();
  const [mobs, setMobs] = useState<MobRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const perPage = 30;

  useEffect(() => {
    setLoading(true);
    getMobs({ page, per_page: perPage, sort: sortValue || undefined, ...filterValues })
      .then((d) => { setMobs(d.mobs); setTotal(d.total); })
      .catch(() => setMobs([]))
      .finally(() => setLoading(false));
  }, [page, filterValues, sortValue]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">몬스터</h1>

      </div>
      <FilterPanel filters={filters} values={filterValues} onChange={setFilterValues} sortOptions={sortOptions} sortValue={sortValue} onSortChange={setSortValue} />
      <div className="mt-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400">로딩 중...</div>
        ) : (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">총 {total.toLocaleString()}건</p>
            <DataTable columns={columns} data={mobs} onRowClick={(row) => router.push(`/mobs/${row.id}`)} />
            <Pagination page={page} totalPages={Math.ceil(total / perPage)} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

export default function MobsPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-gray-400">로딩 중...</div>}>
      <MobsPageContent />
    </Suspense>
  );
}
