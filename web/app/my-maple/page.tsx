import { redirect } from "next/navigation";

// 내 메랜은 마이페이지(/me)로 통합 — 기존 링크·즐겨찾기 호환용 리다이렉트
export default function MyMapleRedirect() {
  redirect("/me");
}
