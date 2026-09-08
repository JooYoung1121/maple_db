import type { Metadata } from "next";
import Link from "next/link";
import AmorianSolver from "@/components/AmorianSolver";

export const metadata: Metadata = {
  title: "아모리안 웨딩 파퀘 조합 도우미 | 메이플랜드 DB",
  description: "아모리안 챌린지 밧줄·발판 조합과 이동 인원 안내. NPC 결과 입력, 되돌리기, 진행 자동저장.",
};

export default function AmorianSolverPage() {
  return <div className="max-w-3xl mx-auto space-y-5">
    <header className="space-y-3">
      <Link href="/pq#amorian" className="inline-flex min-h-11 items-center text-sm text-maple underline">← 아모리안 챌린지 공략</Link>
      <h1 className="font-pixel text-2xl font-bold">웨딩 파퀘 조합 도우미</h1>
      <p className="text-sm text-dim leading-relaxed">아모리안 챌린지 2·3단계용. NPC 결과를 입력하면 다음 배치와 이동할 인원을 안내합니다. 밧줄과 발판의 진행 기록은 따로 저장됩니다.</p>
      <p className="text-xs text-dim">길드원 제작 ‘아모리아 PQ Solver v4’의 풀이표·이동 안내를 바탕으로 사이트에 맞게 제작했습니다.</p>
    </header>
    <AmorianSolver />
    <p className="text-xs text-dim">게임과 자동 연동되지 않는 수동 도우미입니다. 저장 기록은 이 브라우저에만 남으며 다른 기기와 공유되지 않습니다.</p>
  </div>;
}
