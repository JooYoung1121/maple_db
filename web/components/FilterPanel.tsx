"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  options?: { value: string; label: string }[];
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

/** text/number 입력용 debounced input */
function DebouncedInput({
  value,
  onChange,
  type,
  placeholder,
  className,
  delay = 400,
}: {
  value: string;
  onChange: (v: string) => void;
  type: string;
  placeholder?: string;
  className?: string;
  delay?: number;
}) {
  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // 외부 value가 바뀌면 local 동기화 (뒤로가기 등)
  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleChange = useCallback(
    (v: string) => {
      setLocal(v);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => onChangeRef.current(v), delay);
    },
    [delay]
  );

  // 언마운트 시 pending timer flush
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <input
      type={type}
      value={local}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  );
}

function SuggestionInput({
  value,
  onChange,
  placeholder,
  className,
  suggestType,
  delay = 350,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  suggestType: NonNullable<FilterDef["suggestType"]>;
  delay?: number;
}) {
  const [local, setLocal] = useState(value);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);
  const ref = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchSuggestions = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      try {
        const data = await searchSuggest(q, 8, suggestType);
        setSuggestions(data.suggestions);
        setOpen(data.suggestions.length > 0);
        setActiveIndex(-1);
      } catch {
        setSuggestions([]);
        setOpen(false);
      }
    },
    [suggestType]
  );

  const handleChange = useCallback(
    (v: string) => {
      setLocal(v);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        onChangeRef.current(v);
        void fetchSuggestions(v);
      }, delay);
      if (!v.trim()) {
        setSuggestions([]);
        setOpen(false);
      }
    },
    [delay, fetchSuggestions]
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function applySuggestion(s: SearchSuggestion) {
    const next = s.name_kr || s.name;
    if (timer.current) clearTimeout(timer.current);
    setLocal(next);
    setOpen(false);
    setActiveIndex(-1);
    onChangeRef.current(next);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter" && !e.nativeEvent.isComposing) onChangeRef.current(local);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (activeIndex >= 0) applySuggestion(suggestions[activeIndex]);
      else onChangeRef.current(local);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
          else void fetchSuggestions(local);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
      />
      {open && suggestions.length > 0 && (
        <div className="pixel-panel absolute z-50 mt-2 w-full max-h-72 overflow-y-auto">
          {suggestions.map((s, idx) => (
            <button
              key={`${s.entity_type}-${s.entity_id}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applySuggestion(s)}
              onMouseEnter={() => setActiveIndex(idx)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                idx === activeIndex
                  ? "bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] text-maple"
                  : "text-ink hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]"
              }`}
            >
              {s.icon_url && <img src={s.icon_url} alt="" className="h-6 w-6 flex-shrink-0 object-contain" />}
              <span className="min-w-0 flex-1 truncate">{s.name_kr || s.name}</span>
              {s.name_kr && s.name_kr !== s.name && (
                <span className="hidden max-w-28 truncate text-xs text-dim sm:inline">{s.name}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FilterPanel({ filters, values, onChange, sortOptions, sortValue, onSortChange }: Props) {
  const [expanded, setExpanded] = useState(true);

  function update(key: string, value: string) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="pixel-panel p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="font-pixel flex items-center justify-between w-full text-[13px] text-ink"
      >
        <span>필터</span>
        <span className="text-maple">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sortOptions && sortOptions.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-dim mb-1">정렬</label>
              <select
                value={sortValue || ""}
                onChange={(e) => onSortChange?.(e.target.value)}
                className="pixel-input w-full px-3 py-2 text-sm"
              >
                {sortOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}
          {filters.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-dim mb-1">{f.label}</label>
              {f.type === "select" ? (
                <select
                  value={values[f.key] || ""}
                  onChange={(e) => update(f.key, e.target.value)}
                  className="pixel-input w-full px-3 py-2 text-sm"
                >
                  <option value="">전체</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : f.type === "toggle" ? (
                <button
                  type="button"
                  onClick={() => update(f.key, values[f.key] === "1" ? "" : "1")}
                  className="flex items-center gap-2"
                >
                  <div className={`relative w-11 h-6 rounded-full transition-colors ${values[f.key] === "1" ? "bg-maple" : "bg-edge"}`}>
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${values[f.key] === "1" ? "translate-x-5" : "translate-x-0"}`} />
                  </div>
                  <span className="text-sm text-dim">{f.placeholder || "예"}</span>
                </button>
              ) : f.type === "checkbox" ? (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={values[f.key] === "1"}
                    onChange={(e) => update(f.key, e.target.checked ? "1" : "")}
                    className="rounded border-edge text-maple focus:ring-maple"
                  />
                  <span className="text-sm text-dim">{f.placeholder || "예"}</span>
                </label>
              ) : f.suggestType && f.type === "text" ? (
                <SuggestionInput
                  value={values[f.key] || ""}
                  onChange={(v) => update(f.key, v)}
                  placeholder={f.placeholder}
                  suggestType={f.suggestType}
                  className="pixel-input w-full px-3 py-2 text-sm"
                />
              ) : (
                <DebouncedInput
                  type={f.type}
                  value={values[f.key] || ""}
                  onChange={(v) => update(f.key, v)}
                  placeholder={f.placeholder}
                  className="pixel-input w-full px-3 py-2 text-sm"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
