"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getMob } from "@/lib/api";
import type { Mob, MobDrop, MobSpawn } from "@/lib/types";

export default function MobDetailPage() {
  const { id } = useParams();
  const [mob, setMob] = useState<Mob | null>(null);
  const [drops, setDrops] = useState<MobDrop[]>([]);
  const [spawns, setSpawns] = useState<MobSpawn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getMob(Number(id))
      .then((d) => { setMob(d.mob); setDrops(d.drops || []); setSpawns(d.spawn_maps || []); })
      .catch(() => setMob(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-12 text-gray-400">로딩 중...</div>;
  if (!mob) return <div className="text-center py-12 text-gray-400">몬스터를 찾을 수 없습니다</div>;

  const statRows = [
    ["레벨", mob.level],
    ["HP", mob.hp?.toLocaleString()],
    ["MP", mob.mp?.toLocaleString()],
    ["EXP", mob.exp?.toLocaleString()],
    ["방어력", mob.defense],
    ["명중률", mob.accuracy],
    ["회피율", mob.evasion],
    ["물리공격력", mob.physical_damage],
    ["마법공격력", mob.magic_damage],
    ["마법방어력", mob.magic_defense],
    ["이동속도", mob.speed],
  ].filter(([, val]) => val !== undefined && val !== null && val !== 0);

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/mobs" className="text-sm text-orange-500 hover:underline">&larr; 몬스터 목록</Link>
      <div className="bg-white border border-gray-200 rounded-xl p-6 mt-3">
        <div className="flex items-start gap-4">
          {mob.icon_url && <img src={mob.icon_url} alt={mob.name} className="w-16 h-16 object-contain" />}
          <div>
            <h1 className="text-2xl font-bold">
              {(() => {
                const kr = mob.names_en?.find(n => n.source === "kms");
                return kr ? (
                  <>{kr.name_en} <span className="text-lg font-normal text-gray-500">({mob.name})</span></>
                ) : mob.name;
              })()}
            </h1>
            <div className="flex flex-wrap gap-1 mt-1">
              {mob.is_boss === 1 && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded inline-block">보스</span>}
              {mob.is_undead === 1 && <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded inline-block">언데드</span>}
              {mob.spawn_time && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded inline-block">젠타임: {mob.spawn_time}</span>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          {statRows.map(([label, val]) => (
            <div key={String(label)}><span className="text-sm text-gray-500">{label}</span><p className="font-medium">{val ?? "-"}</p></div>
          ))}
        </div>
      </div>

      {drops.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3">드롭 아이템</h2>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {drops.map((d) => (
              <Link key={d.id} href={`/items/${d.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-orange-50">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{d.name}</span>
                  {d.category && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{d.category}</span>}
                </div>
                {d.drop_rate != null && <span className="text-sm text-gray-400">{(d.drop_rate * 100).toFixed(2)}%</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {spawns.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3">출현 맵</h2>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {spawns.map((s) => (
              <Link key={s.id} href={`/maps/${s.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-orange-50">
                <span className="font-medium">{s.name}</span>
                {s.area && <span className="text-sm text-gray-400">{s.area}</span>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
