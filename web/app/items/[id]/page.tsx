"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getItem } from "@/lib/api";
import type { Item } from "@/lib/types";

export default function ItemDetailPage() {
  const { id } = useParams();
  const [item, setItem] = useState<Item | null>(null);
  const [droppedBy, setDroppedBy] = useState<{ mob_id: number; mob_name: string; drop_rate: number | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getItem(Number(id))
      .then((d) => { setItem(d.item); setDroppedBy(d.dropped_by || []); })
      .catch(() => setItem(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-12 text-gray-400">로딩 중...</div>;
  if (!item) return <div className="text-center py-12 text-gray-400">아이템을 찾을 수 없습니다</div>;

  const stats = item.stats ? JSON.parse(item.stats) : null;

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/items" className="text-sm text-orange-500 hover:underline">&larr; 아이템 목록</Link>
      <div className="bg-white border border-gray-200 rounded-xl p-6 mt-3">
        <div className="flex items-start gap-4">
          {item.icon_url && <img src={item.icon_url} alt={item.name} className="w-16 h-16 object-contain" />}
          <div>
            <h1 className="text-2xl font-bold">
              {(() => {
                const kr = item.names_en?.find(n => n.source === "kms");
                return kr ? (
                  <>{kr.name_en} <span className="text-lg font-normal text-gray-500">({item.name})</span></>
                ) : item.name;
              })()}
            </h1>
            <div className="flex gap-2 mt-1 flex-wrap">
              {item.category && <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">{item.category}</span>}
              {item.subcategory && <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">{item.subcategory}</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div><span className="text-sm text-gray-500">레벨 요구</span><p className="font-medium">{item.level_req || "-"}</p></div>
          <div><span className="text-sm text-gray-500">직업 요구</span><p className="font-medium">{item.job_req || "공용"}</p></div>
        </div>

        {(item.attack_speed || item.upgrade_slots || item.price) && (
          <div className="grid grid-cols-3 gap-4 mt-4">
            {item.attack_speed && <div><span className="text-sm text-gray-500">공격속도</span><p className="font-medium">{item.attack_speed}</p></div>}
            {item.upgrade_slots != null && item.upgrade_slots > 0 && <div><span className="text-sm text-gray-500">업그레이드 슬롯</span><p className="font-medium">{item.upgrade_slots}</p></div>}
            {item.price != null && item.price > 0 && <div><span className="text-sm text-gray-500">가격</span><p className="font-medium">{item.price.toLocaleString()} 메소</p></div>}
          </div>
        )}

        {item.description && (
          <div className="mt-4">
            <span className="text-sm text-gray-500">설명</span>
            <p className="mt-1">{item.description}</p>
          </div>
        )}

        {stats && Object.keys(stats).length > 0 && (
          <div className="mt-4">
            <span className="text-sm text-gray-500">스탯</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {Object.entries(stats).map(([k, v]) => (
                <span key={k} className="px-2 py-1 bg-orange-50 text-orange-700 rounded text-sm font-medium">
                  {k}: {String(v)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {droppedBy.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3">드롭 몬스터</h2>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {droppedBy.map((m) => (
              <Link key={m.mob_id} href={`/mobs/${m.mob_id}`} className="flex items-center justify-between px-4 py-3 hover:bg-orange-50">
                <span className="font-medium">{m.mob_name}</span>
                {m.drop_rate != null && <span className="text-sm text-gray-400">{(m.drop_rate * 100).toFixed(2)}%</span>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
