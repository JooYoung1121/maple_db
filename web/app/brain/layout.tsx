import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "메랜 브레인",
  description: "내 캐릭터를 중심으로 사냥터·퀘스트·드랍을 그래프로 탐색하는 메이플랜드 지식 지도",
};

export default function BrainLayout({ children }: { children: React.ReactNode }) {
  return children;
}
