import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "리버스 시뮬레이터",
  description:
    "리버스 무기 제작 시뮬레이터 — 촉매 파괴, 레벨업 옵션, 주문서까지 리버스 무기 한 자루의 기대값·분포를 굴려보고, 메이커 보석 가공 결과도 시뮬레이션합니다.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
