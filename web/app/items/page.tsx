"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getItems, getItemFilters } from "@/lib/api";
import type { Item } from "@/lib/types";
import DataTable, { Column } from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import FilterPanel, { FilterDef, SortOption } from "@/components/FilterPanel";
import { useQueryState } from "@/lib/useQueryState";

import { toCategoryKr, toSubcategoryKr, JOB_KR } from "@/lib/translations";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface ItemRow extends Item {
  name_kr?: string | null;
}

const columns: Column<ItemRow>[] = [
  { key: "name", label: "이름", render: (r) => r.name_kr ? <><span>{r.name_kr}</span> <span className="text-gray-400 text-xs">({r.name})</span></> : r.name },
  { key: "category", label: "분류", render: (r) => toCategoryKr(r.category) },
  { key: "level_req", label: "레벨" },
  { key: "job_req", label: "직업" },
];

const DEFAULT_CATEGORY = "";

const sortOptions: SortOption[] = [
  { value: "", label: "기본" },
  { value: "level_asc", label: "레벨 낮은순" },
  { value: "level_desc", label: "레벨 높은순" },
  { value: "name_asc", label: "이름순" },
];

function ItemsPageContent() {
  const router = useRouter();
  const { filterValues, page, sortValue, setFilterValues, setPage, setSortValue } = useQueryState({ category: DEFAULT_CATEGORY });
  const [items, setItems] = useState<ItemRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [subcategoryOptions, setSubcategoryOptions] = useState<{ value: string; label: string }[]>([]);
  const [jobOptions, setJobOptions] = useState<{ value: string; label: string }[]>([]);
  const perPage = 30;

  useEffect(() => {
    fetch(`${API_BASE}/api/items/categories`)
      .then((r) => r.json())
      .then((d) => {
        const cats: { value: string; label: string }[] = [
          { value: "", label: "전체" },
          { value: "One-Handed Weapon,Two-Handed Weapon", label: "무기 전체" },
        ];
        for (const c of d.categories || []) {
          cats.push({
            value: c.name,
            label: `${toCategoryKr(c.name)} (${c.count.toLocaleString()})`,
          });
        }
        setCategories(cats);
      })
      .catch(() => {});

    getItemFilters()
      .then((d) => {
        setSubcategoryOptions((d.subcategories || []).map((s) => ({ value: s, label: toSubcategoryKr(s) })));
        setJobOptions((d.jobs || []).map((j) => ({ value: j, label: JOB_KR[j] || j })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    getItems({ page, per_page: perPage, sort: sortValue || undefined, ...filterValues } as Parameters<typeof getItems>[0])
      .then((d) => { setItems(d.items || []); setTotal(d.total); })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [page, filterValues, sortValue]);

  const filters: FilterDef[] = [
    { key: "q", label: "이름 검색", type: "text", placeholder: "아이템 이름" },
    { key: "category", label: "분류", type: "select", options: categories },
    { key: "subcategory", label: "세부분류", type: subcategoryOptions.length > 0 ? "select" : "text", options: subcategoryOptions, placeholder: "세부 분류" },
    { key: "level_min", label: "최소 레벨", type: "number", placeholder: "0" },
    { key: "level_max", label: "최대 레벨", type: "number", placeholder: "200" },
    { key: "job", label: "직업", type: jobOptions.length > 0 ? "select" : "text", options: jobOptions, placeholder: "전사, 궁수..." },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">아이템</h1>

      </div>
      <FilterPanel filters={filters} values={filterValues} onChange={setFilterValues} sortOptions={sortOptions} sortValue={sortValue} onSortChange={setSortValue} />
      <div className="mt-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400">로딩 중...</div>
        ) : (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">총 {total.toLocaleString()}건</p>
            <DataTable columns={columns} data={items} onRowClick={(row) => router.push(`/items/${row.id}`)} />
            <Pagination page={page} totalPages={Math.ceil(total / perPage)} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

export default function ItemsPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-gray-400">로딩 중...</div>}>
      <ItemsPageContent />
    </Suspense>
  );
}
