import Link from "next/link";
import CanonDiffInfo from "@/components/CanonDiffInfo";
import { CANON_DIFFS, type CanonDiffStatus } from "@/lib/canonDiffs";
import { DATASET_COMPARISON_COVERAGE, ENTITY_CANON_DIFFS } from "@/lib/entityCanonDiffs";

const STATUS: Record<CanonDiffStatus, { label: string; description: string; className: string }> = {
  changed: { label: "원작과 변경", description: "같은 콘텐츠지만 수치·조건·보상이 달라졌습니다.", className: "text-amber-700 dark:text-amber-300 border-amber-400" },
  added: { label: "메랜 추가", description: "비교 기준인 빅뱅 전 원작 초기형에는 없던 기능입니다.", className: "text-sky-700 dark:text-sky-300 border-sky-400" },
  version: { label: "원작 판본 차이", description: "메랜 변경이 아니라 초기·후기 빅뱅 전 원작값이 서로 다릅니다.", className: "text-emerald-700 dark:text-emerald-300 border-emerald-400" },
  terminology: { label: "표기 차이", description: "실제 구성은 같고 세는 법이나 명칭이 다릅니다.", className: "text-violet-700 dark:text-violet-300 border-violet-400" },
  unverified: { label: "확인 중", description: "제보는 있으나 공식 또는 복수 실측 확인이 더 필요합니다.", className: "text-dim border-zinc-400" },
};

const ENTRIES = [...Object.values(CANON_DIFFS), ...ENTITY_CANON_DIFFS]
  .sort((a, b) => a.path.localeCompare(b.path) || a.subject.localeCompare(b.subject));
const DATA_ENTRIES = ENTRIES.filter((entry) => entry.entityType !== "skill");
const SKILL_ENTRIES = ENTRIES.filter((entry) => entry.entityType === "skill");

function DiffCard({ entry }: { entry: (typeof ENTRIES)[number] }) {
  const meta = STATUS[entry.status];
  return (
    <article className="pixel-panel p-4">
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
}

export default function DifferencesPage() {
  const verifiedCount = ENTRIES.filter((entry) => entry.status !== "unverified").length;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <header>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h1 className="font-pixel text-2xl font-bold">ⓘ 메이플랜드 × 원작 차이</h1>
          <span className="font-pixel text-[10px] px-2 py-1 border border-maple text-maple">검증 {verifiedCount}건 · 확인 중 {ENTRIES.length - verifiedCount}건</span>
        </div>
        <p className="text-sm text-dim">메이플랜드 값을 기본으로 보여주되, 빅뱅 전 원작과 달라진 항목에는 판본·출처·검증일을 붙입니다.</p>
      </header>

      <section className="pixel-panel p-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {(Object.entries(STATUS) as [CanonDiffStatus, (typeof STATUS)[CanonDiffStatus]][]).map(([key, meta]) => (
          <div key={key}>
            <span className={`inline-block border px-2 py-1 font-pixel text-[9px] ${meta.className}`}>{meta.label}</span>
            <p className="text-[11px] text-dim mt-1.5 leading-relaxed">{meta.description}</p>
          </div>
        ))}
      </section>

      <section className="pixel-panel overflow-x-auto">
        <div className="p-4 border-b border-edge">
          <h2 className="font-pixel text-sm text-ink">전체 사이트 자동 대조 현황</h2>
          <p className="text-[11px] text-dim mt-1">현행 공개 메이플랜드 DB의 모든 레코드를 사이트 원작 데이터와 비교했습니다. 자료가 제공하지 않는 필드는 완료로 세지 않습니다.</p>
        </div>
        <table className="w-full min-w-[720px] text-xs">
          <thead className="bg-surface2 text-dim"><tr><th className="text-left p-3">종류</th><th className="text-right p-3">사이트</th><th className="text-right p-3">현행 공개</th><th className="text-left p-3">대조 필드</th><th className="text-left p-3">결과</th></tr></thead>
          <tbody className="divide-y divide-edge/50">
            {DATASET_COMPARISON_COVERAGE.map((row) => (
              <tr key={row.type}><td className="p-3 font-bold">{row.type}</td><td className="p-3 text-right">{row.site.toLocaleString()}</td><td className="p-3 text-right">{row.live.toLocaleString()}</td><td className="p-3 text-dim">{row.fields}</td><td className="p-3">{row.result}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <h2 className="font-pixel text-lg">데이터·콘텐츠 차이 {DATA_ENTRIES.length}건</h2>
        {DATA_ENTRIES.map((entry) => <DiffCard key={entry.id} entry={entry} />)}
      </section>

      <details className="pixel-panel">
        <summary className="cursor-pointer p-4 font-pixel text-sm">공식 2.0 스킬 변경 {SKILL_ENTRIES.length}건 펼치기</summary>
        <div className="p-4 pt-0 space-y-3">
          <p className="text-[11px] text-dim">공식 6/19 패치 현재값을 스킬명에 연결했습니다. 원작과 다르다고 공식이 직접 밝힌 항목과, 원작 판본 교체에 따른 재조정을 구분합니다.</p>
          {SKILL_ENTRIES.map((entry) => <DiffCard key={entry.id} entry={entry} />)}
        </div>
      </details>

      <section className="pixel-panel p-4 text-xs leading-relaxed">
        <h2 className="font-pixel text-sm text-ink">판정 원칙</h2>
        <p className="text-dim mt-2">공식 패치 → 메이플랜드 현행 공개 DB → 복수 커뮤니티 실측 → v62·v83·GMS92 원본 순으로 교차 확인합니다. 서로 다른 원작판이 다르면 ‘메이플랜드 변경’으로 오인하지 않고 ‘원작 판본 차이’로 표시합니다.</p>
        <p className="text-dim mt-2">아직 대조하지 못한 필드는 ‘원작과 동일’로 추정하지 않습니다. 내부 테스트 몬스터와 비정상 센티널 값도 실제 게임 데이터에서 제외합니다.</p>
      </section>
    </div>
  );
}
