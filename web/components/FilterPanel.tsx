"use client";

import { useEffect, useId, useRef, useState } from "react";
import { searchSuggest } from "@/lib/api";
import type { SearchSuggestion } from "@/lib/types";

export interface SortOption {
  value: string;
  label: string;
}
export interface FilterDef {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "checkbox" | "toggle";
  options?: SortOption[];
  placeholder?: string;
  suggestType?: "item" | "mob" | "map" | "npc" | "quest" | "skill";
}
interface Props {
  filters: FilterDef[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  sortOptions?: SortOption[];
  sortValue?: string;
  onSortChange?: (value: string) => void;
}

export function FilterChoices({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SortOption[];
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const choices = [
    { value: "", label: "전체" },
    ...options.filter((o) => o.value !== ""),
  ];
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold text-ink">{label}</legend>
      {choices.length > 14 && (
        <input
          aria-label={`${label} 선택지 검색`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`${label} 찾기`}
          className="pixel-input mb-2 w-full px-3 py-2 text-sm"
        />
      )}
      <div
        className={`flex flex-wrap gap-2 ${choices.length > 14 ? "max-h-44 overflow-y-auto p-1" : ""}`}
      >
        {choices
          .filter((o) => !query || o.label.includes(query) || o.value === value)
          .map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={value === o.value}
              onClick={() => onChange(o.value)}
              className={`min-h-10 rounded-lg border px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-maple ${value === o.value ? "border-maple bg-[color-mix(in_srgb,var(--c-maple)_14%,var(--c-surface))] font-semibold text-maple" : "border-edge bg-surface2 text-ink hover:border-maple"}`}
            >
              {o.label}
            </button>
          ))}
      </div>
    </fieldset>
  );
}

