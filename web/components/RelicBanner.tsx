import type { ReactNode } from "react";

/** 유물창고 배너 — 2.0 전환으로 역할을 다한 페이지 상단에 표시 */
export default function RelicBanner({ reason, alternative }: { reason: string; alternative?: ReactNode }) {
  return (
    <div className="pixel-panel p-4 mb-6 border-maple/60">
      <p className="font-pixel text-sm text-maple mb-1">🏺 유물창고</p>
      <p className="text-sm text-dim leading-relaxed">
        이 페이지는 메이플랜드 1.0 시절의 유물입니다. {reason}
      </p>
      {alternative && <p className="text-sm text-dim mt-1 leading-relaxed">{alternative}</p>}
    </div>
  );
}
