import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "파티퀘스트 가이드",
  description: "PQ 공략 및 보상",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
