"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { HUNTING_SPOTS, BURNING, isBurningActive, type HuntingSpot } from "@/data/huntingSpots";

// ─── 직업 타입 ───
type Job = "all" | "warrior" | "mage" | "archer" | "thief" | "pirate";

const JOB_LABELS: Record<Job, string> = {
  all: "전체",
  warrior: "전사",
  mage: "마법사",
  archer: "궁수",
  thief: "도적",
  pirate: "해적",
};

// 한글 직업명 → Job 키 매핑
const JOB_KR_TO_KEY: Record<string, Job> = {
  "전체": "all",
  "전사": "warrior",
  "마법사": "mage",
  "궁수": "archer",
  "도적": "thief",
  "해적": "pirate",
};


// ─── 유틸 ───
function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

function formatExpShort(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}억`;
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}천만`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return formatNumber(n);
}

function isBoss(spot: HuntingSpot): boolean {
  return spot.id.startsWith("boss-");
}

function isPQ(spot: HuntingSpot): boolean {
  return spot.id.endsWith("-pq");
}

// ─── 메인 컴포넌트 ───
export default function HuntPage() {
  const [level, setLevel] = useState<number | "">(30);
  const [job, setJob] = useState<Job>("all");
  const [damage, setDamage] = useState<string>("");
  const [burning, setBurning] = useState(isBurningActive());

  // 버닝 경험치 1.5배는 캐릭터 Lv120 미만에만 적용 — 레벨 미입력 시 스팟 시작 레벨로 판단
  const burningApplies = (spot: HuntingSpot) =>
    burning && (level === "" ? spot.levelMin < BURNING.maxLevel : level < BURNING.maxLevel);

  // 보스/PQ가 아닌 일반 사냥터
  const filteredSpots = useMemo(() => {
    const dmg = damage ? parseInt(damage, 10) : null;
    const lvl = level === "" ? null : level;

    return HUNTING_SPOTS.filter((spot) => {
      // 보스 제외 (별도 섹션)
      if (isBoss(spot)) return false;

      // 레벨이 비어있으면 전체 표시
      if (lvl !== null) {
        const inRange = lvl >= spot.levelMin - 5 && lvl <= spot.levelMax + 5;
        if (!inRange) return false;
      }

      // 직업 필터
      if (job !== "all") {
        const jobKr = JOB_LABELS[job];
        const hasJobFilter = spot.jobs.length > 0 && !spot.jobs.includes("전체");
        if (hasJobFilter && !spot.jobs.includes(jobKr)) {
          return false;
        }
      }

      // 데미지 필터: PQ는 몬스터 없으므로 통과
      if (dmg && dmg > 0 && spot.monsters.length > 0) {
        const canKill = spot.monsters.some((m) => m.hp <= dmg * 10);
        if (!canKill) return false;
      }

      return true;
    }).sort((a, b) => {
      if (lvl === null) return a.levelMin - b.levelMin;

      const midA = (a.levelMin + a.levelMax) / 2;
      const midB = (b.levelMin + b.levelMax) / 2;
      const diffA = Math.abs(lvl - midA);
      const diffB = Math.abs(lvl - midB);

      const inA = lvl >= a.levelMin && lvl <= a.levelMax ? 0 : 1;
      const inB = lvl >= b.levelMin && lvl <= b.levelMax ? 0 : 1;
      if (inA !== inB) return inA - inB;

      return diffA - diffB;
    });
  }, [level, job, damage]);

  // 보스 콘텐츠
  const bossSpots = useMemo(() => {
    const lvl = level === "" ? null : level;
    return HUNTING_SPOTS.filter((spot) => {
      if (!isBoss(spot)) return false;
      if (lvl !== null) {
        if (lvl < spot.levelMin) return false;
      }
      return true;
    }).sort((a, b) => a.levelMin - b.levelMin);
  }, [level]);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-pixel text-2xl font-bold mb-1 text-ink">사냥터 추천</h1>
      <p className="text-sm text-dim mb-6">
        레벨과 직업에 맞는 최적의 사냥터를 찾아보세요 — 검증된 메이플랜드 데이터 기반
      </p>

      {/* 입력 영역 */}
      <div className="pixel-panel p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 레벨 */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              캐릭터 레벨
            </label>
            <input
              type="number"
              min={1}
              max={200}
              value={level}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  setLevel("");
                  return;
                }
                const v = parseInt(raw, 10);
                if (!isNaN(v) && v >= 1 && v <= 200) setLevel(v);
              }}
              className="pixel-input w-full px-3 py-2 text-sm"
            />
          </div>

          {/* 직업 */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              직업 선택
            </label>
            <select
              value={job}
              onChange={(e) => setJob(e.target.value as Job)}
              className="pixel-input w-full px-3 py-2 text-sm"
            >
              {Object.entries(JOB_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* 1타 데미지 */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              1타 데미지 <span className="text-dim font-normal">(선택)</span>
            </label>
            <input
              type="number"
              min={0}
              placeholder="미입력시 무시"
              value={damage}
              onChange={(e) => setDamage(e.target.value)}
              className="pixel-input w-full px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* 버닝/본섭 토글 */}
        <div className="mt-4 pt-3 border-t border-edge/40 flex items-start gap-3 flex-wrap">
          <button
            onClick={() => setBurning((v) => !v)}
            className={`font-pixel text-[12px] px-3 py-1.5 shrink-0 ${
              burning ? "pixel-btn" : "bg-surface2 text-dim hover:text-mush border-2 border-edge"
            }`}
          >
            🔥 {BURNING.label} 기준 {burning ? "ON" : "OFF"}
          </button>
          <p className="text-xs text-dim flex-1 min-w-[14rem]">
            {burning
              ? `Lv.${BURNING.maxLevel} 미만 경험치 ${BURNING.expMultiplier}배 적용 중 · ${BURNING.patchNote}`
              : "본섭(일반 월드) 기준 수치입니다. 버닝 월드는 토글을 켜세요."}
          </p>
        </div>
      </div>

      {/* 결과 */}
      {filteredSpots.length === 0 ? (
        <div className="pixel-panel p-8 text-center text-dim">
          <p className="text-lg mb-1">추천 사냥터가 없습니다</p>
          <p className="text-sm">레벨 또는 데미지 조건을 조정해보세요</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-dim">
            {level !== "" ? `Lv.${level}` : "전체 레벨"} {JOB_LABELS[job]} 기준 추천 사냥터 <span className="font-bold text-maple">{filteredSpots.length}곳</span>
          </p>

          {filteredSpots.map((spot, idx) => {
            const isInRange = level !== "" && level >= spot.levelMin && level <= spot.levelMax;
            const isPQSpot = isPQ(spot);
            const jobsDisplay = spot.jobs.filter((j) => j !== "전체");

            return (
              <div
                key={spot.id}
                className={`bg-surface border-2 overflow-hidden ${
                  isInRange
                    ? isPQSpot
                      ? "border-green-200 dark:border-green-800"
                      : "border-maple"
                    : "border-edge"
                }`}
              >
                {/* 헤더 */}
                <div className="px-5 py-4 flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`font-pixel flex-shrink-0 w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center mt-0.5 ${
                      isPQSpot
                        ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400"
                        : "bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] text-maple"
                    }`}>
                      {isPQSpot ? "PQ" : idx + 1}
                    </div>
                    <div>
                      <h3 className="font-pixel font-bold text-ink">{spot.mapName}</h3>
                      {spot.mapNameEn && (
                        <p className="text-xs text-dim">{spot.mapNameEn}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                          Lv.{spot.levelMin}~{spot.levelMax}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-surface2 text-dim rounded">
                          {spot.region}
                        </span>
                        {isInRange && (
                          <span className="text-xs px-2 py-0.5 bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] text-maple rounded font-medium">
                            적정 레벨
                          </span>
                        )}
                        {isPQSpot && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded font-medium">
                            파티퀘스트
                          </span>
                        )}
                        {jobsDisplay.length > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                            {jobsDisplay.join(", ")} 추천
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="font-pixel text-xs text-dim">
                      시간당 예상 경험치{burningApplies(spot) && <span className="text-mush"> 🔥1.5배</span>}
                    </p>
                    <p className="font-pixel text-lg font-bold text-maple">
                      {spot.expPerHour > 0
                        ? formatExpShort(Math.round(spot.expPerHour * (burningApplies(spot) ? BURNING.expMultiplier : 1)))
                        : "-"}
                    </p>
                  </div>
                </div>

                {/* 몬스터 목록 */}
                <div className="px-5 pb-4">
                  {spot.monsters.length > 0 ? (
                    <div className="bg-surface2 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-dim text-xs">
                            <th className="text-left px-3 py-2 font-medium">몬스터</th>
                            <th className="text-center px-3 py-2 font-medium">레벨</th>
                            <th className="text-right px-3 py-2 font-medium">HP</th>
                            <th className="text-right px-3 py-2 font-medium">EXP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {spot.monsters.map((m) => {
                            const dmg = damage ? parseInt(damage, 10) : null;
                            const canOneshot = dmg ? dmg >= m.hp : null;
                            return (
                              <tr key={m.name} className="border-t border-edge/40">
                                <td className="px-3 py-2 font-medium text-ink">{m.name}</td>
                                <td className="px-3 py-2 text-center text-dim">Lv.{m.level}</td>
                                <td className="px-3 py-2 text-right text-ink">
                                  {formatNumber(m.hp)}
                                  {canOneshot !== null && (
                                    <span className={`ml-1 text-xs ${canOneshot ? "text-green-600" : "text-red-500"}`}>
                                      {canOneshot ? "(1타)" : "(X)"}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right text-maple font-medium">
                                  {formatNumber(m.exp)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-surface2 rounded-lg px-3 py-3 text-sm text-dim text-center">
                      {isPQSpot ? "파티퀘스트 — 몬스터 대신 스테이지 클리어로 경험치 획득" : "몬스터 정보 없음"}
                    </div>
                  )}

                  {/* 팁 */}
                  {spot.tips && (
                    <div className="mt-3">
                      <p className="text-sm text-dim flex gap-2">
                        <span className="text-maple flex-shrink-0">-</span>
                        {spot.tips}
                      </p>
                    </div>
                  )}

                  {/* 파퀘 상세는 /pq가 원본 */}
                  {isPQSpot && (
                    <Link href="/pq" className="mt-2 inline-block text-xs text-green-700 dark:text-green-400 hover:underline">
                      파티퀘스트 보상·효율 비교 →
                    </Link>
                  )}

                  {/* 출처 */}
                  {spot.source && (
                    <p className="mt-2 text-xs text-dim">
                      출처: {spot.source}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 보스런 섹션 */}
      {bossSpots.length > 0 && (
        <div className="mt-8">
          <h2 className="font-pixel text-xl font-bold mb-4 flex items-center gap-2 text-ink">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 text-xs font-bold">B</span>
            보스런
          </h2>
          <div className="space-y-4">
            {bossSpots.map((spot) => {
              const isInRange = level !== "" && level >= spot.levelMin;
              return (
                <div
                  key={spot.id}
                  className={`bg-surface border-2 overflow-hidden ${
                    isInRange ? "border-red-200 dark:border-red-800" : "border-edge"
                  }`}
                >
                  <div className="px-5 py-4 flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="font-pixel flex-shrink-0 w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 text-sm font-bold flex items-center justify-center mt-0.5">
                        BOSS
                      </div>
                      <div>
                        <h3 className="font-pixel font-bold text-ink">{spot.mapName}</h3>
                        {spot.mapNameEn && (
                          <p className="text-xs text-dim">{spot.mapNameEn}</p>
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded font-medium">
                            Lv.{spot.levelMin}+
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-surface2 text-dim rounded">
                            {spot.region}
                          </span>
                          {isInRange && (
                            <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded font-medium">
                              참여 가능
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 pb-4">
                    {spot.monsters.length > 0 && (
                      <div className="bg-surface2 rounded-lg overflow-hidden mb-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-dim text-xs">
                              <th className="text-left px-3 py-2 font-medium">보스</th>
                              <th className="text-center px-3 py-2 font-medium">레벨</th>
                              <th className="text-right px-3 py-2 font-medium">HP</th>
                              <th className="text-right px-3 py-2 font-medium">EXP</th>
                            </tr>
                          </thead>
                          <tbody>
                            {spot.monsters.map((m) => (
                              <tr key={m.name} className="border-t border-edge/40">
                                <td className="px-3 py-2 font-medium text-ink">{m.name}</td>
                                <td className="px-3 py-2 text-center text-dim">Lv.{m.level}</td>
                                <td className="px-3 py-2 text-right text-ink">{formatNumber(m.hp)}</td>
                                <td className="px-3 py-2 text-right text-maple font-medium">{formatNumber(m.exp)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {spot.tips && (
                      <p className="text-sm text-dim flex gap-2">
                        <span className="text-red-400 flex-shrink-0">-</span>
                        {spot.tips}
                      </p>
                    )}

                    {spot.source && (
                      <p className="mt-2 text-xs text-dim">
                        출처: {spot.source}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 전체 사냥터 레벨 맵 */}
      <div className="mt-8 pixel-panel p-5">
        <h2 className="font-pixel font-bold mb-4 text-ink">레벨 구간별 사냥터 총정리</h2>
        <div className="space-y-2">
          {HUNTING_SPOTS.filter((s) => !isBoss(s)).map((spot) => {
            const isHighlighted = level !== "" && level >= spot.levelMin && level <= spot.levelMax;
            return (
              <div
                key={spot.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isHighlighted ? "bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)]" : "hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]"
                }`}
              >
                <span
                  className={`flex-shrink-0 text-xs px-2 py-1 rounded font-bold min-w-[5.5rem] text-center ${
                    isHighlighted
                      ? "bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] text-maple"
                      : "bg-surface2 text-dim"
                  }`}
                >
                  Lv.{spot.levelMin}~{spot.levelMax}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isHighlighted ? "text-maple" : "text-ink"}`}>
                    {spot.mapName}
                    {isPQ(spot) && <span className="ml-1 text-xs text-green-600 dark:text-green-400">[PQ]</span>}
                  </p>
                  <p className="text-xs text-dim truncate">
                    {spot.monsters.length > 0
                      ? spot.monsters.map((m) => m.name).join(", ")
                      : isPQ(spot)
                        ? "파티퀘스트"
                        : ""}
                  </p>
                </div>
                <span className="text-xs text-dim flex-shrink-0">
                  {spot.region}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
