import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "아이템 시세",
  description: "아이템 이름으로 메팁 집계 시세와 일·주·월 추이 검색",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
