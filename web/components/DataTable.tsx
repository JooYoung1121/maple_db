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
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => col.sortable !== false && onSort?.(col.key)}
                className={`px-4 py-3 text-left font-semibold text-gray-600 ${col.sortable !== false ? "cursor-pointer hover:text-orange-600 select-none" : ""}`}
              >
                {col.label}
                {sortBy === col.key && (
                  <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400">
                데이터가 없습니다
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={i}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-gray-100 ${onRowClick ? "cursor-pointer hover:bg-orange-50" : ""} ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-gray-700">
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
