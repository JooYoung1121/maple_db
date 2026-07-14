import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "퀘스트",
  description: "메이플랜드 퀘스트 조건 · 보상 검색",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
