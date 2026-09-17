"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMobs } from "@/lib/api";
import type { Mob } from "@/lib/types";
import DataTable, { Column } from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import FilterPanel, { FilterDef, SortOption } from "@/components/FilterPanel";
import { useQueryState } from "@/lib/useQueryState";
import CanonDiffInfo from "@/components/CanonDiffInfo";
import DatasetComparisonNotice from "@/components/DatasetComparisonNotice";
import { getEntityCanonDiffs } from "@/lib/entityCanonDiffs";


interface MobRow extends Mob {
  name_kr?: string | null;
}

const columns: Column<MobRow>[] = [
  { key: "name", label: "이름", render: (r) => {
    const entries = getEntityCanonDiffs("mob", r.id, r.name_kr || r.name);
    return <span className="inline-flex flex-wrap items-center gap-1.5"><span>{r.name_kr || r.name}</span>{r.name_kr && <span className="text-dim text-xs">({r.name})</span>}{entries.map((entry) => <CanonDiffInfo key={entry.id} entry={entry} compact align="left" />)}</span>;
  } },
  { key: "level", label: "레벨" },
  { key: "hp", label: "HP", render: (r) => (r.hp ?? 0).toLocaleString() },
  { key: "exp", label: "EXP", render: (r) => (r.exp ?? 0).toLocaleString() },
  { key: "is_boss", label: "보스", render: (r) => r.is_boss ? "보스" : "일반" },
];

const filters: FilterDef[] = [
  { key: "q", label: "이름 검색", type: "text", placeholder: "몬스터 이름", suggestType: "mob" },
  { key: "level_min", label: "최소 레벨", type: "number", placeholder: "0" },
  { key: "level_max", label: "최대 레벨", type: "number", placeholder: "200" },
  { key: "is_boss", label: "몬스터 종류", type: "select", options: [{ value: "0", label: "일반 몬스터" }, { value: "1", label: "보스 몬스터" }] },
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
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const perPage = 30;

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(false);
    getMobs({ page, per_page: perPage, sort: sortValue || undefined, ...filterValues })
      .then((d) => { if (!cancelled) { setMobs(d.mobs); setTotal(d.total); } })
      .catch(() => { if (!cancelled) { setMobs([]); setTotal(0); setError(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, filterValues, sortValue, retry]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-pixel text-2xl font-bold">몬스터</h1>

      </div>
      <DatasetComparisonNotice type="mob" className="mb-4" />
      <FilterPanel filters={filters} values={filterValues} onChange={setFilterValues} sortOptions={sortOptions} sortValue={sortValue} onSortChange={setSortValue} />
      <div className="mt-4">
        {loading ? (
          <div className="text-center py-12 text-dim">로딩 중...</div>
        ) : error ? (
          <div role="alert" className="pixel-panel p-8 text-center"><p>목록을 불러오지 못했습니다.</p><button onClick={() => setRetry((v) => v + 1)} className="mt-3 text-maple">다시 시도</button></div>
        ) : (
          <>
            <p className="text-sm text-dim mb-2">총 {total.toLocaleString()}건</p>
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
    <Suspense fallback={<div className="text-center py-12 text-dim">로딩 중...</div>}>
      <MobsPageContent />
    </Suspense>
  );
}
