import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "핑크빈 공략",
  description:
    "시간의 신전 원정대 보스 핑크빈 — 입장 경로 · 석상 6단계 · 본체 패턴 · 메이플랜드 구조상 클리어 가능성 분석",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
