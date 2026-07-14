import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "퀘스트 (베타)",
  description: "메이플랜드 퀘스트 검색 베타",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
