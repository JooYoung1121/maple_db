import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "맵 정보",
  description: "메이플랜드 사냥터 · 마을 · 던전 정보",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
