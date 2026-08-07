import CanonDiffInfo from "@/components/CanonDiffInfo";
import type { CanonDiffEntry } from "@/lib/canonDiffs";

export default function EntityCanonDiffPanel({ entries }: { entries: CanonDiffEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="mt-4 border border-amber-400/60 bg-amber-50/70 dark:bg-amber-950/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-pixel text-[10px] text-amber-700 dark:text-amber-300">원작 비교 확인됨</span>
        {entries.map((entry) => <CanonDiffInfo key={entry.id} entry={entry} align="left" />)}
      </div>
      <p className="mt-1.5 text-[11px] text-dim leading-relaxed">
        이 페이지는 메이플랜드 현재값으로 교정했습니다. ⓘ를 누르면 원작 판본별 값과 근거를 볼 수 있습니다.
      </p>
    </div>
  );
}
