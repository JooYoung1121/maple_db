import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이세계 도감",
  description: "메이플랜드에 없는 몹 · 아이템 구경",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
