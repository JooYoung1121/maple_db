import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "아이템 시세",
  description: "외부 시세 연동 종료 및 가격 직접 입력 계산기 안내",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
