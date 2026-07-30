import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "공대 분배 계산기",
  description: "보스 드랍 아이템 판매금과 수수료를 반영해 파티원별 분배금을 계산합니다.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
