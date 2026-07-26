"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WeeklyIssueSummary } from "@/lib/types";

function formatDate(value: string) {
  return value.replaceAll("-", ".");
}

export function issueShortTitle(issue: WeeklyIssueSummary) {
  return issue.title
    .replace(/^주간\s*메랜(?:\s*제\d+호)?\s*(?:—|-)?\s*/, "")
    .trim();
}

function sortedIssues(issues: WeeklyIssueSummary[]) {
  return [...issues].sort((a, b) => b.issue_no - a.issue_no);
}

export function WeeklyIssueNavigator({
  issues,
  currentIssueNo,
  showRecent = false,
}: {
  issues: WeeklyIssueSummary[];
  currentIssueNo: number;
  showRecent?: boolean;
}) {
  const router = useRouter();
  const ordered = sortedIssues(issues);
  const currentIndex = ordered.findIndex((issue) => issue.issue_no === currentIssueNo);
  const newer = currentIndex > 0 ? ordered[currentIndex - 1] : null;
  const older =
    currentIndex >= 0 && currentIndex < ordered.length - 1
      ? ordered[currentIndex + 1]
      : null;
  const recent = ordered.filter((issue) => issue.issue_no !== currentIssueNo).slice(0, 4);

  return (
    <div className="space-y-3">
      <nav
        aria-label="주간 메랜 과월호 탐색"
        className="pixel-panel p-3 flex flex-wrap items-center justify-center gap-2 sm:gap-3"
      >
        {older ? (
          <Link
            href={`/weekly/${older.issue_no}`}
            className="pixel-btn px-3 py-1.5 text-xs"
            aria-label={`이전 호 제${older.issue_no}호 보기`}
          >
            ← 제{older.issue_no}호
          </Link>
        ) : (
          <span className="px-3 py-1.5 text-xs text-dim border border-edge" aria-disabled>
            창간호
          </span>
        )}

        <label className="flex items-center gap-2 text-xs text-dim">
          <span className="font-pixel">호수 선택</span>
          <select
            value={currentIssueNo}
            onChange={(event) => router.push(`/weekly/${event.target.value}`)}
            className="pixel-input min-w-36 px-2 py-1.5 text-sm text-ink"
            aria-label="읽을 주간 메랜 호수 선택"
          >
            {ordered.map((issue) => (
              <option key={issue.issue_no} value={issue.issue_no}>
                제{issue.issue_no}호 · {formatDate(issue.week_start)}
              </option>
            ))}
          </select>
        </label>

        {newer ? (
          <Link
            href={`/weekly/${newer.issue_no}`}
            className="pixel-btn px-3 py-1.5 text-xs"
            aria-label={`다음 호 제${newer.issue_no}호 보기`}
          >
            제{newer.issue_no}호 →
          </Link>
        ) : (
          <span className="px-3 py-1.5 text-xs font-pixel text-maple border border-maple">
            최신호
          </span>
        )}

        <Link
          href="/weekly/archive"
          className="text-xs text-maple hover:underline px-2 py-1.5"
        >
          전체 과월호
        </Link>
      </nav>

      {showRecent && recent.length > 0 && (
        <section className="pixel-panel p-4" aria-labelledby="recent-weekly-heading">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 id="recent-weekly-heading" className="font-pixel text-sm font-bold text-ink">
              최근 지난 호
            </h2>
            <Link href="/weekly/archive" className="text-xs text-maple hover:underline">
              전체 보기 →
            </Link>
          </div>
          <WeeklyArchiveGrid issues={recent} compact />
        </section>
      )}
    </div>
  );
}

export function WeeklyArchiveGrid({
  issues,
  compact = false,
}: {
  issues: WeeklyIssueSummary[];
  compact?: boolean;
}) {
  const ordered = sortedIssues(issues);
  return (
    <div
      className={
        compact
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      }
    >
      {ordered.map((issue) => (
        <Link
          key={issue.issue_no}
          href={`/weekly/${issue.issue_no}`}
          className="pixel-card overflow-hidden group bg-surface"
        >
          <img
            src={`/api/weekly-news/${issue.issue_no}/images/cover`}
            alt={`주간 메랜 제${issue.issue_no}호 표지`}
            className="w-full aspect-[1200/630] object-cover border-b-2 border-edge"
            style={{ imageRendering: "pixelated" }}
            loading="lazy"
          />
          <div className="p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-pixel text-xs font-bold text-maple">
                제{issue.issue_no}호
              </span>
              <span className="text-[11px] text-dim">
                {formatDate(issue.week_start)} ~ {formatDate(issue.week_end)}
              </span>
            </div>
            <p className="text-sm font-semibold text-ink leading-snug group-hover:text-maple">
              {issueShortTitle(issue)}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
