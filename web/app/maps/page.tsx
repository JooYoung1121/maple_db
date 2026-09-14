"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { getMaps, getMapFilters } from "@/lib/api";
import type { MapData } from "@/lib/types";
import DatasetComparisonNotice from "@/components/DatasetComparisonNotice";
import FilterPanel, { FilterDef } from "@/components/FilterPanel";
import Pagination from "@/components/Pagination";
import { useQueryState } from "@/lib/useQueryState";

const POPULAR_MAPS = [
  { id: 240040510, label: "죽은 용의 둥지" },
  { id: 240040511, label: "남겨진 용의 둥지" },
  { id: 240040400, label: "와이번의 협곡" },
  { id: 270020300, label: "후회의 길3" },
  { id: 220050300, label: "시간의 통로" },
  { id: 105090300, label: "드레이크의 밥상" },
];
function MapsPageContent() {
  const { filterValues, page, setFilterValues, setPage } = useQueryState();
  const [maps, setMaps] = useState<MapData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [areas, setAreas] = useState<string[]>([]);
  const perPage = 30;
  useEffect(() => {
    getMapFilters()
      .then((d) => setAreas(d.regions || []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getMaps({ ...filterValues, page, per_page: perPage })
      .then((d) => {
        if (!cancelled) {
          setMaps(d.maps);
          setTotal(d.total);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMaps([]);
          setTotal(0);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filterValues, page, retry]);
  const filters: FilterDef[] = [
    {
      key: "q",
      label: "맵 이름 검색",
      type: "text",
      placeholder: "예) 남겨진 용의 둥지, 시간의 신전",
      suggestType: "map",
    },
    {
      key: "region",
      label: "지역",
      type: "select",
      options: areas.map((a) => ({ value: a, label: a })),
    },
    {
      key: "is_town",
      label: "맵 종류",
      type: "select",
      options: [
        { value: "1", label: "마을" },
        { value: "0", label: "마을 외 맵" },
      ],
    },
  ];
  return (
    <div>
      <h1 className="font-pixel text-2xl font-bold text-ink">맵 검색</h1>
      <p className="mb-5 mt-2 text-sm text-dim">
        지역별 맵을 둘러보고 몬스터 위치·젠 수·드롭 아이템을 확인하세요.
      </p>
      <DatasetComparisonNotice type="map" className="mb-4" />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-xs text-dim">자주 찾는 사냥터</span>
        {POPULAR_MAPS.map((m) => (
          <Link
            key={m.id}
            href={`/maps/${m.id}`}
            className="rounded-lg border border-edge px-3 py-2 text-xs text-ink hover:border-maple hover:text-maple"
          >
            {m.label}
          </Link>
        ))}
      </div>
      <FilterPanel
        filters={filters}
        values={filterValues}
        onChange={setFilterValues}
      />
      <div className="mt-5" aria-live="polite" aria-busy={loading}>
        {loading ? (
          <p className="py-12 text-center text-dim">맵을 불러오는 중...</p>
        ) : error ? (
          <div role="alert" className="pixel-panel p-8 text-center">
            <p>맵을 불러오지 못했습니다.</p>
            <button
              onClick={() => setRetry((v) => v + 1)}
              className="mt-3 text-maple"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-dim">
              총 {total.toLocaleString()}개
            </p>
            <div className="pixel-panel divide-y divide-edge/40">
              {maps.length ? (
                maps.map((m) => (
                  <Link
                    key={m.id}
                    href={`/maps/${m.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 hover:bg-surface2"
                  >
                    <div>
                      <span className="font-medium text-ink">
                        {m.name_kr || m.name}
                      </span>
                      {m.original_data_conflict && (
                        <span className="ml-2 text-xs text-maple">
                          원작 ID 충돌
                        </span>
                      )}
                      <p className="mt-1 text-xs text-dim">
                        {m.region_kr || m.area}{" "}
                        {m.street_name && `· ${m.street_name}`}
                      </p>
                    </div>
                    <span className="text-xs text-dim">
                      {m.is_town ? "마을 · " : ""}몬스터·드롭 보기 →
                    </span>
                  </Link>
                ))
              ) : (
                <p className="p-10 text-center text-sm text-dim">
                  조건에 맞는 맵이 없습니다. 검색어를 바꾸거나 지역 조건을
                  해제해보세요.
                </p>
              )}
            </div>
            <Pagination
              page={page}
              totalPages={Math.ceil(total / perPage)}
              onChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
export default function MapsPage() {
  return (
    <Suspense
      fallback={<div className="py-12 text-center text-dim">로딩 중...</div>}
    >
      <MapsPageContent />
    </Suspense>
  );
}
