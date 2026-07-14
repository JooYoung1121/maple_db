import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "드롭 검색",
  description: "아이템 드롭처 역검색",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