function SearchInput({
  filter,
  value,
  onChange,
  onSubmit,
}: {
  filter: FilterDef;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}) {
  const id = useId();
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const focused = useRef(false);
  useEffect(() => {
    let cancelled = false;
    setSuggestions([]);
    setActive(-1);
    if (!value.trim() || !filter.suggestType) return;
    const timer = setTimeout(() => {
      searchSuggest(value, 8, filter.suggestType)
        .then((data) => {
          if (!cancelled) {
            setSuggestions(data.suggestions);
            setOpen(focused.current);
          }
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, filter.suggestType]);
  function select(s: SearchSuggestion) {
    setOpen(false);
    onSubmit(s.name_kr || s.name);
  }
  return (
    <div className="relative">
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-ink">
        {filter.label}
      </label>
      <input
        id={id}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={`${id}-options`}
        aria-activedescendant={
          open && active >= 0 ? `${id}-${active}` : undefined
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={filter.placeholder}
        onFocus={() => {
          focused.current = true;
          setOpen(true);
        }}
        onBlur={() => {
          focused.current = false;
          setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }
          if (
            open &&
            suggestions.length &&
            (e.key === "ArrowDown" || e.key === "ArrowUp")
          ) {
            e.preventDefault();
            setActive(
              (prev) =>
                (prev +
                  (e.key === "ArrowDown" ? 1 : suggestions.length - 1) +
                  suggestions.length) %
                suggestions.length,
            );
          }
          if (e.key === "Enter") {
            e.preventDefault();
            if (open && active >= 0) select(suggestions[active]);
            else {
              setOpen(false);
              onSubmit(value);
            }
          }
        }}
        className="pixel-input w-full px-4 py-3 text-base"
      />
      {open && suggestions.length > 0 && (
        <div
          id={`${id}-options`}
          role="listbox"
          aria-label="검색 제안"
          className="pixel-panel absolute z-50 mt-1 max-h-72 w-full overflow-y-auto"
        >
          {suggestions.map((s, i) => (
            <button
              key={s.entity_id}
              id={`${id}-${i}`}
              type="button"
              role="option"
              aria-selected={active === i}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(s)}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm ${active === i ? "bg-surface2 text-maple" : "text-ink"}`}
            >
              {s.icon_url && (
                <img
                  src={s.icon_url}
                  alt=""
                  className="h-7 w-7 object-contain"
                />
              )}
              <span>{s.name_kr || s.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FilterPanel({
  filters,
  values,
  onChange,
  sortOptions,
  sortValue,
  onSortChange,
}: Props) {
  const [draft, setDraft] = useState(values);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState("");
  const id = useId();
  useEffect(() => {
    setDraft(values);
    setError("");
  }, [values]);
  const active = filters.filter(
    (f) => values[f.key] !== undefined && values[f.key] !== "",
  );
  const hasLevels =
    filters.some((f) => f.key === "level_min") &&
    filters.some((f) => f.key === "level_max");
  function apply(next: Record<string, string>) {
    if (
      hasLevels &&
      ((next.level_min && !/^\d+$/.test(next.level_min)) ||
        (next.level_max && !/^\d+$/.test(next.level_max)))
    ) {
      setError("레벨은 0 이상의 정수로 입력해주세요.");
      return;
    }
    if (
      hasLevels &&
      next.level_min &&
      next.level_max &&
      Number(next.level_min) > Number(next.level_max)
    ) {
      setError("최소 레벨은 최대 레벨보다 작거나 같아야 합니다.");
      return;
    }
    setError("");
    setDraft(next);
    onChange(next);
  }
  function change(key: string, value: string) {
    apply({ ...draft, [key]: value });
  }
  return (
    <form
      className="pixel-panel p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        apply(draft);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={`${id}-filters`}
          onClick={() => setExpanded(!expanded)}
          className="py-1 text-sm font-bold text-ink"
        >
          검색 조건{" "}
          {active.length > 0 && (
            <span className="text-maple">{active.length}</span>
          )}{" "}
          <span className="ml-2 text-dim">
            {expanded ? "접기 ▴" : "펼치기 ▾"}
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            const next = { ...values };
            filters.forEach((f) => {
              delete next[f.key];
            });
            apply(next);
          }}
          className="min-h-10 px-2 text-sm text-maple hover:underline"
        >
          조건 초기화
        </button>
      </div>
      {expanded && (
        <div id={`${id}-filters`} className="mt-3 space-y-4">
          {filters
            .filter((f) => f.type === "text")
            .map((f) => (
              <SearchInput
                key={f.key}
                filter={f}
                value={draft[f.key] || ""}
                onChange={(v) => setDraft({ ...draft, [f.key]: v })}
                onSubmit={(v) => change(f.key, v)}
              />
            ))}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filters
              .filter((f) => f.type === "select")
              .map((f) => (
                <div
                  key={f.key}
                  className={
                    f.key === "subcategory" || (f.options?.length || 0) > 8
                      ? "lg:col-span-2"
                      : ""
                  }
                >
                  <FilterChoices
                    label={f.label}
                    value={draft[f.key] || ""}
                    options={f.options || []}
                    onChange={(v) => change(f.key, v)}
                  />
                </div>
              ))}
          </div>
          {hasLevels && (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink">
                레벨 범위
              </legend>
              <div className="mb-3 flex flex-wrap gap-2">
                {[
                  ["전체", "", ""],
                  ["1–30", "1", "30"],
                  ["31–70", "31", "70"],
                  ["71–120", "71", "120"],
                  ["121 이상", "121", ""],
                ].map(([label, min, max]) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={
                      (draft.level_min || "") === min &&
                      (draft.level_max || "") === max
                    }
                    onClick={() =>
                      apply({ ...draft, level_min: min, level_max: max })
                    }
                    className={`min-h-10 rounded-lg border px-3 py-2 text-sm ${(draft.level_min || "") === min && (draft.level_max || "") === max ? "border-maple text-maple bg-surface2" : "border-edge text-ink"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex max-w-sm items-center gap-2">
                {["level_min", "level_max"].map((key, i) => (
                  <div className="min-w-0 flex-1" key={key}>
                    <label
                      htmlFor={`${id}-${key}`}
                      className="mb-1 block text-xs text-dim"
                    >
                      {i === 0 ? "최소 레벨" : "최대 레벨"}
                    </label>
                    <input
                      id={`${id}-${key}`}
                      type="number"
                      min="0"
                      step="1"
                      value={draft[key] || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, [key]: e.target.value })
                      }
                      placeholder="제한 없음"
                      className="pixel-input w-full px-3 py-2 text-sm"
                    />
                  </div>
                ))}
              </div>
            </fieldset>
          )}
          {filters
            .filter(
              (f) =>
                f.type === "number" &&
                (!hasLevels || !["level_min", "level_max"].includes(f.key)),
            )
            .map((f) => (
              <label key={f.key} className="block text-sm">
                {f.label}
                <input
                  aria-label={f.label}
                  type="number"
                  value={draft[f.key] || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, [f.key]: e.target.value })
                  }
                  placeholder={f.placeholder}
                  className="pixel-input ml-2 px-3 py-2"
                />
              </label>
            ))}
          <div className="flex flex-wrap gap-4">
            {filters
              .filter((f) => ["checkbox", "toggle"].includes(f.type))
              .map((f) => (
                <label
                  key={f.key}
                  className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-ink"
                >
                  <input
                    type="checkbox"
                    checked={draft[f.key] === "1"}
                    onChange={(e) => change(f.key, e.target.checked ? "1" : "")}
                    className="h-4 w-4 accent-[var(--c-maple)]"
                  />
                  {f.placeholder || f.label}
                </label>
              ))}
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-edge pt-4">
            {sortOptions && (
              <label className="text-sm text-dim">
                정렬
                <select
                  aria-label="정렬"
                  value={sortValue || ""}
                  onChange={(e) => onSortChange?.(e.target.value)}
                  className="pixel-input ml-2 max-w-full px-3 py-2 text-sm text-ink"
                >
                  {sortOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-maple px-6 py-2 font-semibold text-white dark:text-black"
            >
              검색하기
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-mush">
          {error}
        </p>
      )}
      {active.length > 0 && (
        <div
          className="mt-4 flex flex-wrap items-center gap-2 border-t border-edge pt-3"
          aria-label="적용된 검색 조건"
        >
          <span className="text-xs text-dim">적용 중</span>
          {active.map((f) => (
            <button
              type="button"
              key={f.key}
              onClick={() => apply({ ...values, [f.key]: "" })}
              aria-label={`${f.label} 조건 해제`}
              className="min-h-9 rounded-full border border-edge bg-surface2 px-3 py-1 text-xs text-ink"
            >
              {f.label}:{" "}
              {f.options?.find((o) => o.value === values[f.key])?.label ||
                (["checkbox", "toggle"].includes(f.type)
                  ? "켜짐"
                  : values[f.key])}
              <span className="ml-2 text-maple">×</span>
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
