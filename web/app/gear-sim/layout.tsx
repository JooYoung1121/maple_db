import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "장비 세팅 시뮬레이터",
  description: "메이플랜드 장비를 조합해 스탯 합계와 기본 데미지를 계산해 보세요. 직업·레벨별 장비 검색과 프리셋 저장을 지원합니다.",
};

export default function GearSimLayout({ children }: { children: React.ReactNode }) {
  return children;
}
