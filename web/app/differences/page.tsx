import Link from "next/link";
import CanonDiffInfo from "@/components/CanonDiffInfo";
import { CANON_DIFFS, type CanonDiffStatus } from "@/lib/canonDiffs";

const STATUS: Record<CanonDiffStatus, { label: string; description: string; className: string }> = {
  changed: { label: "원작과 변경", description: "같은 콘텐츠지만 수치·조건·보상이 달라졌습니다.", className: "text-amber-700 dark:text-amber-300 border-amber-400" },
  added: { label: "메랜 추가", description: "비교 기준인 빅뱅 전 원작 초기형에는 없던 기능입니다.", className: "text-sky-700 dark:text-sky-300 border-sky-400" },
  terminology: { label: "표기 차이", description: "실제 구성은 같고 세는 법이나 명칭이 다릅니다.", className: "text-violet-700 dark:text-violet-300 border-violet-400" },
  unverified: { label: "확인 중", description: "제보는 있으나 공식 또는 복수 실측 확인이 더 필요합니다.", className: "text-dim border-zinc-400" },
};

const ENTRIES = Object.values(CANON_DIFFS).sort((a, b) => a.path.localeCompare(b.path) || a.subject.localeCompare(b.subject));

export default function DifferencesPage() {
  const verifiedCount = ENTRIES.filter((entry) => entry.status !== "unverified").length;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <header>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h1 className="font-pixel text-2xl font-bold">ⓘ 메이플랜드 × 원작 차이</h1>
          <span className="font-pixel text-[10px] px-2 py-1 border border-maple text-maple">검증 {verifiedCount}건 · 확인 중 {ENTRIES.length - verifiedCount}건</span>
        </div>
        <p className="text-sm text-dim">메이플랜드 값을 기본으로 보여주되, 빅뱅 전 원작과 달라진 항목에는 출처와 검증일을 붙입니다.</p>
      </header>

      <section className="pixel-panel p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.entries(STATUS) as [CanonDiffStatus, (typeof STATUS)[CanonDiffStatus]][]).map(([key, meta]) => (
          <div key={key}>
            <span className={`inline-block border px-2 py-1 font-pixel text-[9px] ${meta.className}`}>{meta.label}</span>
            <p className="text-[11px] text-dim mt-1.5 leading-relaxed">{meta.description}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        {ENTRIES.map((entry) => {
          const meta = STATUS[entry.status];
          return (
            <article key={entry.id} className="pixel-panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-ink">{entry.subject}</h2>
                    <span className={`border px-1.5 py-0.5 font-pixel text-[9px] ${meta.className}`}>{meta.label}</span>
                  </div>
                  <Link href={entry.path} className="inline-block text-[10px] text-maple underline mt-1">적용 페이지 {entry.path} →</Link>
                </div>
                <CanonDiffInfo entry={entry} compact />
              </div>
              <div className="grid md:grid-cols-2 gap-2 mt-3 text-xs">
                <div className="border border-maple/40 bg-maple/5 p-3"><b className="font-pixel text-[9px] text-maple">메이플랜드</b><p className="mt-1 leading-relaxed">{entry.mapleland}</p></div>
                <div className="border border-edge p-3"><b className="font-pixel text-[9px] text-dim">빅뱅 전 원작</b><p className="mt-1 text-dim leading-relaxed">{entry.original}</p></div>
              </div>
              {entry.note && <p className="text-[11px] text-dim mt-2 leading-relaxed">※ {entry.note}</p>}
            </article>
          );
        })}
      </section>

      <section className="pixel-panel p-4 text-xs leading-relaxed">
        <h2 className="font-pixel text-sm text-ink">전체 데이터로 확장하는 기준</h2>
        <p className="text-dim mt-2">아이템·몬스터·퀘스트의 모든 필드를 자동 대조할 수는 있지만, 원작 기준 버전이 KMS·GMS·v62·v92로 섞이면 잘못된 차이가 생깁니다. 따라서 항목별 기준 버전, 메이플랜드 근거, 검증일을 함께 저장하고 검증된 항목부터 ⓘ 표시를 붙입니다.</p>
        <p className="text-dim mt-2">아직 대조하지 않은 값은 ‘원작과 동일’로 추정하지 않습니다. 공식 패치·라이브 실측·원본 WZ 순으로 교차 확인해 이 목록을 계속 늘립니다.</p>
      </section>
    </div>
  );
}
