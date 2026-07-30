"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getEvents, getWeeklyIssueLatest, type EventGuideSummary } from "@/lib/api";
import type { WeeklyIssue } from "@/lib/types";
import { ALL_SITE_FEATURES } from "@/lib/siteFeatures";
import {
  DEFAULT_MY_MAPLE_PROFILE,
  GOAL_LABELS,
  MY_MAPLE_UPDATED_EVENT,
  readMyMapleProfile,
  readRecentFeatures,
  type MyMapleProfile,
  type RecentFeature,
} from "@/lib/myMaple";

const GOAL_PRIMARY: Record<MyMapleProfile["goal"], string> = {
  leveling: "/hunt",
  boss: "/bosses",
  quest: "/quest-roadmap",
  meso: "/drop-search",
  play: "/daily-mob",
};

export default function HomeTodayBrief() {
  const [profile, setProfile] = useState(DEFAULT_MY_MAPLE_PROFILE);
  const [recent, setRecent] = useState<RecentFeature[]>([]);
  const [event, setEvent] = useState<EventGuideSummary | null>(null);
  const [weekly, setWeekly] = useState<WeeklyIssue | null>(null);

  useEffect(() => {
    const syncLocal = () => {
      setProfile(readMyMapleProfile());
      setRecent(readRecentFeatures());
    };
    syncLocal();
    window.addEventListener(MY_MAPLE_UPDATED_EVENT, syncLocal);
    Promise.allSettled([getEvents(), getWeeklyIssueLatest()]).then(([eventsResult, weeklyResult]) => {
      if (eventsResult.status === "fulfilled") {
        setEvent(eventsResult.value.events.find((item) => item.status === "active") || null);
      }
      if (weeklyResult.status === "fulfilled") setWeekly(weeklyResult.value.issue);
    });
    return () => window.removeEventListener(MY_MAPLE_UPDATED_EVENT, syncLocal);
  }, []);

  const favorite = useMemo(
    () => profile.favorites
      .map((href) => ALL_SITE_FEATURES.find((feature) => feature.href === href))
      .find(Boolean),
    [profile.favorites],
  );
  const goalFeature = ALL_SITE_FEATURES.find((feature) => feature.href === GOAL_PRIMARY[profile.goal]);

  return (
    <section className="max-w-3xl mx-auto mt-8" aria-labelledby="today-brief-title">
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 id="today-brief-title" className="font-pixel text-[13px] text-maple">오늘 뭐 하지?</h2>
          <p className="text-xs text-dim mt-1">
            {profile.nickname ? `${profile.nickname} · Lv.${profile.level} · ${GOAL_LABELS[profile.goal]}` : "내 캐릭터를 설정하면 목표에 맞춰 바뀝니다."}
          </p>
        </div>
        <Link href="/me" className="text-xs text-dim hover:text-maple">내 메랜 설정 →</Link>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <Link href={event ? `/events/${event.slug}` : "/events"} className="pixel-card p-4">
          <span className="font-pixel text-[11px] text-mush">진행 중 이벤트</span>
          <strong className="block text-sm mt-2 line-clamp-2">{event?.title || "이벤트 정리 보기"}</strong>
          <span className="block text-xs text-dim mt-1">{event?.period_end ? `${event.period_end}까지` : "일정과 보상을 확인하세요"}</span>
        </Link>
        <Link href={weekly ? `/weekly/${weekly.issue_no}` : "/weekly"} className="pixel-card p-4">
          <span className="font-pixel text-[11px] text-maple">최신 주간 메랜</span>
          <strong className="block text-sm mt-2">{weekly ? `제${weekly.issue_no}호` : "이번 주 소식"}</strong>
          <span className="block text-xs text-dim mt-1 line-clamp-1">{weekly?.title || "공식·커뮤니티 이슈 모아보기"}</span>
        </Link>
        <Link href={recent[0]?.href || favorite?.href || goalFeature?.href || "/me"} className="pixel-card p-4">
          <span className="font-pixel text-[11px] text-slime">{recent[0] ? "이어서 보기" : "목표 바로가기"}</span>
          <strong className="block text-sm mt-2">{recent[0]?.label || favorite?.homeLabel || favorite?.label || goalFeature?.label || "내 메랜 설정"}</strong>
          <span className="block text-xs text-dim mt-1">{goalFeature?.description || "자주 쓰는 기능을 모아보세요"}</span>
        </Link>
      </div>
    </section>
  );
}
