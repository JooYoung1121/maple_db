import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "혼줌 시뮬레이터 (혼돈의 주문서)",
  description:
    "혼돈의 주문서 60% 시뮬레이터 — 무릉도장 허리띠(검은색 허리띠 등) 악세서리에 혼줌을 발랐을 때의 스탯 분포·목표 달성 확률·기대 비용을 계산하고 직접 발라볼 수 있습니다.",
};

export default function ChaosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
