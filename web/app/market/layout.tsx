import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "아이템 시세",
  description: "거래소 매물 집계 기반 아이템 시세 조회 — 일/주/월봉 추이",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
