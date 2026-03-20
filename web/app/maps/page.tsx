"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMaps, getMapFilters } from "@/lib/api";
import type { MapData } from "@/lib/types";
import DataTable, { Column } from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import FilterPanel, { FilterDef } from "@/components/FilterPanel";


const columns: Column<MapData>[] = [
  { key: "name", label: "이름" },
  { key: "street_name", label: "거리명" },
  { key: "area", label: "지역" },
  { key: "is_town", label: "마을", render: (r) => r.is_town ? "Y" : "" },
];

export default function MapsPage() {
  const router = useRouter();
  const [maps, setMaps] = useState<MapData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [areaOptions, setAreaOptions] = useState<{ value: string; label: string }[]>([]);
  const perPage = 30;

  useEffect(() => {
    getMapFilters()
      .then((d) => {
        setAreaOptions((d.areas || []).map((a) => ({ value: a, label: a })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    getMaps({ page, per_page: perPage, ...filterValues })
      .then((d) => { setMaps(d.maps); setTotal(d.total); })
      .catch(() => setMaps([]))
      .finally(() => setLoading(false));
  }, [page, filterValues]);

  const filters: FilterDef[] = [
    { key: "q", label: "이름 검색", type: "text", placeholder: "맵 이름" },
    { key: "area", label: "지역", type: areaOptions.length > 0 ? "select" : "text", options: areaOptions, placeholder: "빅토리아, 오시리아..." },
    { key: "is_town", label: "마을만", type: "toggle", placeholder: "마을 맵만 보기" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">맵</h1>

      </div>
      <FilterPanel filters={filters} values={filterValues} onChange={(v) => { setFilterValues(v); setPage(1); }} />
      <div className="mt-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400">로딩 중...</div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-2">총 {total}건</p>
            <DataTable columns={columns} data={maps} onRowClick={(row) => router.push(`/maps/${row.id}`)} />
            <Pagination page={page} totalPages={Math.ceil(total / perPage)} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
