"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ALL_SITE_FEATURES } from "@/lib/siteFeatures";
import { MY_MAPLE_UPDATED_EVENT, readRecentFeatures, type RecentFeature } from "@/lib/myMaple";

const GROUPS = [
  {label: "오늘의 게임 · 가볍게 한 판", paths: ["/daily-mob", "/mapletle", "/fortune", "/quiz", "/highlow", "/map-guess", "/drop-chain"]},
  {label: "파티 결정 도구 · 함께 놀기", paths: ["/play", "/pq/amorian-solver", "/lotto", "/versus", "/worldcup"]},
  {label: "도감 · 아카이브", paths: ["/chosung", "/museum", "/tespia-bosses"]},
];
const paths = new Set(GROUPS.flatMap(g => g.paths));

export default function PlaygroundPage() {
  const [recent, setRecent] = useState<RecentFeature[]>([]);
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => {
      setRecent(readRecentFeatures().filter(r => r && paths.has(r.href)).slice(0, 4));
      try {
        const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul'}).format(new Date());
        const completed = [];
        if (JSON.parse(localStorage.getItem(`daily_mob_${today}`) || '{}').solved === true) completed.push('/daily-mob');
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith(`mapletle_${today}_`) && JSON.parse(localStorage.getItem(key) || '{}').solved === true) {
            completed.push('/mapletle'); break;
          }
        }
        setDone(completed);
      } catch { setDone([]); }
    };
    sync();
    const timer = setInterval(sync, 60000);
    window.addEventListener('storage', sync);
    window.addEventListener(MY_MAPLE_UPDATED_EVENT, sync);
    return () => { clearInterval(timer); window.removeEventListener('storage', sync); window.removeEventListener(MY_MAPLE_UPDATED_EVENT, sync); };
  }, []);
  return <div className="mx-auto max-w-4xl space-y-6">
    <header><h1 className="font-pixel text-2xl">놀이터 모아보기</h1><p className="mt-2 text-sm text-dim">오늘 한 판, 파티 도구, 도감을 목적별로 찾아보세요. 완료 표시는 이 브라우저의 한국 날짜 기준 기록입니다.</p></header>
    {!!recent.length && <section><h2 className="font-semibold mb-2">최근 플레이</h2><div className="flex flex-wrap gap-2">{recent.map(r => <Link key={r.href} className="pixel-btn min-h-11 px-3 py-3 text-sm" href={r.href}>{ALL_SITE_FEATURES.find(f => f.href === r.href)?.label}</Link>)}</div></section>}
    <Link href="/quiz?theme=edelstein" className="pixel-panel block p-4"><strong>신규 테마 · 에델슈타인 이름 퀴즈 →</strong><p className="mt-1 text-sm text-dim">DB의 몬스터 이름으로 출제합니다. 미확인 HP·EXP는 정답으로 쓰지 않습니다.</p></Link>
    {GROUPS.map(g => <section key={g.label}><h2 className="font-semibold mb-3">{g.label}</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {g.paths.map(path => ALL_SITE_FEATURES.find(f => f.href === path)).filter(f => f !== undefined).map(f => <Link key={f.href} href={f.href} className="pixel-card p-4">
        <span aria-hidden>{f.icon} </span><strong className="text-sm">{f.label}</strong>
        <p className="mt-2 text-xs leading-relaxed text-dim">{f.description}</p>
        {done.includes(f.href) && <span className="block mt-2 text-xs text-green-800 dark:text-green-300">✓ 오늘 완료{f.href === '/mapletle' ? '한 라운드 있음' : ''}</span>}
      </Link>)}
    </div></section>)}
  </div>;
}
