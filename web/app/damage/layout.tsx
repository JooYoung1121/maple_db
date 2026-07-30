import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "스공 계산기",
  description: "순수 스탯, 장비 옵션, 메이플 용사와 공격력 버프를 반영해 메이플랜드 상태창 공격 범위를 계산하고 비교합니다.",
};

export default function DamageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
