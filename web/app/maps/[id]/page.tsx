"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getMap } from "@/lib/api";
import type { MapData, MapDetailData, MapDrop, MapMobSpawn, Npc, Portal } from "@/lib/types";

/* 몹별 스폰 점 색상 팔레트 (구조도·범례 공용) */
const MOB_COLORS = ["#f59e0b", "#3b82f6", "#22c55e", "#a855f7", "#ef4444", "#14b8a6", "#eab308", "#ec4899"];

/* 드랍템 카테고리 한글 라벨 */
const CATEGORY_KR: Record<string, string> = {
  Accessory: "장신구",
  Armor: "방어구",
  "Armor Scroll": "방어구 주문서",
  "Character Modification": "마스터리북",
  Consumable: "소비",
  Crafting: "제작 재료",
  "Equipment Modification": "장비 강화",
  "One-Handed Weapon": "한손 무기",
  "Two-Handed Weapon": "두손 무기",
  Weapon: "무기",
  "Weapon Scroll": "무기 주문서",
  "Special Scroll": "특수 주문서",
  Projectile: "표창·화살",
  "Random Reward": "랜덤 상자",
  Other: "기타",
};

const RENDER_BASE = "https://maplestory.io/api/gms/92/map";

/* ── 스폰 구조도 (footholds + 스폰 위치 SVG) ── */
function MapSchematic({
  detail, portals, mobColor, showSpawns, showPortals,
}: {
  detail: MapDetailData;
  portals: Portal[];
  mobColor: Map<number, string>;
  showSpawns: boolean;
  showPortals: boolean;
}) {
  const box = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const [x1, y1, x2, y2] of detail.footholds) { xs.push(x1, x2); ys.push(y1, y2); }
    for (const [x, y1, y2] of detail.ropes) { xs.push(x); ys.push(y1, y2); }
    for (const [, x, y] of detail.spawns) { xs.push(x); ys.push(y); }
    if (xs.length === 0 && detail.vr) {
      const [vx, vy, vw, vh] = detail.vr;
      xs.push(vx, vx + vw); ys.push(vy, vy + vh);
    }
    if (xs.length === 0) return null;
    const pad = 60;
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    const w = Math.max(...xs) - minX + pad;
    const h = Math.max(...ys) - minY + pad;
    return { minX, minY, w, h };
  }, [detail]);

  if (!box) return <p className="text-sm text-dim text-center py-8">구조 데이터가 없습니다</p>;

  /* 화면 크기에 맞춰 도트·선 두께를 맵 좌표계 기준으로 환산 */
  const unit = Math.max(box.w, box.h) / 100;
  const dotR = Math.max(5, unit * 1.1);

  return (
    <svg
      viewBox={`${box.minX} ${box.minY} ${box.w} ${box.h}`}
      className="w-full bg-[#0d0f14]"
      style={{ maxHeight: "70vh", aspectRatio: `${box.w} / ${box.h}` }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* 발판 */}
      {detail.footholds.map(([x1, y1, x2, y2], i) => (
        <line key={`f${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={x1 === x2 ? "#3a4152" : "#8b95ab"} strokeWidth={x1 === x2 ? unit * 0.35 : unit * 0.55} strokeLinecap="round" />
      ))}
      {/* 로프/사다리 */}
      {detail.ropes.map(([x, y1, y2, isLadder], i) => (
        <line key={`r${i}`} x1={x} y1={y1} x2={x} y2={y2}
          stroke={isLadder ? "#b08850" : "#5a8a5a"} strokeWidth={unit * 0.4} strokeDasharray={`${unit * 0.9} ${unit * 0.7}`} />
      ))}
      {/* 포탈 */}
      {showPortals && portals.map((p, i) =>
        p && typeof p.x === "number" && typeof p.y === "number" && p.toMap !== 999999999 ? (
          <g key={`p${i}`}>
            <rect x={p.x - dotR} y={p.y - dotR * 2.2} width={dotR * 2} height={dotR * 2.2} fill="#4f8ef7" opacity={0.9} rx={unit * 0.3} />
            <title>{`포탈 → ${p.to_name_kr || p.toName || p.toMap}`}</title>
          </g>
        ) : null
      )}
      {/* 스폰 위치 */}
      {showSpawns && detail.spawns.map(([mobId, x, y], i) => (
        <g key={`s${i}`}>
          <circle cx={x} cy={y - dotR} r={dotR} fill={mobColor.get(mobId) || "#f59e0b"} stroke="#0d0f14" strokeWidth={unit * 0.25} />
          <title>{`몹 #${mobId} (${x}, ${y})`}</title>
        </g>
      ))}
    </svg>
  );
}

