import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "내 메랜",
  description: "내 캐릭터 레벨과 목표에 맞춰 메이플랜드 정보 바로가기를 정리합니다.",
};

export default function MyMapleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
