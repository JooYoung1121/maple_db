import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "아이템 시세",
  description: "아이템 이름으로 판매 중 매물·최근 거래 검색 — 장비 옵션, 보석작 여부, 가격 비교와 시세 추이",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
