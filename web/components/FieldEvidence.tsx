export interface FieldEvidenceEntry {
  field: string;
  status: "official" | "community" | "original" | "unknown";
  note: string;
  source_url: string | null;
  checked_at: string;
}

const LABELS = {official: "공식 확인", community: "커뮤니티 근거", original: "원작 참고", unknown: "미확인"};
export default function FieldEvidence({ entries }: { entries?: FieldEvidenceEntry[] }) {
  if (!entries?.length) return null;
  return <section className="mt-4 rounded border border-edge p-3 text-xs leading-relaxed" aria-label="필드별 데이터 근거">
    <h2 className="font-semibold text-sm">수치·출현 정보의 근거</h2>
    <ul className="mt-2 space-y-3">{entries.map(e => <li key={e.field}>
      <strong>{e.field} · {LABELS[e.status]}</strong> <span className="text-dim">{e.checked_at} 확인</span>
      <p>{e.note}</p>
      {e.source_url && <a href={e.source_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-maple underline">해당 필드 근거 ↗</a>}
    </li>)}</ul>
  </section>;
}
