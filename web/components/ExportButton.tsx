"use client";

import { useState } from "react";
import { getExportUrl } from "@/lib/api";

export default function ExportButton({ entityType }: { entityType: string }) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const url = getExportUrl(entityType);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entityType}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setTimeout(() => setLoading(false), 2000);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      {loading ? "다운로드 중..." : "엑셀 다운로드"}
    </button>
  );
}
