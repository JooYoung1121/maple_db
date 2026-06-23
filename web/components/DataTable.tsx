"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Column<T = any> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

interface Props<T = any> {
  columns: Column<T>[];
  data: T[];
  sortBy?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
}

export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  sortBy,
  sortDir,
  onSort,
  onRowClick,
}: Props<T>) {
  return (
    <div className="overflow-x-auto pixel-panel">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface2 border-b-2 border-edge">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => col.sortable !== false && onSort?.(col.key)}
                className={`font-pixel px-4 py-3 text-left text-[12px] text-dim ${col.sortable !== false ? "cursor-pointer hover:text-maple select-none" : ""}`}
              >
                {col.label}
                {sortBy === col.key && (
                  <span className="ml-1 text-maple">{sortDir === "asc" ? "▲" : "▼"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-dim">
                데이터가 없습니다
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={i}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-edge/40 ${onRowClick ? "cursor-pointer hover:bg-[color-mix(in_srgb,var(--c-maple)_12%,transparent)]" : ""} ${i % 2 === 0 ? "bg-surface" : "bg-surface2"}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-ink">
                    {col.render ? col.render(row) : String(row[col.key] ?? "-")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
