import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "훈장 가이드",
  description: "메이플랜드 훈장 획득 조건과 스탯 — 탐험가 트리 · 기부왕 · 레벨 훈장",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
