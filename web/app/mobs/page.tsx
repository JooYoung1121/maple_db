"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMobs } from "@/lib/api";
import type { Mob } from "@/lib/types";
import DataTable, { Column } from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import FilterPanel, { FilterDef } from "@/components/FilterPanel";
import ExportButton from "@/components/ExportButton";

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

export default function MobsPage() {
  const router = useRouter();
  const [mobs, setMobs] = useState<MobRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const perPage = 30;

  useEffect(() => {
    setLoading(true);
    getMobs({ page, per_page: perPage, ...filterValues })
      .then((d) => { setMobs(d.mobs); setTotal(d.total); })
      .catch(() => setMobs([]))
      .finally(() => setLoading(false));
  }, [page, filterValues]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">몬스터</h1>
        <ExportButton entityType="mobs" />
      </div>
      <FilterPanel filters={filters} values={filterValues} onChange={(v) => { setFilterValues(v); setPage(1); }} />
      <div className="mt-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400">로딩 중...</div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-2">총 {total}건</p>
            <DataTable columns={columns} data={mobs} onRowClick={(row) => router.push(`/mobs/${row.id}`)} />
            <Pagination page={page} totalPages={Math.ceil(total / perPage)} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
