import Link from "next/link";
import type { CanonEntityType } from "@/lib/canonDiffs";

const COPY: Partial<Record<CanonEntityType, string>> = {
  item: "현행 공개 DB가 제공하는 착용 레벨·직업을 원작과 대조했습니다. 스탯·드롭률은 공식 또는 복수 실측이 있는 항목부터 검증합니다.",
  mob: "현행 공개 DB 749종의 레벨·HP를 원작과 대조했습니다. EXP·방어·드롭률·젠은 라이브 원문이 부족해 원작 참고값이 남아 있습니다.",
  map: "현행 공개 DB의 맵 ID·명칭까지 대조했습니다. KMS·GMS의 같은 ID가 다른 맵인 139건은 구조·젠·포탈을 숨기며, 나머지도 GMS v92 원작 참고값입니다.",
  npc: "현행 공개 DB의 NPC ID·명칭을 대조해 현재 한글명을 우선 표시합니다. 위치·대화·상점 목록은 라이브 원문이 없어 아직 원작 참고값입니다.",
  quest: "현행 공개 DB와 퀘스트 명칭을 대조했습니다. 양쪽 ID 체계가 달라 조건·보상은 공식 패치가 확인된 항목만 메이플랜드 값으로 표시합니다.",
  skill: "6/19 공식 패치의 변경 스킬을 연결했습니다. 현재 스킬 목록에는 과거 수집 데이터가 섞여 있어 수치표 자체는 검증 중입니다.",
};

export default function DatasetComparisonNotice({ type, className = "" }: { type: CanonEntityType; className?: string }) {
  const copy = COPY[type];
  if (!copy) return null;
  return (
    <div className={`border border-emerald-400/50 bg-emerald-50/60 dark:bg-emerald-950/20 px-3 py-2 text-[11px] leading-relaxed text-dim ${className}`}>
      <span className="font-pixel text-[9px] text-emerald-700 dark:text-emerald-300 mr-2">전수 대조 범위</span>
      {copy} <Link href="/differences" className="text-maple underline">대조 현황 보기 →</Link>
    </div>
  );
}
