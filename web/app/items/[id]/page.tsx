"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getItem } from "@/lib/api";
import type { Item } from "@/lib/types";
import StatGrid from "@/components/StatGrid";
import PriceChart from "@/components/PriceChart";
import { toCategoryKr, toSubcategoryKr } from "@/lib/translations";

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

  // Separate requirement stats from equipment stats
  const reqStats: Record<string, number> = {};
  const equipStats: Record<string, number> = {};
  if (stats) {
    for (const [k, v] of Object.entries(stats)) {
      const numVal = Number(v);
      if (isNaN(numVal) || numVal === 0) continue;
      if (k.startsWith("req")) {
        reqStats[k] = numVal;
      } else {
        equipStats[k] = numVal;
      }
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/items" className="text-sm text-orange-500 hover:underline">&larr; 아이템 목록</Link>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mt-3">
        <div className="flex items-start gap-4">
          {item.icon_url && <img src={item.icon_url} alt={item.name} className="w-16 h-16 object-contain" />}
          <div>
            <h1 className="text-2xl font-bold">
              {(() => {
                const kr = item.names_en?.find(n => n.source === "kms");
                return kr ? (
                  <>{kr.name_en} <span className="text-lg font-normal text-gray-500 dark:text-gray-400">({item.name})</span></>
                ) : item.name;
              })()}
            </h1>
            <div className="flex gap-2 mt-1 flex-wrap">
              {item.category && <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">{toCategoryKr(item.category)}</span>}
              {item.subcategory && <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">{toSubcategoryKr(item.subcategory)}</span>}
            </div>
          </div>
        </div>

        {/* 요구 사항 */}
        <div className="mt-6">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">요구 사항</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">레벨</span>
              <p className="font-medium text-gray-800 dark:text-gray-200">{item.level_req || "-"}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">직업</span>
              <p className="font-medium text-gray-800 dark:text-gray-200">{item.job_req || "공용"}</p>
            </div>
            {Object.keys(reqStats).length > 0 && Object.entries(reqStats).map(([k, v]) => {
              const labels: Record<string, string> = { reqSTR: "힘(STR)", reqDEX: "민첩(DEX)", reqINT: "지능(INT)", reqLUK: "행운(LUK)" };
              return (
                <div key={k} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{labels[k] || k}</span>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{v}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 장비 정보 */}
        {(item.attack_speed || item.upgrade_slots || item.price) && (
          <div className="mt-6">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">장비 정보</span>
            <div className="grid grid-cols-3 gap-4 mt-2">
              {item.attack_speed && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">공격속도</span>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{item.attack_speed}</p>
                </div>
              )}
              {item.upgrade_slots != null && item.upgrade_slots > 0 && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">업그레이드 슬롯</span>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{item.upgrade_slots}</p>
                </div>
              )}
              {item.price != null && item.price > 0 && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">가격</span>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{item.price.toLocaleString()} 메소</p>
                </div>
              )}
            </div>
          </div>
        )}

        {item.description && (
          <div className="mt-6">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">설명</span>
            <p className="mt-1 text-gray-600 dark:text-gray-400">{item.description}</p>
          </div>
        )}

        {/* 장비 스탯 — StatGrid 컴포넌트 */}
        {Object.keys(equipStats).length > 0 && (
          <StatGrid stats={equipStats} title="장비 스탯" />
        )}
      </div>

      <PriceChart itemId={item.id} />

      {droppedBy.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3">드롭 몬스터</h2>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100">
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
