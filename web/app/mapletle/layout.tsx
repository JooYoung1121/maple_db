import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "추억틀",
  description: "매일 바뀌는 메이플랜드 단어를 의미 유사도로 추리하는 꼬맨틀 스타일 게임",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
