"use client";

import { useEffect, useState } from "react";
import { getWeeklyIssueLatest, getWeeklyIssues } from "@/lib/api";
import type { WeeklyIssue, WeeklyIssueSummary } from "@/lib/types";
import { WeeklyIssueNavigator } from "./ArchiveNavigation";
import IssueView from "./IssueView";

export default function WeeklyClient() {
  const [issue, setIssue] = useState<WeeklyIssue | null>(null);
  const [archive, setArchive] = useState<WeeklyIssueSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([getWeeklyIssueLatest(), getWeeklyIssues({ per_page: 100 })]).then(
      ([latest, list]) => {
        if (latest.status === "fulfilled") setIssue(latest.value.issue);
        if (list.status === "fulfilled") setArchive(list.value.issues);
        setLoading(false);
      }
    );
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 justify-center text-dim text-sm">
        <div className="w-4 h-4 border-2 border-edge border-t-maple rounded-full animate-spin" />
        이번 주 신문을 인쇄하는 중...
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="pixel-panel p-8 text-center space-y-2">
        <h1 className="font-pixel text-xl font-bold text-maple">주간 메랜</h1>
        <p className="text-sm text-dim">
          아직 발행된 호가 없습니다. 창간호를 준비 중이에요! 🍁
        </p>
      </div>
    );
  }

  const topNavigation = (
    <WeeklyIssueNavigator
      issues={archive}
      currentIssueNo={issue.issue_no}
      showRecent
    />
  );
  const bottomNavigation = (
    <WeeklyIssueNavigator issues={archive} currentIssueNo={issue.issue_no} />
  );

  return (
    <IssueView
      issue={issue}
      topNavigation={archive.length > 0 ? topNavigation : null}
      bottomNavigation={archive.length > 1 ? bottomNavigation : null}
    />
  );
}
