import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "체경비 사냥터",
  description: "체력 대비 경험치(체경비)로 찾는 꿀 사냥터 — 맵별 몹 마릿수·분포 기반 추천",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
