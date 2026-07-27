import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "아이템 획득 경로",
  description: "아이템을 드롭하는 몬스터와 그 몬스터가 출현하는 맵을 한 번에 찾습니다.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
