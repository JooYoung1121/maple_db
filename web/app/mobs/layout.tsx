import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "몬스터 도감",
  description: "메이플랜드 몬스터 정보 · 드롭 · 출현맵",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
