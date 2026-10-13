import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "주문서 계산기",
  description: "주문서 성공 확률·기대값 계산과 장비별 주문서 스탯 참고표. 직접 발라보는 시뮬레이션은 주문서 시뮬레이터에서.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