/* ── 실사 렌더 이미지 ── */
function MapRender({ mapId }: { mapId: number }) {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  return (
    <div className="relative min-h-[200px] bg-[#0d0f14] flex items-center justify-center">
      {status === "loading" && (
        <p className="absolute text-sm text-dim animate-pulse">맵 이미지를 불러오는 중... (수 초 걸릴 수 있어요)</p>
      )}
      {status === "error" ? (
        <p className="text-sm text-dim py-10">이미지를 불러오지 못했습니다 (maplestory.io 응답 없음)</p>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${RENDER_BASE}/${mapId}/render`}
          alt="맵 렌더 이미지"
          className={`w-full h-auto ${status === "ok" ? "" : "opacity-0"}`}
          style={{ maxHeight: "75vh", objectFit: "contain" }}
          onLoad={() => setStatus("ok")}
          onError={() => setStatus("error")}
          loading="lazy"
        />
      )}
    </div>
  );
}

export default function MapDetailPage() {
  const { id } = useParams();
  const mapId = Number(id);
  const [map, setMap] = useState<MapData | null>(null);
  const [monsters, setMonsters] = useState<MapMobSpawn[]>([]);
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [detail, setDetail] = useState<MapDetailData | null>(null);
  const [drops, setDrops] = useState<MapDrop[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"schematic" | "render">("schematic");
  const [showSpawns, setShowSpawns] = useState(true);
  const [showPortals, setShowPortals] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getMap(Number(id))
      .then((d) => {
        setMap(d.map); setMonsters(d.monsters || []); setNpcs(d.npcs || []);
        setDetail(d.detail || null); setDrops(d.drops || []);
        setTab(d.detail && d.detail.footholds.length > 0 ? "schematic" : "render");
      })
      .catch(() => setMap(null))
      .finally(() => setLoading(false));
  }, [id]);

  /* 몹 → 색 배정 (스폰 수 많은 순) */
  const mobColor = useMemo(() => {
    const m = new Map<number, string>();
    monsters.forEach((mob, i) => m.set(mob.mob_id, MOB_COLORS[i % MOB_COLORS.length]));
    return m;
  }, [monsters]);

  const mobNameOf = useMemo(() => {
    const m = new Map<number, string>();
    monsters.forEach((mob) => m.set(mob.mob_id, mob.mob_name_kr || mob.mob_name));
    return m;
  }, [monsters]);

  if (loading) return <div className="text-center py-12 text-dim">로딩 중...</div>;
  if (!map) return <div className="text-center py-12 text-dim">맵을 찾을 수 없습니다</div>;

  const portalLinks = (map.portals || []).filter(
    (p): p is Portal => Boolean(p && p.toMap && p.toMap !== 999999999)
  );
  const totalSpawn = detail ? detail.spawns.length : null;
  const hasStructure = Boolean(detail && (detail.footholds.length > 0 || detail.spawns.length > 0));
  const dropsByCategory = drops.reduce<Record<string, MapDrop[]>>((acc, d) => {
    const c = d.category || "기타";
    (acc[c] = acc[c] || []).push(d);
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto">
      <Link href="/maps" className="text-sm text-maple hover:underline">&larr; 맵 검색</Link>

      {/* ── 헤더 ── */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-3 mb-1">
        <h1 className="text-2xl font-bold">{map.name_kr || map.name}</h1>
        {map.name_kr && <span className="text-sm text-dim">{map.name}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
        {(map.region_kr || map.street_name) && (
          <span className="px-2 py-0.5 border border-edge text-dim">{map.region_kr || map.street_name}</span>
        )}
        {map.is_town === 1 && <span className="px-2 py-0.5 border border-green-500 text-green-500">마을</span>}
        {typeof map.mob_rate === "number" && map.mob_rate !== 1 && (
          <span className="px-2 py-0.5 border border-maple text-maple">몹 배율 ×{Number(map.mob_rate.toFixed(2))}</span>
        )}
        {detail?.is_swim && <span className="px-2 py-0.5 border border-blue-400 text-blue-400">수중 맵</span>}
        {totalSpawn !== null && totalSpawn > 0 && (
          <span className="px-2 py-0.5 border border-skill text-skill font-medium">총 젠 {totalSpawn}마리</span>
        )}
        {detail?.bgm && <span className="px-2 py-0.5 border border-edge text-dim">♪ {detail.bgm.split("/").pop()}</span>}
      </div>

      {/* ── 맵 뷰어 ── */}
      <div className="pixel-panel p-0 overflow-hidden mb-2">
        <div className="flex items-center justify-between border-b-2 border-edge px-2">
          <div className="flex">
            {hasStructure && (
              <button
                onClick={() => setTab("schematic")}
                className={`px-4 py-2 text-sm font-pixel transition-colors ${tab === "schematic" ? "text-maple border-b-2 border-maple -mb-0.5" : "text-dim hover:text-ink"}`}
              >
                스폰 구조도
              </button>
            )}
            <button
              onClick={() => setTab("render")}
              className={`px-4 py-2 text-sm font-pixel transition-colors ${tab === "render" ? "text-maple border-b-2 border-maple -mb-0.5" : "text-dim hover:text-ink"}`}
            >
              실사 맵
            </button>
          </div>
          {tab === "schematic" && (
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1 cursor-pointer text-dim hover:text-ink">
                <input type="checkbox" checked={showSpawns} onChange={(e) => setShowSpawns(e.target.checked)} />
                스폰
              </label>
              <label className="flex items-center gap-1 cursor-pointer text-dim hover:text-ink">
                <input type="checkbox" checked={showPortals} onChange={(e) => setShowPortals(e.target.checked)} />
                포탈
              </label>
            </div>
          )}
        </div>
        {tab === "schematic" && detail ? (
          <MapSchematic detail={detail} portals={map.portals || []} mobColor={mobColor} showSpawns={showSpawns} showPortals={showPortals} />
        ) : (
          <MapRender mapId={mapId} />
        )}
      </div>

      {/* 범례 */}
      {tab === "schematic" && detail && detail.spawns.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 text-xs text-dim">
          {monsters.filter((m) => (m.spawn_points ?? 0) > 0).map((m) => (
            <span key={m.mob_id} className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: mobColor.get(m.mob_id) }} />
              {m.mob_name_kr || m.mob_name} ×{m.spawn_points}
            </span>
          ))}
          <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 bg-[#4f8ef7]" />포탈</span>
        </div>
      )}
      <p className="text-[11px] text-dim mb-6">
        ※ 구조도·스폰 위치·젠 수는 원작(GMS v92) 데이터 기준 참고값으로, 메이플랜드 실서버와 다를 수 있습니다.
      </p>

      {/* ── 출현 몬스터 ── */}
      {monsters.length > 0 && (
        <div className="mb-6">
          <h2 className="font-pixel text-lg font-semibold mb-2 text-ink">👹 출현 몬스터</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {monsters.map((m) => {
              const inner = (
                <>
                  <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: mobColor.get(m.mob_id) }} />
                  {m.icon_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.icon_url} alt="" className="w-9 h-9 object-contain shrink-0" loading="lazy" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">{m.mob_name_kr || m.mob_name}</span>
                    <span className="block text-xs text-dim">
                      Lv.{m.level}{m.hp ? ` · HP ${m.hp.toLocaleString()}` : ""}
                    </span>
                  </span>
                  {(m.spawn_points ?? 0) > 0 ? (
                    <span className="text-sm text-skill font-semibold shrink-0">×{m.spawn_points}</span>
                  ) : m.spawn_count ? (
                    <span className="text-xs text-dim shrink-0">젠 {m.spawn_count}</span>
                  ) : null}
                </>
              );
              const cls = "pixel-card flex items-center gap-2.5 px-3 py-2.5";
              return m.in_reference === false ? (
                <div key={m.mob_id} className={cls}>{inner}</div>
              ) : (
                <Link key={m.mob_id} href={`/mobs/${m.mob_id}`} className={`${cls} hover:border-maple transition-colors`}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 드랍템 ── */}
      {drops.length > 0 && (
        <div className="mb-6">
          <h2 className="font-pixel text-lg font-semibold mb-1 text-ink">💰 이 맵에서 얻는 드랍템 <span className="text-sm font-normal text-dim">({drops.length}종)</span></h2>
          <p className="text-[11px] text-dim mb-2">출현 몬스터들의 드랍 목록 합계 — 아이템에 마우스를 올리면 어떤 몹이 떨구는지 표시됩니다</p>
          {Object.entries(dropsByCategory).map(([cat, list]) => (
            <div key={cat} className="mb-3">
              <h3 className="text-xs font-pixel text-dim mb-1.5">{CATEGORY_KR[cat] || cat} ({list.length})</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                {list.map((d) => (
                  <Link
                    key={d.item_id}
                    href={`/items/${d.item_id}`}
                    title={`드랍: ${d.mob_ids.map((mid) => mobNameOf.get(mid) || `#${mid}`).join(", ")}`}
                    className="pixel-card flex items-center gap-2 px-2.5 py-1.5 hover:border-maple transition-colors"
                  >
                    {d.icon_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.icon_url} alt="" className="w-6 h-6 object-contain shrink-0" loading="lazy" />
                    )}
                    <span className="text-xs truncate">{d.item_name_kr || d.item_name}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 연결 맵 ── */}
      {portalLinks.length > 0 && (
        <div className="mb-6">
          <h2 className="font-pixel text-lg font-semibold mb-2 text-ink">🚪 연결 맵</h2>
          <div className="pixel-panel divide-y divide-edge/40">
            {portalLinks.map((p, i) => (
              <Link key={i} href={`/maps/${p.toMap}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]">
                <span className="font-medium text-sm">{p.to_name_kr || p.toName || `맵 #${p.toMap}`}</span>
                <span className="text-xs text-dim">{p.portalName}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── NPC ── */}
      {npcs.length > 0 && (
        <div className="mb-6">
          <h2 className="font-pixel text-lg font-semibold mb-2 text-ink">NPC</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {npcs.map((n) => (
              <Link key={n.id} href={`/npcs/${n.id}`} className="pixel-card px-3 py-2 text-sm hover:border-maple transition-colors truncate">
                {n.name_kr || n.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
