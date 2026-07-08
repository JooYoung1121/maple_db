"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getWeeklyIssue } from "@/lib/api";
import type { WeeklyIssue } from "@/lib/types";
import IssueView from "../IssueView";

export default function WeeklyIssuePage() {
  const params = useParams<{ issueNo: string }>();
  const issueNo = Number(params.issueNo);
  const [issue, setIssue] = useState<WeeklyIssue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!Number.isInteger(issueNo)) {
      setLoading(false);
      return;
    }
    getWeeklyIssue(issueNo)
      .then((d) => setIssue(d.issue))
      .catch(() => setIssue(null))
      .finally(() => setLoading(false));
  }, [issueNo]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 justify-center text-dim text-sm">
        <div className="w-4 h-4 border-2 border-edge border-t-maple rounded-full animate-spin" />
        지난 호를 꺼내오는 중...
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="pixel-panel p-8 text-center space-y-3">
        <p className="text-sm text-dim">해당 호를 찾을 수 없습니다.</p>
        <Link href="/weekly" className="pixel-btn inline-block text-sm">
          최신호로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/weekly" className="text-sm text-maple hover:underline">
        ← 최신호 보기
      </Link>
      <IssueView issue={issue} />
    </div>
  );
}
