import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "퀘스트 로드맵",
  description: "메이플랜드 2.0 퀘스트 778종 — 내 레벨에 맞는 퀘스트, 레벨 구간별 로드맵, 선행 체인·보상 정리",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
