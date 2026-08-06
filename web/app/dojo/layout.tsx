import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "무릉도장 공략",
  description: "메이플랜드 무릉도장 32라운드 보스·준비물·진행 팁·띠와 수행자 훈장 보상 정리",
};

export default function DojoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
