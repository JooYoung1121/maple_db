import type { Quest } from "@/lib/types";

export default function QuestDataWarning({ quest }: { quest: Quest }) {
  if (!quest.data_warnings?.length) return null;
  return <aside className="my-3 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
    <strong>데이터 확인 상태</strong>
    {quest.data_warnings.map(w => <p className="mt-1" key={w}>{w}</p>)}
    {quest.data_sources?.map((url, i) => <a key={url} href={url} target="_blank" rel="noreferrer" className="mr-4 inline-flex min-h-11 items-center underline">공략 근거 {i + 1} ↗</a>)}
  </aside>;
}
