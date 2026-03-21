"use client";

import { useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

/**
 * URL searchParams와 동기화되는 필터/페이지/정렬 상태 훅.
 * 뒤로가기 시 상태가 유지되고, URL 공유/북마크도 가능.
 */
export function useQueryState(defaults: Record<string, string> = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // defaults를 안정적으로 참조 (매 렌더마다 새 객체가 생성되어도 내용이 같으면 재계산 방지)
  const defaultsRef = useRef(defaults);
  const defaultsKey = JSON.stringify(defaults);
  useMemo(() => {
    defaultsRef.current = defaults;
  }, [defaultsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const searchParamsKey = searchParams.toString();

  // searchParams → Record<string, string> (defaults 병합)
  const filterValues = useMemo(() => {
    const defs = defaultsRef.current;
    const values: Record<string, string> = {};

    // URL에 필터 파라미터가 하나라도 있으면 URL 기준, 없으면 defaults 사용
    const filterKeys = Array.from(searchParams.keys()).filter(
      (k) => k !== "page" && k !== "sort"
    );

    if (filterKeys.length > 0) {
      // URL에서 필터값 읽기
      for (const k of filterKeys) {
        const v = searchParams.get(k);
        if (v !== null) values[k] = v;
      }
    } else {
      // URL에 필터가 없으면 defaults 적용
      for (const [k, v] of Object.entries(defs)) {
        values[k] = v;
      }
    }
    return values;
  }, [searchParamsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const page = Number(searchParams.get("page") || "1");
  const sortValue = searchParams.get("sort") || "";

  const buildUrl = useCallback(
    (params: Record<string, string | number | undefined>) => {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== "") {
          sp.set(k, String(v));
        }
      }
      const qs = sp.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname]
  );

  const setFilterValues = useCallback(
    (newFilters: Record<string, string>) => {
      const params: Record<string, string | number | undefined> = {
        ...newFilters,
        page: "1",
      };
      if (sortValue) params.sort = sortValue;
      router.push(buildUrl(params), { scroll: false });
    },
    [router, buildUrl, sortValue]
  );

  const setPage = useCallback(
    (newPage: number) => {
      const params: Record<string, string | number | undefined> = {
        ...filterValues,
      };
      if (newPage > 1) params.page = newPage;
      if (sortValue) params.sort = sortValue;
      router.push(buildUrl(params), { scroll: false });
    },
    [router, buildUrl, filterValues, sortValue]
  );

  const setSortValue = useCallback(
    (newSort: string) => {
      const params: Record<string, string | number | undefined> = {
        ...filterValues,
        page: "1",
      };
      if (newSort) params.sort = newSort;
      router.push(buildUrl(params), { scroll: false });
    },
    [router, buildUrl, filterValues]
  );

  return { filterValues, page, sortValue, setFilterValues, setPage, setSortValue };
}
