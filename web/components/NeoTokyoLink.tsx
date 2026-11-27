import Link from "next/link";

export default function NeoTokyoLink({ section = "", detail = false }: { section?: string; detail?: boolean }) {
  return <Link href={`/neo-tokyo${section ? `#${section}` : ""}`} className="pixel-card block my-4 p-4 hover:border-maple">
    <span className="font-pixel text-sm text-maple">네오도쿄 Part. 1 · 11/27 업데이트 →</span>
    <span className="block mt-2 text-xs leading-relaxed text-dim">{detail ? "공식 출시 정보와 원작 참고 자료를 나누어 정리했습니다. 미확인 수치·드롭·스폰은 0 또는 없음이 아닙니다." : "121레벨 입장 · 열린 지역 · 몬스터 12종 · 드롭 참고 · 퀘스트 진행 · 크리스탈 일비 제작 안내"}</span>
  </Link>;
}
