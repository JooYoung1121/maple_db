"use client";

import { useState } from "react";

export interface FilterDef {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "checkbox";
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface Props {
  filters: FilterDef[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}

export default function FilterPanel({ filters, values, onChange }: Props) {
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
                <input
                  type={f.type}
                  value={values[f.key] || ""}
                  onChange={(e) => update(f.key, e.target.value)}
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
