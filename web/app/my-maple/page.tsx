"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ALL_SITE_FEATURES, SITE_SECTIONS } from "@/lib/siteFeatures";
import { JOB_BRANCHES, subJobsFor } from "@/lib/jobs";
import {
  DEFAULT_MY_MAPLE_PROFILE,
  GOAL_LABELS,
  readMyMapleProfile,
  readRecentFeatures,
  saveMyMapleProfile,
  type MyMapleProfile,
  type RecentFeature,
} from "@/lib/myMaple";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

const GOAL_LINKS: Record<MyMapleProfile["goal"], string[]> = {
  leveling: ["/exp", "/hunt", "/leveling"],
  boss: ["/bosses", "/boss-timer", "/gear-sim"],
  quest: ["/quests", "/quest-roadmap", "/medals"],
  meso: ["/drop-search", "/maker", "/scroll"],
  play: ["/daily-mob", "/quiz", "/play"],
};

interface HuntMap {
  entity_id: number;
  label: string;
  sub?: string;
}

export default function MyMaplePage() {
  const [profile, setProfile] = useState<MyMapleProfile>(DEFAULT_MY_MAPLE_PROFILE);
  const [recent, setRecent] = useState<RecentFeature[]>([]);
  const [saved, setSaved] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [guildMember, setGuildMember] = useState(false);
  const [huntMaps, setHuntMaps] = useState<HuntMap[]>([]);
  const [attendance, setAttendance] = useState<"unknown" | "todo" | "done">("unknown");
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [displayName, setDisplayName] = useState("");

  // ─── 초기 로드: 계정 저장값 > 로컬 ───
  useEffect(() => {
    const local = readMyMapleProfile();
    setProfile(local);
    setRecent(readRecentFeatures());
    (async () => {
      try {
        const me = await fetch(`${API_BASE}/api/auth/me`).then((r) => r.json());
        if (!me.user) return;
        setLoggedIn(true);
        setGuildMember(me.user.guild_member === 1);
        setDisplayName(me.user.display_name || "");
        const remote = me.settings?.my_maple as MyMapleProfile | undefined;
        if (remote && typeof remote === "object") {
          const merged = { ...DEFAULT_MY_MAPLE_PROFILE, ...remote };
          setProfile(merged);
          saveMyMapleProfile(merged); // 로컬에도 반영 (홈·사이드바 공유)
        } else {
          // 계정에 없으면 로컬 값을 계정으로 승격
          pushRemote(local);
        }
        // 출석 상태
        const nick = me.user.display_name;
        if (me.user.guild_member === 1 && nick) {
          const today = await fetch(`${API_BASE}/api/guild/attendance/today`).then((r) => r.json());
          setAttendance(today.checked_in?.some((c: { nickname: string }) => c.nickname === nick) ? "done" : "todo");
        }
      } catch { /* 비로그인 */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 내 레벨 추천 사냥터 (브레인 엔진 재사용) ───
  useEffect(() => {
    if (!profile.level || profile.level < 1) return;
    const t = setTimeout(() => {
      fetch(`${API_BASE}/api/brain/ego?level=${profile.level}`)
        .then((r) => r.json())
        .then((d) => {
          const maps = (d.nodes ?? [])
            .filter((n: { type: string; group?: string }) => n.type === "map" && n.group === "hunt")
            .slice(0, 3);
          setHuntMaps(maps);
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [profile.level]);

  function pushRemote(p: MyMapleProfile) {
    fetch(`${API_BASE}/api/me/settings/my_maple`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: p }),
    }).catch(() => {});
  }

  const persist = useCallback((next: MyMapleProfile, markSaved = true) => {
    setProfile(next);
    saveMyMapleProfile(next);
    if (markSaved) setSaved(true);
    if (loggedIn) pushRemote(next);
    // 브레인 캐릭터와 동기화 (레벨·직업·닉네임 단일화)
    try {
      const bc = {
        level: Math.max(1, Math.min(200, next.level || 1)),
        job: next.job || "",
        subJob: next.subJob || undefined,
        nickname: next.nickname || undefined,
      };
      localStorage.setItem("brain_char", JSON.stringify(bc));
      if (loggedIn) {
        fetch(`${API_BASE}/api/me/settings/brain_char`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: bc }),
        }).catch(() => {});
      }
    } catch { /* ignore */ }
  }, [loggedIn]);

  const recommendations = useMemo(
    () => GOAL_LINKS[profile.goal]
      .map((href) => ALL_SITE_FEATURES.find((feature) => feature.href === href))
      .filter((feature): feature is NonNullable<typeof feature> => Boolean(feature)),
    [profile.goal],
  );

  function update<K extends keyof MyMapleProfile>(key: K, value: MyMapleProfile[K]) {
    setProfile((current) => {
      const next = { ...current, [key]: value };
      if (key === "job" || key === "level") next.subJob = "";
      return next;
    });
    setSaved(false);
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    persist({ ...profile, level: Math.max(1, Math.min(200, profile.level || 1)) });
  }

  function toggleFavorite(href: string, checked: boolean) {
    const favorites = checked
      ? [...new Set([...profile.favorites, href])]
      : profile.favorites.filter((item) => item !== href);
    persist({ ...profile, favorites });
  }

  const checkIn = useCallback(() => {
    if (attendanceBusy || !displayName) return;
    setAttendanceBusy(true);
    fetch(`${API_BASE}/api/guild/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: displayName }),
    })
      .then((r) => { if (r.ok || r.status === 409) setAttendance("done"); })
      .catch(() => {})
      .finally(() => setAttendanceBusy(false));
  }, [attendanceBusy, displayName]);

  const subJobOptions = profile.job ? subJobsFor(profile.job, profile.level || 1) : [];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="font-pixel text-2xl text-ink">🍁 내 메랜</h1>
        <p className="text-sm text-dim mt-2">
          {loggedIn
            ? "계정에 저장됩니다 — 어느 기기에서든 유지되고, 브레인 캐릭터와도 연동돼요."
            : "이 브라우저에 저장됩니다. 디스코드 로그인하면 계정에 저장되고 기기 간 유지돼요."}
        </p>
      </header>

      {/* 길드원 출석 위젯 */}
      {loggedIn && guildMember && attendance !== "unknown" && (
        <div className="pixel-panel p-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-ink">
            {attendance === "done" ? "✅ 오늘 출석 완료!" : `📋 ${displayName}님, 아직 오늘 출석 전이에요`}
          </p>
          {attendance === "todo" ? (
            <button onClick={checkIn} disabled={attendanceBusy} className="pixel-btn px-4 py-2 text-sm disabled:opacity-50">
              {attendanceBusy ? "출석 중…" : "바로 출석하기"}
            </button>
          ) : (
            <Link href="/guild/attendance" className="text-xs text-dim hover:text-maple font-pixel">출석부 보기 →</Link>
          )}
        </div>
      )}

      <form onSubmit={save} className="pixel-panel p-5">
        <h2 className="font-pixel text-sm text-maple mb-4">캐릭터 설정</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <label className="text-sm text-dim">
            닉네임
            <input className="pixel-input w-full mt-1 px-3 py-2 text-ink" value={profile.nickname} onChange={(e) => update("nickname", e.target.value.slice(0, 12))} />
          </label>
          <label className="text-sm text-dim">
            레벨
            <input type="number" min={1} max={200} className="pixel-input w-full mt-1 px-3 py-2 text-ink" value={profile.level} onChange={(e) => update("level", Number(e.target.value))} />
          </label>
          <label className="text-sm text-dim">
            직업 계열
            <select className="pixel-input w-full mt-1 px-3 py-2 text-ink" value={profile.job} onChange={(e) => update("job", e.target.value)}>
              <option value="">선택 안 함</option>
              <option value="초보자">초보자</option>
              {JOB_BRANCHES.map((job) => <option key={job}>{job}</option>)}
            </select>
          </label>
          <label className="text-sm text-dim">
            세부 직업
            <select
              className="pixel-input w-full mt-1 px-3 py-2 text-ink disabled:opacity-40"
              value={profile.subJob}
              onChange={(e) => setProfile((c) => ({ ...c, subJob: e.target.value }))}
              disabled={subJobOptions.length === 0}
            >
              <option value="">{subJobOptions.length ? `선택 (Lv.${profile.level} 기준)` : "계열 먼저 선택"}</option>
              {subJobOptions.map((j) => <option key={j}>{j}</option>)}
            </select>
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
          {saved && <span role="status" className="text-sm text-slime">저장했습니다. (브레인 캐릭터에도 반영)</span>}
        </div>
      </form>

      {/* 내 레벨 추천 사냥터 */}
      {huntMaps.length > 0 && (
        <section>
          <h2 className="font-pixel text-sm text-maple mb-3">Lv.{profile.level} 추천 사냥터</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {huntMaps.map((m) => (
              <Link key={m.entity_id} href={`/maps/${m.entity_id}`} className="pixel-card p-4">
                <span className="text-2xl" aria-hidden>🗺️</span>
                <strong className="block text-sm mt-2">{m.label}</strong>
                <span className="block text-xs text-dim mt-1">{m.sub}</span>
              </Link>
            ))}
          </div>
          <p className="text-xs text-dim mt-2">
            원작 수치(몹 EXP × 젠 수) 기반 근사 · <Link href="/brain" className="text-maple hover:underline">🧠 브레인에서 성장 예측까지 보기 →</Link>
          </p>
        </section>
      )}

      <section>
        <h2 className="font-pixel text-sm text-maple mb-3">목표 추천 — {GOAL_LABELS[profile.goal]}</h2>
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
        <h2 className="font-pixel text-sm text-maple mb-1">⭐ 즐겨찾기</h2>
        <p className="text-xs text-dim mb-4">체크한 기능은 좌측 사이드바 맨 위와 홈 「오늘 뭐 하지」에 고정됩니다.</p>
        <div className="space-y-4">
          {SITE_SECTIONS.filter((s) => !["마이"].includes(s.label)).map((section) => (
            <div key={section.label}>
              <p className="font-pixel text-[11px] text-dim mb-1.5">{section.icon} {section.label}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {section.items.map((feature) => (
                  <label key={feature.href} className="flex items-center gap-2 text-[13px] p-1.5 border border-edge bg-surface2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profile.favorites.includes(feature.href)}
                      onChange={(e) => toggleFavorite(feature.href, e.target.checked)}
                    />
                    {feature.icon} {feature.homeLabel || feature.label}
                  </label>
                ))}
              </div>
            </div>
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
