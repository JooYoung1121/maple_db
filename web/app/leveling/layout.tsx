import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "직업별 사냥터",
  description: "직업 · 레벨 구간별 육성 루트",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
