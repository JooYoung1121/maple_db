"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface EffMob {
  id: number;
  name_kr: string | null;
  level: number;
  hp: number;
  exp: number;
  ratio: number;
  map_count: number;
  total_spawns: number | null;
  count?: number | null;
}

interface EffMap {
  map_id: number;
  name_kr: string | null;
  street_name: string | null;
  mobs: EffMob[];
  total_count: number | null;
  out_of_range_count: number;
  weighted_ratio: number | null;
  exp_per_gen: number | null;
  floors: number | null;
  width: number | null;
  estimated: boolean;
}

interface EffResponse {
  min_level: number;
  max_level: number;
  mobs: EffMob[];
  maps: EffMap[];
  total_maps: number;
}

function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

function hideOnError(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.visibility = "hidden";
}

// 체경비 등급 색 — 낮을수록 꿀
function ratioClass(r: number | null): string {
  if (r === null) return "text-dim";
  if (r <= 20) return "text-emerald-600 dark:text-emerald-400";
  if (r <= 35) return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

function ratioLabel(r: number | null): string {
  if (r === null) return "-";
  if (r <= 20) return "꿀";
  if (r <= 35) return "보통";
  return "빡셈";
}

// 스폰 분포 요약 — 층수·가로폭으로 지형 성격 추정
function terrainSummary(floors: number | null, width: number | null): string | null {
  if (floors === null || width === null) return null;
  if (floors <= 2 && width >= 900) return "일자형";
  if (floors >= 8) return "복층";
  return `${floors}층`;
}

export default function HpExpPage() {
  const [level, setLevel] = useState<number | "">("");
  const [range, setRange] = useState(10);
  const [sort, setSort] = useState<"ratio" | "exp">("ratio");
  const [tab, setTab] = useState<"maps" | "mobs">("maps");
  const [data, setData] = useState<EffResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [minLv, maxLv] = useMemo(() => {
    if (level === "" || !Number.isFinite(Number(level))) return [1, 200];
    const lv = Number(level);
    return [Math.max(1, lv - range), Math.min(200, lv + range)];
  }, [level, range]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    const qs = new URLSearchParams({
      min_level: String(minLv),
      max_level: String(maxLv),
      sort,
    });
    fetch(`${API_BASE}/api/efficiency?${qs}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: EffResponse) => {
        if (alive) setData(d);
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [minLv, maxLv, sort]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="font-pixel text-2xl font-bold text-ink">체경비 사냥터</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-dim">
          체경비 = 몹 체력 ÷ 경험치. <span className="font-semibold text-ink">경험치 1을 얻기 위해 깎아야 하는 체력</span>이라
          낮을수록 꿀입니다. 맵별 몹 마릿수·배치(스폰 데이터)와 조합해 어디로 가면 좋을지 추천합니다.
        </p>
      </header>

      <section className="pixel-panel p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="mb-1 block text-xs text-dim">내 레벨</span>
            <input
              type="number"
              min={1}
              max={200}
              value={level}
              placeholder="전체"
              onChange={(e) => {
                const v = e.target.value;
                setLevel(v === "" ? "" : Math.max(1, Math.min(200, Number(v))));
              }}
              className="w-24 rounded border border-edge bg-surface px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-dim">몹 레벨 범위 (±{range})</span>
            <input
              type="range"
              min={3}
              max={30}
              value={range}
              onChange={(e) => setRange(Number(e.target.value))}
              className="w-40 accent-[var(--maple,#f97316)]"
              disabled={level === ""}
            />
          </label>
          <div className="text-sm text-dim">
            대상 몹: <span className="font-semibold text-maple">Lv.{minLv} ~ {maxLv}</span>
          </div>
          <div className="ml-auto flex gap-1">
            {([
              ["ratio", "체경비순"],
              ["exp", "한 젠 경험치순"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={`pixel-btn px-3 py-2 text-xs ${sort === key ? "bg-maple text-white" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <nav className="flex gap-1">
        {([
          ["maps", "맵 추천"],
          ["mobs", "몹 랭킹"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`pixel-btn px-4 py-2 text-sm ${tab === key ? "bg-maple text-white" : ""}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {loading && <div className="pixel-panel p-8 text-center text-sm text-dim">불러오는 중...</div>}
      {error && <div className="pixel-panel p-8 text-center text-sm text-red-500">데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>}

      {!loading && !error && data && tab === "maps" && (
        <section className="space-y-3">
          {data.maps.length === 0 && (
            <div className="pixel-panel p-8 text-center text-sm text-dim">이 레벨 범위에 추천할 맵이 없습니다. 범위를 넓혀보세요.</div>
          )}
          {data.maps.map((m, i) => (
            <article key={m.map_id} className="pixel-panel p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-pixel text-sm font-bold text-dim">#{i + 1}</span>
                <Link href={`/maps/${m.map_id}`} className="font-semibold text-ink hover:text-maple">
                  {m.name_kr || `맵 ${m.map_id}`}
                </Link>
                {m.street_name && <span className="text-xs text-dim">{m.street_name}</span>}
                <span className={`ml-auto font-pixel text-sm font-bold ${ratioClass(m.weighted_ratio)}`}>
                  체경비 {m.weighted_ratio ?? "-"} · {ratioLabel(m.weighted_ratio)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dim">
                {m.estimated ? (
                  <span>마릿수 데이터 없음 (구조물 젠 등) — 서식 몹 기준 추천</span>
                ) : (
                  <>
                    <span>총 <span className="font-semibold text-ink">{m.total_count}마리</span> 젠</span>
                    {m.exp_per_gen !== null && <span>한 젠 경험치 <span className="font-semibold text-ink">{formatNumber(m.exp_per_gen)}</span></span>}
                    {terrainSummary(m.floors, m.width) && <span>지형 {terrainSummary(m.floors, m.width)}</span>}
                    {m.width !== null && m.width > 0 && <span>폭 {formatNumber(m.width)}px</span>}
                    {m.out_of_range_count > 0 && <span className="text-amber-600 dark:text-amber-400">범위 밖 몹 +{m.out_of_range_count}마리 주의</span>}
                  </>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {m.mobs.map((mob) => (
                  <Link
                    key={mob.id}
                    href={`/mobs/${mob.id}`}
                    className="flex items-center gap-1.5 rounded bg-surface2 px-2 py-1 text-xs text-ink hover:text-maple"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${API_BASE}/api/icon/mob/${mob.id}`} alt="" className="h-6 w-6 object-contain" loading="lazy" onError={hideOnError} />
                    <span>{mob.name_kr || mob.id}</span>
                    {mob.count !== null && mob.count !== undefined && <span className="text-dim">×{mob.count}</span>}
                    <span className={`font-semibold ${ratioClass(mob.ratio)}`}>{mob.ratio}</span>
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}

      {!loading && !error && data && tab === "mobs" && (
        <section className="pixel-panel overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-edge text-left text-xs text-dim">
              <tr>
                <th className="px-4 py-2">몹</th>
                <th className="px-4 py-2">Lv</th>
                <th className="px-4 py-2">HP</th>
                <th className="px-4 py-2">EXP</th>
                <th className="px-4 py-2">체경비</th>
                <th className="px-4 py-2">서식 맵</th>
                <th className="px-4 py-2">총 마릿수</th>
              </tr>
            </thead>
            <tbody>
              {data.mobs.map((mob) => (
                <tr key={mob.id} className="border-b border-edge/40 last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/mobs/${mob.id}`} className="flex items-center gap-2 font-medium text-ink hover:text-maple">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${API_BASE}/api/icon/mob/${mob.id}`} alt="" className="h-7 w-7 object-contain" loading="lazy" onError={hideOnError} />
                      {mob.name_kr || mob.id}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-dim">{mob.level}</td>
                  <td className="px-4 py-2 text-dim">{formatNumber(mob.hp)}</td>
                  <td className="px-4 py-2 text-dim">{formatNumber(mob.exp)}</td>
                  <td className={`px-4 py-2 font-pixel font-bold ${ratioClass(mob.ratio)}`}>{mob.ratio}</td>
                  <td className="px-4 py-2 text-dim">{mob.map_count > 0 ? `${mob.map_count}곳` : "-"}</td>
                  <td className="px-4 py-2 text-dim">{mob.total_spawns !== null ? `${mob.total_spawns}마리` : "미상"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="rounded-lg border border-edge bg-surface2 p-4 text-xs leading-relaxed text-dim">
        <p>
          · 마릿수·배치는 원작(GMS) 스폰 데이터 기준이며, 메이플랜드의 실제 젠 수·리젠 속도와 다를 수 있습니다.
          에델슈타인 몹의 경험치는 9/7 커뮤니티 실측(본섭 환산)이 반영돼 있습니다.
        </p>
        <p className="mt-1">
          · 체경비는 순수 스탯 지표입니다 — 명중률, 몹 공격력, 접근성(지형·이동)은 별도로 고려하세요.
          직업별 추천은 <Link href="/hunt" className="text-maple hover:underline">사냥터 추천</Link>,
          한타임 계산은 <Link href="/exp" className="text-maple hover:underline">경험치 계산기</Link>를 참고.
        </p>
      </section>
    </div>
  );
}
