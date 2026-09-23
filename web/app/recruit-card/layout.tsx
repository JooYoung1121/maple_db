import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "구인구직 카드 메이커",
  description:
    "스탯창·캐릭터 캡쳐와 몇 가지 정보만 넣으면 공대 구인·구직 홍보 카드를 만들어 드립니다 — 이미지는 브라우저에서만 처리",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
