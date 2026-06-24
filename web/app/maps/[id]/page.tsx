"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getMap } from "@/lib/api";
import type { MapData, MapMobSpawn, Npc, Portal } from "@/lib/types";

export default function MapDetailPage() {
  const { id } = useParams();
  const [map, setMap] = useState<MapData | null>(null);
  const [monsters, setMonsters] = useState<MapMobSpawn[]>([]);
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getMap(Number(id))
      .then((d) => { setMap(d.map); setMonsters(d.monsters || []); setNpcs(d.npcs || []); })
      .catch(() => setMap(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-12 text-dim">로딩 중...</div>;
  if (!map) return <div className="text-center py-12 text-dim">맵을 찾을 수 없습니다</div>;

  const portalLinks = (map.portals || []).filter(
    (p): p is Portal => Boolean(p && p.toMap && p.toMap !== 999999999)
  );

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/maps" className="text-sm text-maple hover:underline">&larr; 맵 목록</Link>
      <div className="pixel-panel p-6 mt-3">
        <h1 className="text-2xl font-bold">
          {(() => {
            const kr = map.names_en?.find(n => n.source === "kms");
            return kr ? (
              <>{kr.name_en} <span className="text-lg font-normal text-dim">({map.name})</span></>
            ) : map.name;
          })()}
        </h1>
        {map.is_town === 1 && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded mt-2 inline-block">마을</span>}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div><span className="text-sm text-dim">거리명</span><p className="font-medium">{map.street_name || "-"}</p></div>
          <div><span className="text-sm text-dim">지역</span><p className="font-medium">{map.area || "-"}</p></div>
        </div>

        {portalLinks.length > 0 && (
          <div className="mt-6">
            <h2 className="font-pixel text-lg font-semibold mb-3 text-ink">포탈</h2>
            <div className="pixel-panel divide-y divide-edge/40">
              {portalLinks.map((p, i) => (
                <Link key={i} href={`/maps/${p.toMap}`} className="flex items-center justify-between px-4 py-3 hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]">
                  <span className="font-medium">{p.portalName || `포탈 ${i + 1}`}</span>
                  <span className="text-sm text-dim">{p.toName || `맵 #${p.toMap}`}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {monsters.length > 0 && (
        <div className="mt-6">
          <h2 className="font-pixel text-lg font-semibold mb-3 text-ink">출현 몬스터</h2>
          <div className="pixel-panel divide-y divide-edge/40">
            {monsters.map((m) => (
                <Link key={m.mob_id} href={`/mobs/${m.mob_id}`} className="flex items-center justify-between px-4 py-3 hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]">
                <span className="font-medium">{m.mob_name_kr || m.mob_name}</span>
                <span className="text-sm text-dim flex items-center gap-2">
                  {m.spawn_count ? <span className="text-skill font-medium">젠 {m.spawn_count}마리</span> : null}
                  <span>Lv. {m.level}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {npcs.length > 0 && (
        <div className="mt-6">
          <h2 className="font-pixel text-lg font-semibold mb-3 text-ink">NPC</h2>
          <div className="pixel-panel divide-y divide-edge/40">
            {npcs.map((n) => (
              <Link key={n.id} href={`/npcs/${n.id}`} className="block px-4 py-3 hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)] font-medium">
                {n.name_kr || n.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
