import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "메이커",
  description: "전문기술 메이커 재료 · 제작 정보 · 리버스 무기 제작 시뮬레이터",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
