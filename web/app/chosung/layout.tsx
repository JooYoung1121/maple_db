import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "초성퀴즈 검색기",
  description: "초성으로 메이플랜드 몬스터·아이템·맵·NPC 이름을 검색하세요. 인게임 초성퀴즈 대비용.",
};

export default function ChosungLayout({ children }: { children: React.ReactNode }) {
  return children;
}
