import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "아이템 도감",
  description: "메이플랜드 아이템 정보 · 스탯 · 드롭처 검색",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
