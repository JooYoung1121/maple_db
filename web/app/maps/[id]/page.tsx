"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getMap } from "@/lib/api";
import type { MapData, Npc } from "@/lib/types";

export default function MapDetailPage() {
  const { id } = useParams();
  const [map, setMap] = useState<MapData | null>(null);
  const [monsters, setMonsters] = useState<{ mob_id: number; mob_name: string; level: number }[]>([]);
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

  if (loading) return <div className="text-center py-12 text-gray-400">로딩 중...</div>;
  if (!map) return <div className="text-center py-12 text-gray-400">맵을 찾을 수 없습니다</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/maps" className="text-sm text-orange-500 hover:underline">&larr; 맵 목록</Link>
      <div className="bg-white border border-gray-200 rounded-xl p-6 mt-3">
        <h1 className="text-2xl font-bold">
          {(() => {
            const kr = map.names_en?.find(n => n.source === "kms");
            return kr ? (
              <>{kr.name_en} <span className="text-lg font-normal text-gray-500">({map.name})</span></>
            ) : map.name;
          })()}
        </h1>
        {map.is_town === 1 && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded mt-2 inline-block">마을</span>}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div><span className="text-sm text-gray-500">거리명</span><p className="font-medium">{map.street_name || "-"}</p></div>
          <div><span className="text-sm text-gray-500">지역</span><p className="font-medium">{map.area || "-"}</p></div>
        </div>

        {map.portals && map.portals.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-3">포탈</h2>
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {map.portals.filter(p => p.toMap && p.toMap !== 999999999).map((p, i) => (
                <Link key={i} href={`/maps/${p.toMap}`} className="flex items-center justify-between px-4 py-3 hover:bg-orange-50">
                  <span className="font-medium">{p.portalName || `포탈 ${i + 1}`}</span>
                  <span className="text-sm text-gray-400">{p.toName || `맵 #${p.toMap}`}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {monsters.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3">출현 몬스터</h2>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {monsters.map((m) => (
              <Link key={m.mob_id} href={`/mobs/${m.mob_id}`} className="flex items-center justify-between px-4 py-3 hover:bg-orange-50">
                <span className="font-medium">{m.mob_name}</span>
                <span className="text-sm text-gray-400">Lv. {m.level}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {npcs.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3">NPC</h2>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {npcs.map((n) => (
              <Link key={n.id} href={`/npcs/${n.id}`} className="block px-4 py-3 hover:bg-orange-50 font-medium">
                {n.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
