"use client";

import { useState, useEffect, useRef, useCallback } from "react";

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

export default function FilterPanel({ filters, values, onChange, sortOptions, sortValue, onSortChange }: Props) {
  const [expanded, setExpanded] = useState(true);

  function update(key: string, value: string) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-sm font-semibold text-gray-700"
      >
        <span>필터</span>
        <span>{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sortOptions && sortOptions.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">정렬</label>
              <select
                value={sortValue || ""}
                onChange={(e) => onSortChange?.(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              >
                {sortOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}
          {filters.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
              {f.type === "select" ? (
                <select
                  value={values[f.key] || ""}
                  onChange={(e) => update(f.key, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
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
                  <div className={`relative w-11 h-6 rounded-full transition-colors ${values[f.key] === "1" ? "bg-orange-500" : "bg-gray-300"}`}>
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${values[f.key] === "1" ? "translate-x-5" : "translate-x-0"}`} />
                  </div>
                  <span className="text-sm text-gray-600">{f.placeholder || "예"}</span>
                </button>
              ) : f.type === "checkbox" ? (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={values[f.key] === "1"}
                    onChange={(e) => update(f.key, e.target.checked ? "1" : "")}
                    className="rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                  />
                  <span className="text-sm text-gray-600">{f.placeholder || "예"}</span>
                </label>
              ) : (
                <DebouncedInput
                  type={f.type}
                  value={values[f.key] || ""}
                  onChange={(v) => update(f.key, v)}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
