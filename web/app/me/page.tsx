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

interface MeUser {
  id: number;
  username: string;
  global_name: string | null;
  avatar_url: string | null;
  guild_member: number;
  guild_nick: string | null;
  guild_roles: string[];
  site_nickname: string | null;
  display_name: string;
}

interface HuntMap {
  entity_id: number;
  label: string;
  sub?: string;
}

export default function MyPage() {
  // 계정
  const [user, setUser] = useState<MeUser | null | undefined>(undefined);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [nick, setNick] = useState("");
  const [nickBusy, setNickBusy] = useState(false);
  const [nickMsg, setNickMsg] = useState("");
  // 게임 프로필
  const [profile, setProfile] = useState<MyMapleProfile>(DEFAULT_MY_MAPLE_PROFILE);
  const [recent, setRecent] = useState<RecentFeature[]>([]);
  const [saved, setSaved] = useState(false);
  const [huntMaps, setHuntMaps] = useState<HuntMap[]>([]);
  // 출석
  const [attendance, setAttendance] = useState<"unknown" | "todo" | "done">("unknown");
  const [attendanceBusy, setAttendanceBusy] = useState(false);

  // ─── 초기 로드 ───
  useEffect(() => {
    setProfile(readMyMapleProfile());
    setRecent(readRecentFeatures());
    fetch(`${API_BASE}/api/auth/config`).then((r) => r.json()).then((d) => setAuthEnabled(!!d.enabled)).catch(() => {});
    (async () => {
      try {
        const me = await fetch(`${API_BASE}/api/auth/me`).then((r) => r.json());
        if (!me.user) { setUser(null); return; }
        setUser(me.user);
        setNick(me.user.site_nickname || "");
        const remote = me.settings?.my_maple as MyMapleProfile | undefined;
        if (remote && typeof remote === "object") {
          const merged = { ...DEFAULT_MY_MAPLE_PROFILE, ...remote };
          setProfile(merged);
          saveMyMapleProfile(merged);
        }
        if (me.user.guild_member === 1 && me.user.display_name) {
          const today = await fetch(`${API_BASE}/api/guild/attendance/today`).then((r) => r.json());
          setAttendance(
            today.checked_in?.some((c: { nickname: string }) => c.nickname === me.user.display_name) ? "done" : "todo"
          );
        }
      } catch {
        setUser(null);
      }
    })();
  }, []);

  // ─── 추천 사냥터 ───
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

  const persist = useCallback((next: MyMapleProfile, markSaved = true) => {
    setProfile(next);
    saveMyMapleProfile(next);
    if (markSaved) setSaved(true);
    if (user) {
      fetch(`${API_BASE}/api/me/settings/my_maple`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: next }),
      }).catch(() => {});
    }
    // 브레인 캐릭터 동기화
    try {
      const bc = {
        level: Math.max(1, Math.min(200, next.level || 1)),
        job: next.job || "",
        subJob: next.subJob || undefined,
        nickname: next.nickname || undefined,
      };
      localStorage.setItem("brain_char", JSON.stringify(bc));
      if (user) {
        fetch(`${API_BASE}/api/me/settings/brain_char`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: bc }),
        }).catch(() => {});
      }
    } catch { /* ignore */ }
  }, [user]);

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

  const saveNick = useCallback(() => {
    if (nickBusy) return;
    setNickBusy(true);
    setNickMsg("");
    fetch(`${API_BASE}/api/auth/me/nickname`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: nick }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).detail || "저장 실패");
        setNickMsg("저장됐어요! 댓글·게시판 닉네임에 바로 반영됩니다.");
        return fetch(`${API_BASE}/api/auth/me`).then((rr) => rr.json());
      })
      .then((d) => { if (d?.user) setUser(d.user); })
      .catch((e) => setNickMsg(String(e.message || e)))
      .finally(() => setNickBusy(false));
  }, [nick, nickBusy]);

  const checkIn = useCallback(() => {
    if (attendanceBusy || !user?.display_name) return;
    setAttendanceBusy(true);
    fetch(`${API_BASE}/api/guild/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: user.display_name }),
    })
      .then((r) => { if (r.ok || r.status === 409) setAttendance("done"); })
      .catch(() => {})
      .finally(() => setAttendanceBusy(false));
  }, [attendanceBusy, user]);

  const logout = useCallback(async () => {
    try { await fetch(`${API_BASE}/api/auth/logout`, { method: "POST" }); } catch { /* ignore */ }
    window.location.href = "/";
  }, []);

  const subJobOptions = profile.job && profile.job !== "초보자" ? subJobsFor(profile.job, profile.level || 1) : [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="font-pixel text-2xl text-ink">🍄 마이페이지</h1>
        <p className="text-sm text-dim mt-2">
          {user
            ? "계정·캐릭터·즐겨찾기를 한 곳에서 — 어느 기기에서든 유지됩니다."
            : "캐릭터·즐겨찾기는 이 브라우저에 저장됩니다. 디스코드 로그인하면 계정에 저장되고 기기 간 유지돼요."}
        </p>
      </header>

      {/* ── 계정 ── */}
      {user === null && authEnabled && (
        <div className="pixel-panel p-5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-pixel text-sm text-ink font-bold mb-1">🔐 디스코드 로그인</p>
            <p className="text-xs text-dim">캐릭터·즐겨찾기·브레인 지도가 계정에 저장되고, 길드원 인증·댓글·출석이 열립니다.</p>
          </div>
          <a href="/api/auth/discord/login?next=/me" className="pixel-btn px-5 py-2.5 text-sm shrink-0">디스코드로 로그인</a>
        </div>
      )}

      {user && (
        <div className="pixel-panel p-5">
          <div className="flex items-center gap-4 flex-wrap">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-14 h-14 border-2 border-edge" style={{ imageRendering: "pixelated" }} />
            ) : (
              <span className="w-14 h-14 border-2 border-edge flex items-center justify-center text-2xl">🍄</span>
            )}
            <div className="flex-1 min-w-[180px]">
              <p className="font-pixel text-base font-bold text-ink">
                {user.display_name}
                {user.guild_member === 1 && (
                  <span className="font-pixel ml-2 text-[10px] text-maple border border-maple px-1 align-middle">추억길드</span>
                )}
              </p>
              <p className="text-xs text-dim">디스코드: {user.global_name || user.username} (@{user.username})</p>
              {user.guild_roles.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {user.guild_roles.map((r) => (
                    <span key={r} className="text-[10px] px-1.5 py-0.5 border border-edge text-dim">{r}</span>
                  ))}
                </div>
              )}
            </div>
            <button onClick={logout} className="text-xs text-dim hover:text-red-500 font-pixel shrink-0">로그아웃</button>
          </div>
          <div className="mt-4 pt-4 border-t border-edge/50">
            <p className="text-xs text-dim mb-2">✏️ 사이트 표시 닉네임 — 댓글·게시판·출석부에 쓰여요. 비우면 디스코드 이름(길드 별명 우선).</p>
            <div className="flex gap-2 max-w-sm">
              <input
                value={nick}
                onChange={(e) => setNick(e.target.value.slice(0, 12))}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) saveNick(); }}
                placeholder={user.guild_nick || user.global_name || user.username}
                className="pixel-input flex-1 px-3 py-2 text-sm"
              />
              <button onClick={saveNick} disabled={nickBusy} className="pixel-btn px-4 py-2 text-sm disabled:opacity-50 shrink-0">
                {nickBusy ? "저장 중…" : "저장"}
              </button>
            </div>
            {nickMsg && <p className="text-xs text-maple mt-2">{nickMsg}</p>}
          </div>
        </div>
      )}

      {/* ── 길드원 출석 ── */}
      {user && user.guild_member === 1 && attendance !== "unknown" && (
        <div className="pixel-panel p-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-ink">
            {attendance === "done" ? "✅ 오늘 출석 완료!" : `📋 ${user.display_name}님, 아직 오늘 출석 전이에요`}
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

      {/* ── 캐릭터 설정 ── */}
      <form onSubmit={save} className="pixel-panel p-5">
        <h2 className="font-pixel text-sm text-maple mb-1">⭐ 내 캐릭터</h2>
        <p className="text-xs text-dim mb-4">저장하면 🧠 브레인 캐릭터에도 그대로 반영됩니다.</p>
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
          {saved && <span role="status" className="text-sm text-slime">저장했습니다.</span>}
          <Link href="/brain" className="ml-auto text-xs text-dim hover:text-maple font-pixel">🧠 브레인에서 보기 →</Link>
        </div>
      </form>

      {/* ── 추천 ── */}
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
          <p className="text-xs text-dim mt-2">원작 수치(몹 EXP × 젠 수) 기반 근사</p>
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

      {/* ── 즐겨찾기 ── */}
      <section className="pixel-panel p-5">
        <h2 className="font-pixel text-sm text-maple mb-1">⭐ 즐겨찾기</h2>
        <p className="text-xs text-dim mb-4">체크한 기능은 좌측 사이드바 맨 위와 홈 「오늘 뭐 하지」에 고정됩니다.</p>
        <div className="space-y-4">
          {SITE_SECTIONS.filter((s) => s.label !== "마이").map((section) => (
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

      {/* 알림 설정 예고 */}
      <div className="pixel-card p-4 opacity-70">
        <p className="font-pixel font-bold text-sm">🔔 알림 설정</p>
        <p className="text-xs text-dim mt-1">준비 중 — 새 주간 메랜·공지 디스코드 알림</p>
      </div>
    </div>
  );
}
