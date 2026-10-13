import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "메이커",
  description: "전문기술 메이커 재료 · 제작 정보 · 강화 시뮬 · 재료 획득처. 리버스 기대값·보석 가공 시뮬은 리버스 시뮬레이터에서.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
