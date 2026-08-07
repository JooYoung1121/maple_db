import type { CanonDiffEntry, CanonDiffStatus } from "@/lib/canonDiffs";

const STATUS_META: Record<CanonDiffStatus, { label: string; className: string }> = {
  changed: { label: "원작과 변경", className: "border-amber-400 text-amber-700 dark:text-amber-300" },
  added: { label: "메랜 추가", className: "border-sky-400 text-sky-700 dark:text-sky-300" },
  terminology: { label: "표기 차이", className: "border-violet-400 text-violet-700 dark:text-violet-300" },
  unverified: { label: "확인 중", className: "border-zinc-400 text-dim" },
};

export default function CanonDiffInfo({ entry, compact = false, align = "right" }: {
  entry: CanonDiffEntry;
  compact?: boolean;
  align?: "left" | "right";
}) {
  const meta = STATUS_META[entry.status];

  return (
    <details className="relative inline-block">
      <summary
        className={`list-none cursor-pointer select-none inline-flex items-center gap-1 border px-1.5 py-0.5 font-pixel text-[9px] bg-surface ${meta.className}`}
        title={`${entry.subject}: ${meta.label}`}
        aria-label={`${entry.subject} 원작 비교: ${meta.label}`}
      >
        <span aria-hidden="true">ⓘ</span>{compact ? null : meta.label}
      </summary>
      <div className={`absolute z-40 top-full mt-2 w-[min(19rem,calc(100vw-2rem))] pixel-panel p-3 text-left shadow-xl ${align === "left" ? "left-0" : "right-0"}`}>
        <div className="flex items-center justify-between gap-2 border-b border-edge pb-2">
          <b className="text-xs text-ink">{entry.subject}</b>
          <span className={`font-pixel text-[9px] ${meta.className.split(" ").slice(1).join(" ")}`}>{meta.label}</span>
        </div>
        <dl className="mt-2 space-y-2 text-[11px] leading-relaxed">
          <div>
            <dt className="font-pixel text-[9px] text-maple">메이플랜드</dt>
            <dd className="text-ink mt-0.5">{entry.mapleland}</dd>
          </div>
          <div>
            <dt className="font-pixel text-[9px] text-dim">원작</dt>
            <dd className="text-dim mt-0.5">{entry.original}</dd>
          </div>
        </dl>
        {entry.note && <p className="mt-2 pt-2 border-t border-edge text-[10px] text-dim leading-relaxed">{entry.note}</p>}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[9px] text-dim">
          <span>검증 {entry.verifiedAt}</span>
          <span className="flex flex-wrap justify-end gap-2">
            <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-maple underline">{entry.sourceLabel} ↗</a>
            {entry.originalSourceUrl && (
              <a href={entry.originalSourceUrl} target="_blank" rel="noopener noreferrer" className="text-maple underline">{entry.originalSourceLabel ?? "원작 자료"} ↗</a>
            )}
          </span>
        </div>
      </div>
    </details>
  );
}
