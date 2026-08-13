import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "결혼 시스템 가이드 | 추억길드 메랜정보",
  description: "메이플랜드 결혼(아모리아) — 준비물 · 절차 · 채플 vs 대성당 · 하객 보상(오닉스 애플)까지 사전 정리",
};

export default function WeddingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
