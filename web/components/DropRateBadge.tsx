/**
 * 드랍률 출처 배지 — 수치 옆에 출처 신뢰도를 표기한다.
 * - official:  공식 패치노트에 드랍 몹으로 명시 (확률은 미공개)
 * - community: 커뮤니티 실측 검증 (몬스터북·툴팁 스크린샷)
 * - mapledb:   메랜DB(mapledb.kr) 2024 스냅샷 동기화 값
 * - matip:     메팁 옛날 메이플 DB(matip.kr/com/db) 드롭 테이블 값 (2026-10 수집)
 * - maplekibun: 옛메 블로그 참고값 (메랜 실측 아님 — 상이할 수 있음)
 */
const SOURCE_META: Record<string, { label: string; title: string; className: string }> = {
  official: {
    label: "공식",
    title: "공식 패치노트에 드랍 몬스터로 명시됨 — 드랍 확률은 미공개",
    className: "border-sky-600/60 text-sky-700 dark:text-sky-300",
  },
  community: {
    label: "실측",
    title: "커뮤니티 실측 검증 (몬스터북·툴팁 스크린샷)",
    className: "border-emerald-600/60 text-emerald-700 dark:text-emerald-300",
  },
  mapledb: {
    label: "메랜DB",
    title: "메랜DB(mapledb.kr) 2024 스냅샷 기준 드랍률",
    className: "border-maple/60 text-amber-900 dark:text-maple",
  },
  matip: {
    label: "메팁DB",
    title: "메팁 옛날 메이플 DB(matip.kr/com/db) 드롭 테이블 기준 드랍률 — 2026-10 수집",
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

/** 표시 확률과 메팁 드롭 테이블 값이 다를 때 "메팁 x%" 를 덧붙인다 (같거나 메팁 값이 없으면 null) */
export function MatipRateHint({ rate, matipRate }: { rate: number | null | undefined; matipRate: number | null | undefined }) {
  if (matipRate == null) return null;
  if (rate != null && Math.abs(rate - matipRate) < 1e-9) return null;
  return (
    <span className="ml-1 text-[10px] text-dim" title="메팁 옛날 메이플 DB 드롭 테이블 값 — 표시값과 다릅니다">
      메팁 {(matipRate * 100).toFixed(2)}%
    </span>
  );
}
