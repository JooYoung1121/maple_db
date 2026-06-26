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

  if (loading) return <div className="text-center py-12 text-dim">로딩 중...</div>;
  if (!mob) return <div className="text-center py-12 text-dim">몬스터를 찾을 수 없습니다</div>;

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
      <Link href="/mobs" className="text-sm text-maple hover:underline">&larr; 몬스터 목록</Link>
      <div className="pixel-panel p-6 mt-3">
        <div className="flex items-start gap-4">
          {mob.icon_url && <img src={mob.icon_url} alt={mob.name} className="w-16 h-16 object-contain" />}
          <div>
            <h1 className="font-pixel text-2xl font-bold">
              {(() => {
                const kr = mob.names_en?.find(n => n.source === "kms");
                return kr ? (
                  <>{kr.name_en} <span className="text-lg font-normal text-dim">({mob.name})</span></>
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
            <div key={String(label)}><span className="text-sm text-dim">{label}</span><p className="font-medium">{val ?? "-"}</p></div>
          ))}
        </div>
      </div>

      {drops.length > 0 && (
        <div className="mt-6">
          <h2 className="font-pixel text-lg font-semibold mb-3">드롭 아이템</h2>
          <div className="pixel-panel divide-y divide-edge/40">
            {drops.map((d) => (
              <Link key={d.id} href={`/items/${d.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{d.name_kr || d.name}</span>
                  {d.category && <span className="text-xs text-dim bg-surface2 px-1.5 py-0.5 rounded">{d.category}</span>}
                </div>
                {d.drop_rate != null && <span className="text-sm text-dim">{(d.drop_rate * 100).toFixed(2)}%</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {spawns.length > 0 && (
        <div className="mt-6">
          <h2 className="font-pixel text-lg font-semibold mb-1">출현 맵</h2>
          {spawns.some((s) => s.spawn_count) && (
            <p className="text-[11px] text-dim mb-2">※ 젠 수는 원작(KMS) 기준 참고값 · 메이플랜드 자체 젠과 다를 수 있습니다</p>
          )}
          <div className="pixel-panel divide-y divide-edge/40">
            {spawns.map((s) => (
              <Link key={s.id} href={`/maps/${s.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]">
                <span className="font-medium">{s.name_kr || s.name}</span>
                <span className="text-sm text-dim flex items-center gap-2">
                  {s.spawn_count ? <span className="text-skill font-medium">젠 {s.spawn_count}마리</span> : null}
                  {s.area && <span>{s.area}</span>}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
