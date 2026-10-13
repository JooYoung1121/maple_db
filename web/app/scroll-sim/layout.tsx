import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "주문서 시뮬레이터",
  description:
    "주문서 강화(작) 시뮬레이터 — 장비를 고르고 10·30·60·70·100% 주문서를 한 장씩 발라보는 연출 무대. 몇 트에 몇 작이 나왔는지 기록이 쌓이고, 결과를 랭킹에 등록할 수 있습니다.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
