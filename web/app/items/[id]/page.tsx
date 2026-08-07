"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getItem } from "@/lib/api";
import type { Item } from "@/lib/types";
import StatGrid from "@/components/StatGrid";
import PriceChart from "@/components/PriceChart";
import { toCategoryKr, toSubcategoryKr } from "@/lib/translations";
import EntityCanonDiffPanel from "@/components/EntityCanonDiffPanel";
import DatasetComparisonNotice from "@/components/DatasetComparisonNotice";
import { getEntityCanonDiffs } from "@/lib/entityCanonDiffs";

interface DroppedByMob {
  mob_id: number;
  mob_name: string;
  mob_name_kr?: string | null;
  drop_rate: number | null;
}

export default function ItemDetailPage() {
  const { id } = useParams();
  const [item, setItem] = useState<Item | null>(null);
  const [droppedBy, setDroppedBy] = useState<DroppedByMob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getItem(Number(id))
      .then((d) => { setItem(d.item); setDroppedBy(d.dropped_by || []); })
      .catch(() => setItem(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-12 text-dim">로딩 중...</div>;
  if (!item) return <div className="text-center py-12 text-dim">아이템을 찾을 수 없습니다</div>;

  const stats = item.stats ? JSON.parse(item.stats) : null;
  const canonDiffs = getEntityCanonDiffs("item", item.id, item.name);

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
      <Link href="/items" className="text-sm text-maple hover:underline">&larr; 아이템 목록</Link>
      <div className="pixel-panel p-6 mt-3">
        <div className="flex items-start gap-4">
          {item.icon_url && <img src={item.icon_url} alt={item.name} className="w-16 h-16 object-contain" />}
          <div>
            <h1 className="text-2xl font-bold">
              {(() => {
                const kr = item.names_en?.find(n => n.source === "mapleland-current") || item.names_en?.find(n => n.source === "kms");
                return kr ? (
                  <>{kr.name_en} <span className="text-lg font-normal text-dim">({item.name})</span></>
                ) : item.name;
              })()}
            </h1>
            <div className="flex gap-2 mt-1 flex-wrap">
              {item.category && <span className="pixel-badge text-xs">{toCategoryKr(item.category)}</span>}
              {item.subcategory && <span className="pixel-badge text-xs">{toSubcategoryKr(item.subcategory)}</span>}
            </div>
          </div>
        </div>

        <EntityCanonDiffPanel entries={canonDiffs} />
        <DatasetComparisonNotice type="item" className="mt-3" />

        {/* 요구 사항 */}
        <div className="mt-6">
          <span className="font-pixel text-sm font-semibold text-ink">요구 사항</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
            <div className="bg-surface2 border-2 border-edge p-3">
              <span className="text-xs text-dim">레벨</span>
              <p className="font-medium text-ink">{item.level_req || "-"}</p>
            </div>
            <div className="bg-surface2 border-2 border-edge p-3">
              <span className="text-xs text-dim">직업</span>
              <p className="font-medium text-ink">{item.job_req || "공용"}</p>
            </div>
            {Object.keys(reqStats).length > 0 && Object.entries(reqStats).map(([k, v]) => {
              const labels: Record<string, string> = { reqSTR: "힘(STR)", reqDEX: "민첩(DEX)", reqINT: "지능(INT)", reqLUK: "행운(LUK)" };
              return (
                <div key={k} className="bg-surface2 border-2 border-edge p-3">
                  <span className="text-xs text-dim">{labels[k] || k}</span>
                  <p className="font-medium text-ink">{v}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 장비 정보 */}
        {(item.attack_speed || item.upgrade_slots || item.price) && (
          <div className="mt-6">
            <span className="font-pixel text-sm font-semibold text-ink">장비 정보</span>
            <div className="grid grid-cols-3 gap-4 mt-2">
              {item.attack_speed && (
                <div className="bg-surface2 border-2 border-edge p-3">
                  <span className="text-xs text-dim">공격속도</span>
                  <p className="font-medium text-ink">{item.attack_speed}</p>
                </div>
              )}
              {item.upgrade_slots != null && item.upgrade_slots > 0 && (
                <div className="bg-surface2 border-2 border-edge p-3">
                  <span className="text-xs text-dim">업그레이드 슬롯</span>
                  <p className="font-medium text-ink">{item.upgrade_slots}</p>
                </div>
              )}
              {item.price != null && item.price > 0 && (
                <div className="bg-surface2 border-2 border-edge p-3">
                  <span className="text-xs text-dim">가격</span>
                  <p className="font-medium text-ink">{item.price.toLocaleString()} 메소</p>
                </div>
              )}
            </div>
          </div>
        )}

        {item.description && (
          <div className="mt-6">
            <span className="font-pixel text-sm font-semibold text-ink">설명</span>
            <p className="mt-1 text-dim">{item.description}</p>
          </div>
        )}

        {/* 장비 스탯 — StatGrid 컴포넌트 */}
        {Object.keys(equipStats).length > 0 && (
          <StatGrid stats={equipStats} title="장비 스탯" />
        )}
      </div>

      <div className="mt-6">
        <h2 className="font-pixel text-lg font-semibold mb-1 text-ink">드롭 몬스터</h2>
        {droppedBy.length > 0 &&
          ((item.names_en?.find((n) => n.source === "kms")?.name_en || item.name || "").endsWith("카드") ||
            (item.name || "").endsWith("Card")) && (
            <p className="text-[11px] text-dim mb-2">※ 몬스터 카드 드롭률은 7/31 패치로 메랜에서 전면 재조정 — 표기 수치(원작 기준)와 다를 수 있습니다</p>
          )}
        {droppedBy.length > 0 ? (
          <div className="pixel-panel divide-y divide-edge/40">
            {droppedBy.map((m) => (
              <Link
                key={m.mob_id}
                href={`/mobs/${m.mob_id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]"
              >
                <span className="font-medium">{m.mob_name_kr || m.mob_name}</span>
                {m.drop_rate != null && <span className="text-sm text-dim">{(m.drop_rate * 100).toFixed(2)}%</span>}
              </Link>
            ))}
          </div>
        ) : (
          <div className="border-2 border-dashed border-edge bg-surface2 px-4 py-5 text-sm text-dim">
            현재 DB에 연결된 드롭 몬스터 정보가 없습니다.
          </div>
        )}
      </div>

      {/* 시세 차트 — 메랜지지 데이터(메팁 집계) */}
      <PriceChart itemId={item.id} />
    </div>
  );
}
