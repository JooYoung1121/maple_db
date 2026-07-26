"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getWeeklyIssues } from "@/lib/api";
import type { WeeklyIssueSummary } from "@/lib/types";
import { WeeklyArchiveGrid } from "../ArchiveNavigation";

const PAGE_SIZE = 100;

async function getAllIssues() {
  const first = await getWeeklyIssues({ page: 1, per_page: PAGE_SIZE });
  const pageCount = Math.ceil(first.total / PAGE_SIZE);
  if (pageCount <= 1) return first.issues;
  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      getWeeklyIssues({ page: index + 2, per_page: PAGE_SIZE })
    )
  );
  return [...first.issues, ...rest.flatMap((page) => page.issues)];
}

export default function WeeklyArchiveClient() {
  const [issues, setIssues] = useState<WeeklyIssueSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getAllIssues()
      .then(setIssues)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <header className="pixel-panel p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-xs text-dim tracking-widest mb-1">MAPLELAND WEEKLY ARCHIVE</p>
            <h1 className="font-pixel text-2xl font-bold text-maple">주간 메랜 과월호</h1>
            <p className="text-sm text-dim mt-2">
              표지와 발행 주차를 보고 지난 메이플랜드 소식을 골라보세요.
            </p>
          </div>
          <Link href="/weekly" className="pixel-btn px-4 py-2 text-sm text-center">
            최신호 보기
          </Link>
        </div>
      </header>

      {loading && (
        <div className="flex items-center gap-2 py-12 justify-center text-dim text-sm">
          <div className="w-4 h-4 border-2 border-edge border-t-maple rounded-full animate-spin" />
          과월호 서가를 정리하는 중...
        </div>
      )}

      {!loading && failed && (
        <div className="pixel-panel p-8 text-center text-sm text-dim">
          과월호 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </div>
      )}

      {!loading && !failed && issues.length === 0 && (
        <div className="pixel-panel p-8 text-center text-sm text-dim">
          아직 보관된 과월호가 없습니다.
        </div>
      )}

      {!loading && !failed && issues.length > 0 && (
        <>
          <p className="text-xs text-dim text-right">총 {issues.length}개 발행본</p>
          <WeeklyArchiveGrid issues={issues} />
        </>
      )}
    </div>
  );
}
