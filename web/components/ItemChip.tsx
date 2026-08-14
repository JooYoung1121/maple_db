import Link from "next/link";

/**
 * 아이템 아이콘 칩 — 가이드 페이지 어디서나 실제 인게임 아이콘 + 상세 링크로 표시.
 * 아이콘은 maplestory.io GMS v92 핫링크 (items.icon_url과 동일 패턴, 무료 공개 API).
 */
export function itemIcon(id: number): string {
  return `https://maplestory.io/api/gms/92/item/${id}/icon`;
}

export default function ItemChip({
  id,
  name,
  qty,
  sub,
  size = "md",
  link = true,
}: {
  id: number;
  name: string;
  /** 수량 표시 (예: ×40) */
  qty?: number | string;
  /** 이름 아래/옆 보조 텍스트 (스탯 등) */
  sub?: string;
  size?: "sm" | "md";
  link?: boolean;
}) {
  const iconCls = size === "sm" ? "w-5 h-5" : "w-7 h-7";
  const body = (
    <span className={`inline-flex items-center gap-1.5 align-middle ${link ? "group" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={itemIcon(id)} alt="" className={`${iconCls} object-contain shrink-0`} loading="lazy" />
      <span className={`${size === "sm" ? "text-xs" : "text-sm"} text-ink ${link ? "group-hover:text-maple" : ""}`}>
        {name}
        {qty !== undefined && <span className="text-dim"> ×{qty}</span>}
      </span>
      {sub && <span className="text-[10px] text-dim">{sub}</span>}
    </span>
  );
  if (!link) return body;
  return (
    <Link href={`/items/${id}`} title={`${name} 상세 — 드랍 몬스터 · 시세`}>
      {body}
    </Link>
  );
}
