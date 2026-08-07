import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "무릉도장 공략",
  description: "메이플랜드 무릉도장 38층 보스·누적 점수·솔플 효율 계산기·파티 조합·허리띠와 한정 훈장 보상 정리",
};

export default function DojoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
