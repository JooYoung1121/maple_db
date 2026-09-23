/**
 * 드랍률 출처 배지 — 수치 옆에 출처 신뢰도를 표기한다.
 * - community: 커뮤니티 실측 검증 (몬스터북·툴팁 스크린샷)
 * - mapledb:   메랜DB(mapledb.kr) 동기화 값
 * - maplekibun: 옛메 블로그 참고값 (메랜 실측 아님 — 상이할 수 있음)
 */
const SOURCE_META: Record<string, { label: string; title: string; className: string }> = {
  community: {
    label: "실측",
    title: "커뮤니티 실측 검증 (몬스터북·툴팁 스크린샷)",
    className: "border-emerald-600/60 text-emerald-700 dark:text-emerald-300",
  },
  mapledb: {
    label: "메랜DB",
    title: "메랜DB(mapledb.kr) 기준 드랍률",
    className: "border-maple/60 text-amber-900 dark:text-maple",
  },
  maplekibun: {
    label: "참고",
    title: "옛메이플 커뮤니티 정리 기반 참고값 — 메이플랜드 실측치가 아닙니다",
    className: "border-edge text-dim",
  },
};

export default function DropRateBadge({ source }: { source: string | null | undefined }) {
  if (!source) return null;
  const meta = SOURCE_META[source];
  if (!meta) return null;
  return (
    <span
      title={meta.title}
      className={`ml-1 inline-flex border px-1 py-0.5 align-middle text-[10px] leading-none ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
