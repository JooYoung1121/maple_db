export default function BattleMageKnownIssue() {
  return <aside className="rounded border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-900 dark:text-amber-200">
    <strong>공식 수정 배포 안내 · 2026-09-08</strong>
    <p className="mt-1">배틀메이지의 메이커·용사의 의지 퀘스트 진행 불가는 9/8 16:30 무중단 배포의 수정 대상입니다.</p>
    <details><summary className="cursor-pointer min-h-11 py-3">채널 적용 시각 · 스킬 수정 · 공식 근거</summary>
    <p>이전 채널 종료는 19:00 예정으로 안내되었습니다(한국 시간). 채널별 적용 시점이 다르므로 진행이 막히면 최신 공지와 재접속 안내를 확인하세요.</p>
    <p className="mt-2">같은 배포에서 블러드 드레인의 회복 상한 기준을 기본 최대 HP의 10%로 수정하고, 몬스터의 버프 해제로 슈퍼바디·오라가 해제되는 문제를 수정한다고 안내했습니다.</p>
    <a className="mt-2 mr-4 inline-flex min-h-11 items-center underline" href="https://maple.land/board/notices/fb512pkiipw63su7gi4d73gg" target="_blank" rel="noreferrer">9/8 수정 배포 원문 ↗</a>
    <a className="inline-flex min-h-11 items-center underline" href="https://maple.land/board/notices/qi6hi2lecoo64tr0v0q8guos" target="_blank" rel="noreferrer">알려진 이슈 최신 상태 ↗</a>
    </details>
  </aside>;
}
