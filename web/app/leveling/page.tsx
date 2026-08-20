"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  JOB_GROUPS, ALL_JOBS, LEVELING_SPOTS, JOB_NOTES, BANDS, MOB_LV, SPOT_SPAWN,
  type LevelingSpot,
} from "@/data/huntingSpots";


function firstUrl(s: string): string | null {
  const m = s.match(/https?:\/\/[^\s]+/);
  return m ? m[0] : null;
}
function sourceHost(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "").replace(/^m\./, ""); }
  catch { return "출처"; }
}


function SpotCard({ s, showJobs }: { s: LevelingSpot; showJobs: boolean }) {
  const [open, setOpen] = useState(false);
  const url = firstUrl(s.source);
  const showLv = s.kind !== "boss"; // 보스는 DB 레벨이 부정확해 미표시

  return (
    <div className="pixel-card">
      <button onClick={() => setOpen((v) => !v)} className="w-full text-left p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="pixel-badge font-pixel text-[10px] bg-[color-mix(in_srgb,var(--c-skill)_18%,transparent)] text-skill">
            Lv.{s.levelMin}~{s.levelMax}
          </span>
          {s.miniDungeon && (
            <span className="pixel-badge font-pixel text-[10px] bg-[color-mix(in_srgb,var(--c-mush)_18%,transparent)] text-mush">미니던전</span>
          )}
          {s.burningBuff && (
            <span className="pixel-badge font-pixel text-[10px] bg-[color-mix(in_srgb,var(--c-mush)_24%,transparent)] text-mush">🔥 버닝버프</span>
          )}
          <span className="font-bold text-ink">{s.map}</span>
          <svg className={`w-4 h-4 text-dim shrink-0 ml-auto transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <p className="text-xs text-dim mt-0.5">📍 {s.region}</p>
        {s.monsters.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {s.monsters.map((m) => {
              const lv = showLv ? MOB_LV[m] : undefined;
              return (
                <span key={m} className="pixel-badge text-[11px] bg-surface2 text-dim">
                  {m}{lv ? <span className="text-skill"> Lv.{lv}</span> : null}
                </span>
              );
            })}
          </div>
        )}
        {!open && <p className="text-xs text-dim mt-2">자세히 보기 ▾</p>}
      </button>

      {open && (
        <div className="border-t border-edge/40 px-4 py-3 space-y-2">
          <div>
            <p className="font-pixel text-[11px] text-maple mb-1">사냥 팁</p>
            <p className="text-sm text-ink leading-relaxed">{s.tip}</p>
          </div>
          {s.map.includes("파티퀘스트") && (
            <Link href="/pq" className="inline-block text-xs text-maple hover:underline">
              파티퀘스트 보상·효율 비교 →
            </Link>
          )}
          {s.burningBuff && (
            <p className="text-xs text-mush">🔥 {s.burningBuff}</p>
          )}
          {SPOT_SPAWN[s.map] && (
            <p className="text-xs text-dim">
              이 맵 젠(참고): <span className="text-skill font-medium">총 {SPOT_SPAWN[s.map]}마리</span>
              <span className="opacity-70"> · 원작(KMS) 기준, 메랜 자체 젠과 다를 수 있음</span>
            </p>
          )}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {showJobs && !s.common && s.jobs && (
              <div className="flex flex-wrap gap-1">
                {s.jobs.length >= ALL_JOBS.length - 2
                  ? <span className="pixel-badge text-[10px] bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] text-maple">대부분 직업</span>
                  : s.jobs.map((j) => (
                      <span key={j} className="pixel-badge text-[10px] bg-[color-mix(in_srgb,var(--c-maple)_12%,transparent)] text-maple">{j}</span>
                    ))}
              </div>
            )}
            {showJobs && s.common && (
              <span className="pixel-badge text-[10px] bg-[color-mix(in_srgb,var(--c-slime)_16%,transparent)] text-slime">전 직업 공용</span>
            )}
            {url
              ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-dim hover:text-maple ml-auto">출처: {sourceHost(url)} →</a>
              : <span className="text-[11px] text-dim ml-auto">출처: {s.source}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LevelingPage() {
  const [job, setJob] = useState<string>("전체");
  const [miniOnly, setMiniOnly] = useState(false);

  const hunting = useMemo(() => {
    let list = LEVELING_SPOTS.filter((s) => !s.kind);
    if (job !== "전체") list = list.filter((s) => s.common || s.jobs?.includes(job));
    if (miniOnly) list = list.filter((s) => s.miniDungeon);
    return [...list].sort((a, b) => a.levelMin - b.levelMin || a.levelMax - b.levelMax);
  }, [job, miniOnly]);

  const meso = useMemo(() => LEVELING_SPOTS.filter((s) => s.kind === "meso").sort((a, b) => a.levelMin - b.levelMin), []);
  const boss = useMemo(() => LEVELING_SPOTS.filter((s) => s.kind === "boss").sort((a, b) => a.levelMin - b.levelMin), []);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* 헤더 */}
      <div>
        <h1 className="font-pixel text-xl text-ink flex items-center gap-2 flex-wrap">
          <span>🗺️</span> 직업별 육성 사냥터
          <span className="pixel-badge font-pixel text-[10px] bg-[color-mix(in_srgb,var(--c-mush)_18%,transparent)] text-mush">버닝 월드</span>
        </h1>
        <p className="text-sm text-dim mt-1">
          커뮤니티에서 모은 레벨 구간별 추천 사냥터. 직업을 고르면 그 직업이 가는 곳만 보여줍니다.
          버닝 월드는 경험치 1.5배라 맵은 같고 체류 시간만 짧아집니다.
        </p>
      </div>

      {/* 2.0 미니던전 안내 */}
      <div className="pixel-panel p-4 flex items-start gap-2">
        <span className="text-base shrink-0">🏰</span>
        <p className="text-sm text-dim">
          <span className="font-pixel text-mush text-[12px]">미니던전</span> · 2.0에서 인기 사냥터에 추가된 <span className="text-ink">개인 던전</span>입니다.
          자리싸움 없이 1회 입장당 약 2시간 사냥, 파티 동반 가능. 젠은 원작 기준.
          버닝 월드(6/19~9/11)는 Lv120 미만 경험치 1.5배 + 상시 버프이며, <span className="text-ink">카에데 성은 버닝 진입 불가</span>입니다.
          {" "}<span className="text-mush">최근 버닝 패치(6/24)</span>: 골렘의 숲·차디찬 벌판 <span className="text-ink">최대 몬스터 수 증가</span>,
          경험치 2배 쿠폰 상자(120레벨 이전·매일 0시 6개) 지급.
        </p>
      </div>

      {/* 직업 선택 */}
      <div className="pixel-panel p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={() => setJob("전체")}
            className={`font-pixel text-[12px] px-3 py-1.5 ${job === "전체" ? "pixel-btn" : "bg-surface2 text-dim hover:text-maple border-2 border-edge"}`}
          >
            전체
          </button>
          <button
            onClick={() => setMiniOnly((v) => !v)}
            className={`font-pixel text-[12px] px-3 py-1.5 ${miniOnly ? "pixel-btn" : "bg-surface2 text-dim hover:text-mush border-2 border-edge"}`}
          >
            🏰 미니던전만
          </button>
        </div>
        {JOB_GROUPS.map((g) => (
          <div key={g.group} className="flex items-center gap-2 flex-wrap">
            <span className="font-pixel text-[11px] text-dim w-14 shrink-0">{g.group}</span>
            {g.jobs.map((j) => (
              <button
                key={j.key}
                onClick={() => setJob(j.key)}
                className={`font-pixel text-[12px] px-3 py-1.5 ${job === j.key ? "pixel-btn" : "bg-surface2 text-dim hover:text-maple border-2 border-edge"}`}
              >
                {j.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* 직업 특성 메모 */}
      {job !== "전체" && JOB_NOTES[job] && (
        <div className="pixel-panel p-4 flex items-start gap-2">
          <span className="text-base shrink-0">📌</span>
          <p className="text-sm text-dim"><span className="font-pixel text-maple text-[12px]">{job}</span> · {JOB_NOTES[job]}</p>
        </div>
      )}

      {/* 사냥터 목록 (레벨 밴드별) */}
      {BANDS.map((band) => {
        const spots = hunting.filter((s) => s.levelMin >= band.min && s.levelMin <= band.max);
        if (spots.length === 0) return null;
        return (
          <div key={band.key}>
            <h2 className="font-pixel text-[13px] text-maple mb-2 flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-maple" />{band.label}
            </h2>
            <div className="space-y-2">
              {spots.map((s, i) => <SpotCard key={`${band.key}-${i}`} s={s} showJobs={job === "전체"} />)}
            </div>
          </div>
        );
      })}
      {hunting.length === 0 && (
        <p className="text-center py-10 text-dim font-pixel text-sm">조건에 맞는 사냥터가 없습니다.</p>
      )}

      {/* 메소 파밍 */}
      {!miniOnly && (
        <div>
          <h2 className="font-pixel text-[13px] text-slime mb-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-slime" />💰 메소 파밍 (돈벌이)
          </h2>
          <div className="space-y-2">
            {meso.map((s, i) => <SpotCard key={`meso-${i}`} s={s} showJobs={false} />)}
          </div>
        </div>
      )}

      {/* 보스 입문 */}
      {!miniOnly && (
        <div>
          <h2 className="font-pixel text-[13px] text-mush mb-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-mush" />👹 보스 입문 (버닝 도전 가능)
          </h2>
          <div className="space-y-2">
            {boss.map((s, i) => <SpotCard key={`boss-${i}`} s={s} showJobs={false} />)}
          </div>
        </div>
      )}

      {/* 면책 */}
      <p className="text-[11px] text-dim leading-relaxed pixel-panel p-3">
        ※ 커뮤니티(arca.live·dcinside·inven·나무위키·블로그) 글을 수집·정리한 자료로, 젠률·효율은 패치와 자리 경쟁에 따라 달라질 수 있습니다.
        미니던전 입장 횟수/쿨타임 등 세부 규칙과 시그너스 5종 일부 정보는 2.0 신규라 추론이 섞여 있습니다.
        메소·시간당 경험치 수치는 세팅·시세에 따라 달라지는 참고값입니다.
      </p>
    </div>
  );
}
