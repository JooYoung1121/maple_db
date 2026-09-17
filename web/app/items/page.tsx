"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { getItems, getItemFilters } from "@/lib/api";
import type { Item } from "@/lib/types";
import Pagination from "@/components/Pagination";
import FilterPanel, { FilterDef, SortOption } from "@/components/FilterPanel";
import { useQueryState } from "@/lib/useQueryState";
import CanonDiffInfo from "@/components/CanonDiffInfo";
import DatasetComparisonNotice from "@/components/DatasetComparisonNotice";
import { getEntityCanonDiffs } from "@/lib/entityCanonDiffs";
import EquipmentNotes from "@/components/EquipmentNotes";
import { toCategoryKr, toSubcategoryKr } from "@/lib/translations";

const WEAPONS = "One-Handed Weapon,Two-Handed Weapon,Weapon";
const EQUIPMENT = ["Armor", "Accessory", ...WEAPONS.split(",")];
const SLOT_ORDER = [
  "Hat",
  "Top",
  "Bottom",
  "Overall",
  "Shoes",
  "Glove",
  "Gloves",
  "Cape",
  "Shield",
];
const JOBS = ["공용", "전사", "마법사", "궁수", "도적", "해적"].map((j) => ({
  value: j,
  label: j,
}));
const STAT_LABELS: Record<string, string> = {
  PAD: "공격력",
  MAD: "마력",
  PDD: "물리방어",
  MDD: "마법방어",
  STR: "STR",
  DEX: "DEX",
  INT: "INT",
  LUK: "LUK",
  MHP: "HP",
  MMP: "MP",
  HP: "HP",
  MP: "MP",
  ACC: "명중",
  EVA: "회피",
  Speed: "이동속도",
  Jump: "점프력",
};
const sortOptions: SortOption[] = [
  { value: "", label: "레벨 낮은순" },
  { value: "level_desc", label: "레벨 높은순" },
  { value: "name_asc", label: "이름순" },
];

