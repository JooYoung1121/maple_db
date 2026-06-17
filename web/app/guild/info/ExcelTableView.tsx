"use client";

import React from "react";

export interface ExcelCell {
  v?: string;
  hidden?: boolean;
  rowspan?: number;
  colspan?: number;
  bg?: string;
  color?: string;
  bold?: boolean;
  align?: string;
}
export interface ExcelSheet {
  name: string;
  ncols: number;
  rows: ExcelCell[][];
}

export function renderLines(v?: string, hl?: string) {
  const text = v ?? "";
  const lines = text.split("\n");
  return lines.map((line, i, arr) => (
    <span key={i}>
      {hl ? highlight(line, hl) : line}
      {i < arr.length - 1 && <br />}
    </span>
  ));
}

function highlight(line: string, q: string) {
  const lower = line.toLowerCase();
  const ql = q.toLowerCase();
  if (!ql || !lower.includes(ql)) return line;
  const parts: React.ReactNode[] = [];
  let idx = 0;
  while (true) {
    const found = lower.indexOf(ql, idx);
    if (found === -1) { parts.push(line.slice(idx)); break; }
    if (found > idx) parts.push(line.slice(idx, found));
    parts.push(<mark key={found} className="xl-search-hl">{line.slice(found, found + ql.length)}</mark>);
    idx = found + ql.length;
  }
  return <>{parts}</>;
}

interface FlatCell { v?: string; colspan?: number; bold?: boolean; align?: string; }

/** 표 뷰: 세로 병합셀을 펼쳐(상위 항목을 각 행에 채움) 검색 가능한 평면 표로 렌더. 1행은 헤더로 고정. */
export function ExcelTableView({ sheet, query }: { sheet: ExcelSheet; query?: string }) {
  if (!sheet) return null;
  const ncols = sheet.ncols;
  type Carry = { col0: number; col1: number; startRow: number; endRow: number; cell: ExcelCell };
  let carries: Carry[] = [];
  const flat: FlatCell[][] = [];

  for (let r = 0; r < sheet.rows.length; r++) {
    carries = carries.filter((k) => k.endRow >= r);
    const rowOut: FlatCell[] = [];
    let c = 0;
    while (c < ncols) {
      const car = carries.find((k) => c >= k.col0 && c <= k.col1 && k.startRow < r && k.endRow >= r);
      if (car) {
        if (c === car.col0)
          rowOut.push({ v: car.cell.v, colspan: car.col1 - car.col0 + 1, bold: car.cell.bold, align: car.cell.align });
        c = car.col1 + 1;
        continue;
      }
      const cell = sheet.rows[r]?.[c];
      if (!cell || cell.hidden) { c++; continue; }
      const cs = cell.colspan ?? 1;
      const rs = cell.rowspan ?? 1;
      rowOut.push({ v: cell.v, colspan: cs, bold: cell.bold, align: cell.align });
      if (rs > 1) carries.push({ col0: c, col1: c + cs - 1, startRow: r, endRow: r + rs - 1, cell });
      c += cs;
    }
    flat.push(rowOut);
  }

  const header = flat[0] ?? [];
  const body = flat.slice(1);
  const q = (query ?? "").trim();
  const ql = q.toLowerCase();
  const filtered = ql ? body.filter((row) => row.some((cell) => (cell.v ?? "").toLowerCase().includes(ql))) : body;

  return (
    <table className="xl-clean">
      <thead>
        <tr>
          {header.map((cell, ci) => (
            <th key={ci} colSpan={cell.colspan} style={{ textAlign: (cell.align as React.CSSProperties["textAlign"]) || "left" }}>
              {renderLines(cell.v)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filtered.length === 0 ? (
          <tr><td colSpan={ncols} className="text-center text-gray-400 py-4">검색 결과 없음</td></tr>
        ) : (
          filtered.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} colSpan={cell.colspan}
                    style={{ textAlign: (cell.align as React.CSSProperties["textAlign"]) || "left", fontWeight: cell.bold ? 700 : undefined }}>
                  {renderLines(cell.v, q)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
