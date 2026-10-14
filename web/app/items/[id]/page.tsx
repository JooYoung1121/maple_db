"use client";

/* 아이템 상세 — 인게임 툴팁(ItemTooltip)을 중심으로 재구성 (v4.16.0 · v4.17.0 다중 출처).
 * 수치는 상세 API 가 메팁 · 로그지지 · mapledb 2024 스냅샷 · 운영자 인게임 확인을 우선순위로 병합한 값(item.mapleland)을 쓰고,
 * 출처끼리 다른 옵션과 원작(GMS v92, items.stats)과 다른 옵션은 툴팁 아래 박스에 적는다. */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getItem } from "@/lib/api";
import type { Item } from "@/lib/types";
import EquipmentNotes from "@/components/EquipmentNotes";
import PriceChart from "@/components/PriceChart";
import ItemTooltip, { MaplelandDiffBox } from "@/components/ItemTooltip";
import { toCategoryKr, toSubcategoryKr } from "@/lib/translations";
import EntityCanonDiffPanel from "@/components/EntityCanonDiffPanel";
import DatasetComparisonNotice from "@/components/DatasetComparisonNotice";
import { getEntityCanonDiffs } from "@/lib/entityCanonDiffs";
import DropRateBadge from "@/components/DropRateBadge";

interface DroppedByMob {
  mob_id: number;
  mob_name: string;
  mob_name_kr?: string | null;
  drop_rate: number | null;
  drop_rate_source?: string | null;
}

export default function ItemDetailPage() {
  const { id } = useParams();
  const [item, setItem] = useState<Item | null>(null);
  const [droppedBy, setDroppedBy] = useState<DroppedByMob[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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

  const canonDiffs = getEntityCanonDiffs("item", item.id, item.name);
  const kr = item.mapleland?.name_kr
    || item.names_en?.find((n) => n.source === "mapleland-current")?.name_en
    || item.names_en?.find((n) => n.source === "kms")?.name_en
    || null;
  const description = item.mapleland?.description || item.description;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* 클립보드 불가 */ }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/items" className="pixel-card px-3 py-1.5 font-pixel text-xs text-dim hover:text-maple">← 아이템 목록</Link>
        <h1 className="font-pixel text-lg text-ink flex-1 min-w-0 truncate">{kr ?? item.name}</h1>
        <div className="flex gap-1.5 flex-wrap">
          {item.category && <span className="pixel-badge text-xs">{toCategoryKr(item.category)}</span>}
          {item.subcategory && <span className="pixel-badge text-xs">{toSubcategoryKr(item.subcategory)}</span>}
        </div>
        <button type="button" onClick={copyLink} className="pixel-card px-3 py-1.5 font-pixel text-xs text-dim hover:text-maple">
          {copied ? "복사됨 ✓" : "🔗 링크 복사"}
        </button>
      </div>

      <div className="pixel-panel p-5 mt-3">
        {/* 인게임 툴팁 */}
        <ItemTooltip item={item} nameKr={kr} mapleland={item.mapleland} />
        <MaplelandDiffBox mapleland={item.mapleland} />

        <EntityCanonDiffPanel entries={canonDiffs} />
        <DatasetComparisonNotice type="item" className="mt-3" />

        {description && (
          <div className="mt-5">
            <span className="font-pixel text-sm font-semibold text-ink">설명</span>
            <p className="mt-1 text-sm text-dim leading-relaxed">{description}</p>
          </div>
        )}
        {item.catalog_notes && <EquipmentNotes notes={item.catalog_notes} />}
      </div>

      <div className="mt-6">
        <h2 className="font-pixel text-lg font-semibold mb-1 text-ink">드롭 몬스터</h2>
        {droppedBy.length > 0 &&
          ((kr || "").endsWith("카드") || (item.name || "").endsWith("Card")) && (
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
                {(m.drop_rate != null || m.drop_rate_source) && (
                  <span className="text-sm text-dim">
                    {m.drop_rate != null && `${(m.drop_rate * 100).toFixed(2)}%`}
                    <DropRateBadge source={m.drop_rate_source} />
                  </span>
                )}
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
