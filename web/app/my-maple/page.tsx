"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ALL_SITE_FEATURES } from "@/lib/siteFeatures";
import {
  DEFAULT_MY_MAPLE_PROFILE,
  GOAL_LABELS,
  readMyMapleProfile,
  readRecentFeatures,
  saveMyMapleProfile,
  type MyMapleProfile,
  type RecentFeature,
} from "@/lib/myMaple";

const JOBS = ["초보자", "전사", "마법사", "궁수", "도적", "해적"];
const GOAL_LINKS: Record<MyMapleProfile["goal"], string[]> = {
  leveling: ["/exp", "/hunt", "/leveling"],
  boss: ["/bosses", "/boss-timer", "/gear-sim"],
  quest: ["/quests", "/quest-roadmap", "/medals"],
  meso: ["/drop-search", "/maker", "/scroll"],
  play: ["/daily-mob", "/quiz", "/play"],
};

export default function MyMaplePage() {
  const [profile, setProfile] = useState<MyMapleProfile>(DEFAULT_MY_MAPLE_PROFILE);
  const [recent, setRecent] = useState<RecentFeature[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setProfile(readMyMapleProfile());
    setRecent(readRecentFeatures());
  }, []);

  const recommendations = useMemo(
    () => GOAL_LINKS[profile.goal]
      .map((href) => ALL_SITE_FEATURES.find((feature) => feature.href === href))
      .filter((feature): feature is NonNullable<typeof feature> => Boolean(feature)),
    [profile.goal],
  );

  function update<K extends keyof MyMapleProfile>(key: K, value: MyMapleProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    const normalized = { ...profile, level: Math.max(1, Math.min(200, profile.level || 1)) };
    setProfile(normalized);
    saveMyMapleProfile(normalized);
    setSaved(true);
  }

  function toggleFavorite(href: string, checked: boolean) {
    const favorites = checked
      ? [...new Set([...profile.favorites, href])]
      : profile.favorites.filter((item) => item !== href);
    const next = { ...profile, favorites };
    setProfile(next);
    saveMyMapleProfile(next);
    setSaved(true);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="font-pixel text-2xl text-ink">🍁 내 메랜</h1>
        <p className="text-sm text-dim mt-2">로그인 없이 이 브라우저에만 저장됩니다. 닉네임을 비워도 사용할 수 있어요.</p>
      </header>

      <form onSubmit={save} className="pixel-panel p-5">
        <h2 className="font-pixel text-sm text-maple mb-4">캐릭터 설정</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="text-sm text-dim">
            닉네임
            <input className="pixel-input w-full mt-1 px-3 py-2 text-ink" value={profile.nickname} onChange={(e) => update("nickname", e.target.value)} />
          </label>
          <label className="text-sm text-dim">
            직업
            <select className="pixel-input w-full mt-1 px-3 py-2 text-ink" value={profile.job} onChange={(e) => update("job", e.target.value)}>
              <option value="">선택 안 함</option>
              {JOBS.map((job) => <option key={job}>{job}</option>)}
            </select>
          </label>
          <label className="text-sm text-dim">
            레벨
            <input type="number" min={1} max={200} className="pixel-input w-full mt-1 px-3 py-2 text-ink" value={profile.level} onChange={(e) => update("level", Number(e.target.value))} />
          </label>
          <label className="text-sm text-dim">
            지금 목표
            <select className="pixel-input w-full mt-1 px-3 py-2 text-ink" value={profile.goal} onChange={(e) => update("goal", e.target.value as MyMapleProfile["goal"])}>
              {Object.entries(GOAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button className="pixel-btn px-5 py-2" type="submit">저장</button>
          {saved && <span role="status" className="text-sm text-slime">저장했습니다.</span>}
        </div>
      </form>

      <section>
        <h2 className="font-pixel text-sm text-maple mb-3">지금 추천</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {recommendations.map((feature) => (
            <Link key={feature.href} href={feature.href} className="pixel-card p-4">
              <span className="text-2xl" aria-hidden>{feature.icon}</span>
              <strong className="block text-sm mt-2">{feature.homeLabel || feature.label}</strong>
              <span className="block text-xs text-dim mt-1">{feature.description}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="pixel-panel p-5">
        <h2 className="font-pixel text-sm text-maple mb-3">즐겨찾기</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ALL_SITE_FEATURES.filter((feature) => ["/exp", "/hunt", "/weekly", "/drop-search", "/quests", "/maker", "/bosses", "/events", "/daily-mob"].includes(feature.href)).map((feature) => (
            <label key={feature.href} className="flex items-center gap-2 text-sm p-2 border border-edge bg-surface2">
              <input
                type="checkbox"
                checked={profile.favorites.includes(feature.href)}
                onChange={(e) => toggleFavorite(feature.href, e.target.checked)}
              />
              {feature.icon} {feature.homeLabel || feature.label}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-pixel text-sm text-maple mb-3">최근 본 기능</h2>
        {recent.length ? (
          <div className="flex flex-wrap gap-2">
            {recent.map((item) => <Link key={item.href} href={item.href} className="pixel-card px-3 py-2 text-sm">{item.label}</Link>)}
          </div>
        ) : <p className="text-sm text-dim">기능을 둘러보면 여기에 최근 경로가 모입니다.</p>}
      </section>
    </div>
  );
}
