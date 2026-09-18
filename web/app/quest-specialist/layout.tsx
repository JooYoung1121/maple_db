import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "퀘스트 스페셜리스트",
  description:
    "퀘스트 800개 완료 훈장 가이드 — 레벨 제한 퀘스트 · 전달형 즉시 완료 목록 · 연계 퀘스트 준비물 총량 · 몹 시너지 동선",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
