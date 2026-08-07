import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "메이플랜드 원작 차이",
  description: "메이플랜드와 빅뱅 전 메이플스토리의 검증된 수치·보상·표기 차이와 출처를 한곳에서 확인합니다.",
};

export default function DifferencesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
