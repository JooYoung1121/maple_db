import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "코디 시뮬레이터",
  description: "헤어·성형·장비를 캐릭터에 입혀보는 메이플랜드 코디 시뮬레이터 — 프리셋 저장·비교·공유",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
