import type { EquipmentCatalogNotes } from "@/lib/types";

export default function EquipmentNotes({ notes, compact = false }: { notes: EquipmentCatalogNotes; compact?: boolean }) {
  return <section className={compact ? "mb-3 rounded-lg bg-surface2 p-3" : "mt-6 rounded-xl border border-edge bg-surface2 p-4"} aria-label="획득 방법과 옵션 근거">
    <h2 className="text-sm font-bold text-ink">획득 방법</h2>
    <p className="mt-2 text-sm leading-relaxed text-ink">{notes.acquisition}</p>
    {!compact && notes.steps && <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink">{notes.steps.map(step => <li key={step}>{step}</li>)}</ol>}
    <p className="mt-3 text-xs leading-relaxed text-dim">{notes.note}</p>
    {notes.variation_status === "unverified" && <p className="mt-2 text-xs font-semibold text-maple">기본값 등록 · 획득 시 옵션 편차 미확인</p>}
    {notes.variation_status === "verified" && notes.stat_ranges && <dl className="mt-2 flex flex-wrap gap-3 text-sm">{Object.entries(notes.stat_ranges).map(([key, value]) => <div key={key}><dt className="inline">{key} </dt><dd className="inline">{value.min} ~ {value.max}</dd></div>)}</dl>}
    {!compact && <div className="mt-3 flex flex-wrap gap-3 text-xs">{notes.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="text-maple underline">{source.label} ↗</a>)}</div>}
  </section>;
}