function EquipmentCard({ item }: { item: Item }) {
  let stats: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(item.stats || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      stats = parsed;
  } catch {
    /* Missing or malformed source stats. */
  }
  const options = Object.entries(stats).filter(
    ([key, value]) =>
      !key.startsWith("req") &&
      Number.isFinite(Number(value)) &&
      Number(value) !== 0,
  );
  const requirements = Object.entries(stats).filter(
    ([key, value]) => key.startsWith("req") && Number(value) > 0,
  );
  const equipment = EQUIPMENT.includes(item.category || "");
  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-edge bg-surface p-4 transition-colors hover:border-maple">
      <Link
        href={`/items/${item.id}`}
        className="group flex items-start gap-3 rounded focus-visible:outline-2 focus-visible:outline-maple"
      >
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-surface2">
          {item.icon_url ? (
            <img
              src={item.icon_url}
              loading="lazy"
              alt=""
              className="h-11 w-11 object-contain [image-rendering:pixelated]"
            />
          ) : (
            <span className="text-2xl text-dim">◇</span>
          )}
        </div>
        <div className="min-w-0">
          <span className="text-xs font-bold text-maple">
            Lv. {item.level_req ?? 0}
          </span>
          <h2 className="mt-1 break-keep text-base font-bold leading-snug text-ink group-hover:text-maple">
            {item.name_kr || item.name}
          </h2>
          <p className="mt-1 text-xs text-dim">
            {toSubcategoryKr(item.subcategory) || toCategoryKr(item.category)} ·{" "}
            {item.job_req || "공용"}
          </p>
        </div>
      </Link>
      {getEntityCanonDiffs("item", item.id, item.name_kr || item.name).map(
        (entry) => (
          <CanonDiffInfo key={entry.id} entry={entry} compact align="left" />
        ),
      )}
      {equipment && (
        <div className="mt-4 border-t border-edge pt-3">
          <p className="mb-2 text-xs font-semibold text-dim">기본 옵션</p>
          <div className="flex flex-wrap gap-1.5">
            {options.length ? (
              options.map(([key, value]) => (
                <span
                  key={key}
                  className="rounded bg-surface2 px-2 py-1 text-xs text-ink"
                >
                  {STAT_LABELS[key.replace(/^inc/, "")] || key}{" "}
                  {Number(value) > 0 ? "+" : ""}
                  {String(value)}
                </span>
              ))
            ) : (
              <span className="text-xs text-dim">등록된 옵션 정보 없음</span>
            )}
          </div>
          {requirements.length > 0 && (
            <p className="mt-2 text-xs leading-relaxed text-dim">
              착용 조건 ·{" "}
              {requirements
                .map(
                  ([k, v]) => `${STAT_LABELS[k.slice(3)] || k.slice(3)} ${v}`,
                )
                .join(" · ")}
            </p>
          )}
        </div>
      )}
      <div className="mt-4 flex-1 border-t border-edge pt-3">
        {item.catalog_notes && <EquipmentNotes notes={item.catalog_notes} compact />}
        <p className="mb-2 text-xs font-semibold text-dim">
          드롭 몬스터 {item.drop_count ? `· ${item.drop_count}종` : ""}
        </p>
        {item.drop_sources?.length ? (
          <ul className="space-y-1.5">
            {item.drop_sources.map((m) => (
              <li key={m.mob_id}>
                <Link
                  href={`/mobs/${m.mob_id}`}
                  className="text-sm text-ink hover:text-maple hover:underline"
                >
                  {m.mob_name_kr || m.mob_name}{" "}
                  <span className="text-xs text-dim">Lv. {m.level}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-dim">등록된 드롭 정보 없음</p>
        )}
      </div>
      <Link
        href={`/items/${item.id}`}
        className="mt-4 text-sm font-medium text-maple hover:underline"
      >
        {(item.drop_count || 0) > 3 ? `드롭 ${item.drop_count}종 · ` : ""}상세
        정보·사냥터 보기 →
      </Link>
    </article>
  );
}

function ItemsPageContent() {
  const {
    filterValues,
    page,
    sortValue,
    setFilterValues,
    setPage,
    setSortValue,
  } = useQueryState({ equipment_only: "1" });
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [metadata, setMetadata] = useState<Awaited<
    ReturnType<typeof getItemFilters>
  > | null>(null);
  const perPage = 36;
  const equipment =
    filterValues.equipment_only !== "0" &&
    (!filterValues.category ||
      filterValues.category.split(",").every((c) => EQUIPMENT.includes(c)));
  useEffect(() => {
    getItemFilters()
      .then(setMetadata)
      .catch(() => {});
  }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getItems({
      ...filterValues,
      include_common: filterValues.exclusive_job === "1" ? 0 : 1,
      equipment_only: equipment ? 1 : 0,
      page,
      per_page: perPage,
      sort: sortValue || "level_asc",
    } as Parameters<typeof getItems>[0])
      .then((d) => {
        if (!cancelled) {
          setItems(d.items || []);
          setTotal(d.total);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
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
  }, [page, filterValues, sortValue, equipment, retry]);
  const selectedCategories = filterValues.category
    ? filterValues.category.split(",")
    : equipment
      ? EQUIPMENT
      : metadata?.categories || [];
  const subcategories = [
    ...new Set(
      selectedCategories.flatMap(
        (c) => metadata?.subcategories_by_category?.[c] || [],
      ),
    ),
  ];
  subcategories.sort((a, b) => {
    const ai = SLOT_ORDER.indexOf(a);
    const bi = SLOT_ORDER.indexOf(b);
    return (
      (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) ||
      toSubcategoryKr(a).localeCompare(toSubcategoryKr(b), "ko")
    );
  });
  const categories = equipment
    ? [
        { value: WEAPONS, label: "무기" },
        { value: "Armor", label: "방어구" },
        { value: "Accessory", label: "장신구" },
      ]
    : (metadata?.categories || []).map((c) => ({
        value: c,
        label: toCategoryKr(c),
      }));
  const filters: FilterDef[] = [
    {
      key: "q",
      label: "이름 검색",
      type: "text",
      placeholder: "장비·아이템 이름 입력",
      suggestType: "item",
    },
    ...(equipment
      ? [{ key: "job", label: "직업", type: "select" as const, options: JOBS }]
      : []),
    { key: "category", label: "구분", type: "select", options: categories },
    ...(subcategories.length
      ? [
          {
            key: "subcategory",
            label: "상세 부위·종류",
            type: "select" as const,
            options: subcategories.map((s) => ({
              value: s,
              label: toSubcategoryKr(s),
            })),
          },
        ]
      : []),
    { key: "level_min", label: "최소 레벨", type: "number" },
    { key: "level_max", label: "최대 레벨", type: "number" },
    ...(equipment && filterValues.job && filterValues.job !== "공용"
      ? [
          {
            key: "exclusive_job",
            label: "공용 장비 제외",
            type: "checkbox" as const,
            placeholder: "공용 장비를 제외하고 직업 전용 장비만 보기",
          },
        ]
      : []),
  ];
  function update(next: Record<string, string>) {
    if (next.category !== filterValues.category)
      next = { ...next, subcategory: "" };
    if (!next.job || next.job === "공용")
      next = { ...next, exclusive_job: "" };
    setFilterValues({ ...next, equipment_only: equipment ? "1" : "0" });
  }
  const grouped = equipment && (!sortValue || sortValue.startsWith("level"));
  const levels = [...new Set(items.map((i) => i.level_req || 0))];
  return (
    <div>
      <h1 className="font-pixel text-2xl font-bold text-ink">
        아이템 · 장비 도감
      </h1>
      <p className="mb-5 mt-2 text-sm text-dim">
        직업과 부위를 고르면 레벨별 장비, 기본 옵션, 드롭처를 한눈에 볼 수
        있어요. 공용 장비도 같은 착용 레벨 구간에 함께 표시합니다. 목걸이는 장신구에 포함돼요.
      </p>
      <div className="mb-4 flex flex-wrap gap-2" aria-label="아이템 탐색 방식">
        {[
          { label: "직업별 장비", value: "1" },
          { label: "전체 아이템", value: "0" },
        ].map((tab) => (
          <button
            type="button"
            key={tab.value}
            aria-pressed={equipment === (tab.value === "1")}
            onClick={() =>
              setFilterValues({
                equipment_only: tab.value,
                q: filterValues.q || "",
              })
            }
            className={`min-h-11 rounded-lg border px-5 py-2 text-sm font-bold ${equipment === (tab.value === "1") ? "border-maple bg-surface2 text-maple" : "border-edge text-dim"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <DatasetComparisonNotice type="item" className="mb-4" />
      <FilterPanel
        filters={filters}
        values={filterValues}
        onChange={update}
        sortOptions={sortOptions}
        sortValue={sortValue}
        onSortChange={setSortValue}
      />
      <div className="mt-6" aria-live="polite" aria-busy={loading}>
        {loading ? (
          <p className="py-12 text-center text-dim">장비를 불러오는 중...</p>
        ) : error ? (
          <div className="pixel-panel p-8 text-center">
            <p>아이템을 불러오지 못했습니다.</p>
            <button
              onClick={() => setRetry((v) => v + 1)}
              className="mt-3 text-maple"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-ink">
                총{" "}
                <strong className="text-maple">{total.toLocaleString()}</strong>
                개 {filterValues.job && `· ${filterValues.job}`}
              </p>
              <span className="text-xs text-dim">
                기본 옵션 기준 · 드롭 몬스터를 누르면 사냥터 확인
              </span>
            </div>
            {!items.length ? (
              <div className="pixel-panel p-10 text-center">
                <p className="text-ink">조건에 맞는 아이템이 없습니다.</p>
                <p className="mt-2 text-sm text-dim">
                  레벨 범위를 넓히거나 직업·부위 조건을 해제해보세요.
                </p>
                {equipment && filterValues.q && <button onClick={() => setFilterValues({ equipment_only: "0", q: filterValues.q })} className="mt-4 block w-full text-sm text-maple">같은 이름으로 전체 아이템 검색 · 퀘스트 재료·소비 아이템 포함 →</button>}
                <button
                  onClick={() =>
                    setFilterValues({ equipment_only: equipment ? "1" : "0" })
                  }
                  className="mt-4 text-sm text-maple"
                >
                  검색 조건 초기화
                </button>
              </div>
            ) : grouped ? (
              levels.map((level) => (
                <section key={level} className="mb-7">
                  <h2 className="mb-3 flex items-center gap-3 text-sm font-bold text-ink">
                    <span className="rounded-lg bg-surface2 px-3 py-2 text-maple">
                      Lv. {level}
                    </span>
                    레벨 {level} 장비
                    <span className="h-px flex-1 bg-edge" />
                  </h2>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {items
                      .filter((i) => (i.level_req || 0) === level)
                      .map((i) => (
                        <EquipmentCard key={i.id} item={i} />
                      ))}
                  </div>
                </section>
              ))
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((i) => (
                  <EquipmentCard key={i.id} item={i} />
                ))}
              </div>
            )}
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
export default function ItemsPage() {
  return (
    <Suspense
      fallback={<div className="py-12 text-center text-dim">로딩 중...</div>}
    >
      <ItemsPageContent />
    </Suspense>
  );
}
