import type { Metadata } from "next";
import Link from "next/link";
import {
  BATTLE_MAGE_LEVELING,
  BATTLE_MAGE_SKILLS,
  BATTLE_MAGE_SOURCES,
  LEGACY_EDELSTEIN_QUESTS,
  LIVE_QUEST_SCREENSHOT_NAMES,
  MASTERY_BOOK_EVIDENCE,
  REQUIRED_MASTERY_BOOKS,
  type EvidenceLevel,
} from "@/data/battleMage";

export const metadata: Metadata = {
  title: "배틀메이지 종합 가이드",
  description: "메이플랜드 배틀메이지 스킬, 마스터리북 드롭, 에델슈타인 퀘스트와 육성 루트",
};

const EVIDENCE: Record<EvidenceLevel, { label: string; className: string }> = {
  official: { label: "메랜 공식", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" },
  verified: { label: "인게임 확인", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" },
  original: { label: "원작 공식", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300" },
  candidate: { label: "과거 자료·검증 대기", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" },
};

function EvidenceBadge({ level }: { level: EvidenceLevel }) {
  const item = EVIDENCE[level];
  return <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold ${item.className}`}>{item.label}</span>;
}

export default function BattleMageGuidePage() {
  const branches = ["시티즌", "1차", "2차", "3차", "4차"] as const;
  const resistanceQuests = LEGACY_EDELSTEIN_QUESTS.filter((q) => q.group === "레지스탕스");
  const edelsteinQuests = LEGACY_EDELSTEIN_QUESTS.filter((q) => q.group === "에델슈타인");

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <EvidenceBadge level="official" />
          <span className="text-xs text-dim">2026-09-07 업데이트 대비</span>
        </div>
        <h1 className="font-pixel text-2xl font-bold text-ink">배틀메이지 종합 가이드</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-dim">
          메이플랜드 공식 공지, KMS 1.2.105 원문, 빅뱅 이전 KMST 스킬 덤프와 9/4 클라이언트에서 확인된
          커뮤니티 자료를 판본별로 분리했습니다. 출시 전 수치와 드롭 후보는 확정 정보와 섞지 않습니다.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["33", "공식 스킬"],
          ["117", "원작 공지 퀘스트"],
          ["29", "지역·훈련 몬스터"],
          ["2", "인게임 확인 마북 드롭"],
        ].map(([value, label]) => (
          <div key={label} className="pixel-panel p-4 text-center">
            <div className="font-pixel text-2xl font-bold text-maple">{value}</div>
            <div className="mt-1 text-xs text-dim">{label}</div>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/30">
        <h2 className="font-pixel text-sm font-bold text-amber-800 dark:text-amber-200">판본을 이렇게 읽어주세요</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
          <li>• 메이플랜드 공지는 배틀메이지 능력치를 “빅뱅 이전 KMST 공개 데이터” 기준으로 설정했다고 명시합니다.</li>
          <li>• 링크된 KMS 1.2.105 공지는 2010-07-22 빅뱅 2차 본서버 공지이므로, 최종 스킬 목록·퀘스트 이름 확인용입니다.</li>
          <li>• 세부 스킬 수치는 1.2.105 이전 KMST 시험판 자료입니다. 마스터 레벨이 바뀐 스킬은 시험판 수치를 참고값으로만 표시합니다.</li>
          <li>• 에델슈타인 몬스터 HP·EXP는 GMS v95 원본값이며, 메이플랜드가 별도 조정했을 가능성은 출시 후 실측으로 갱신합니다.</li>
        </ul>
      </section>

      <nav className="flex flex-wrap gap-2">
        <Link href="/job" className="pixel-btn px-3 py-2 text-xs">전직 경로</Link>
        <Link href="/skills?job_class=배틀메이지" className="pixel-btn px-3 py-2 text-xs">스킬 DB</Link>
        <Link href="/quests?area=에델슈타인" className="pixel-btn px-3 py-2 text-xs">퀘스트 DB</Link>
        <Link href="/leveling?job=배틀메이지" className="pixel-btn px-3 py-2 text-xs">직업별 사냥터</Link>
      </nav>

      <section>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="font-pixel text-xl font-bold text-ink">스킬 구성</h2>
          <EvidenceBadge level="original" />
        </div>
        <div className="space-y-4">
          {branches.map((branch) => (
            <details key={branch} className="pixel-panel overflow-hidden" open={branch === "1차"}>
              <summary className="cursor-pointer bg-surface2 px-4 py-3 font-pixel text-sm font-bold text-ink">
                {branch} · {BATTLE_MAGE_SKILLS.filter((s) => s.branch === branch).length}개
              </summary>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="border-b border-edge text-left text-xs text-dim">
                    <tr><th className="px-4 py-2">스킬</th><th className="px-4 py-2">마스터</th><th className="px-4 py-2">핵심 효과</th><th className="px-4 py-2">육성 메모</th></tr>
                  </thead>
                  <tbody>
                    {BATTLE_MAGE_SKILLS.filter((s) => s.branch === branch).map((skill) => (
                      <tr key={skill.name} className="border-b border-edge/40 last:border-0">
                        <td className="px-4 py-3 font-semibold text-ink"><Link className="hover:text-maple" href={`/skills?q=${encodeURIComponent(skill.name)}`}>{skill.name}</Link></td>
                        <td className="px-4 py-3 text-maple">Lv.{skill.masterLevel}</td>
                        <td className="px-4 py-3 leading-relaxed text-dim">{skill.summary}</td>
                        <td className="px-4 py-3 text-xs text-amber-700 dark:text-amber-300">{skill.priority || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="font-pixel text-xl font-bold text-ink">마스터리북·드롭</h2>
          <span className="text-xs text-dim">확정과 후보를 분리 표시</span>
        </div>
        <div className="mb-4 rounded-lg border border-edge bg-surface2 p-4">
          <p className="text-xs font-semibold text-ink">4차 마스터 레벨 기준 필요 마북 8계열</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {REQUIRED_MASTERY_BOOKS.map((book) => (
              <span key={book} className="rounded bg-surface px-2 py-1 text-xs text-dim">{book}</span>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-dim">피니쉬 블로우·오라·싸이클론·다크 제네시스·스탠스·쉘터·메이플 용사 기준. 드롭 확정 여부는 아래 증거 배지를 기준으로 보세요.</p>
        </div>
        <div className="grid gap-3">
          {MASTERY_BOOK_EVIDENCE.map((book) => (
            <article key={`${book.name}-${book.tier}`} className="pixel-panel p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-ink">{book.name} {book.tier}</h3>
                <EvidenceBadge level={book.evidence} />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {book.drops.map((drop) => drop.mobId ? (
                  <Link key={`${drop.name}-${drop.mobId}`} href={`/mobs/${drop.mobId}`} className="rounded bg-surface2 px-2 py-1 text-xs text-maple hover:underline">{drop.name}</Link>
                ) : (
                  <span key={drop.name} className="rounded bg-surface2 px-2 py-1 text-xs text-dim">{drop.name}</span>
                ))}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-dim">{book.note}</p>
              <a href={book.source} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[11px] text-maple hover:underline">근거 보기 ↗</a>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="font-pixel text-xl font-bold text-ink">퀘스트 전체 목록</h2>
          <EvidenceBadge level="original" />
        </div>
        <p className="mb-4 text-sm leading-relaxed text-dim">
          KMS 1.2.105 공식 공지에 기재된 117개입니다. 9/4 클라이언트 화면에서는 에델슈타인 카테고리 16개가 확인됐고,
          그중 이름을 판독한 12개에는 <span className="text-blue-600 dark:text-blue-300">인게임 확인</span> 표시를 붙였습니다.
          나머지는 메이플랜드 적용 조건·보상 검증 전인 원작 목록입니다.
        </p>
        {[
          ["레지스탕스 직업 퀘스트", resistanceQuests],
          ["에델슈타인 지역·타 직업 연계 퀘스트", edelsteinQuests],
        ].map(([label, quests]) => (
          <details key={label as string} className="pixel-panel mb-3 overflow-hidden">
            <summary className="cursor-pointer bg-surface2 px-4 py-3 font-pixel text-sm font-bold text-ink">
              {label as string} · {(quests as typeof resistanceQuests).length}개
            </summary>
            <div className="max-h-[620px] overflow-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="sticky top-0 border-b border-edge bg-surface text-left text-xs text-dim">
                  <tr><th className="px-4 py-2">레벨</th><th className="px-4 py-2">퀘스트</th><th className="px-4 py-2">시작 NPC</th><th className="px-4 py-2">조건·상태</th></tr>
                </thead>
                <tbody>
                  {(quests as typeof resistanceQuests).map((quest) => {
                    const live = LIVE_QUEST_SCREENSHOT_NAMES.has(quest.name);
                    return (
                      <tr key={`${quest.group}-${quest.name}`} className="border-b border-edge/40 last:border-0">
                        <td className="px-4 py-2 text-maple">{quest.level ? `Lv.${quest.level}` : "-"}</td>
                        <td className="px-4 py-2 font-medium text-ink"><Link href={`/quests?q=${encodeURIComponent(quest.name)}`} className="hover:text-maple">{quest.name}</Link></td>
                        <td className="px-4 py-2 text-dim">{quest.npc || "원문 미기재"}</td>
                        <td className="px-4 py-2 text-xs text-dim">{quest.condition} {live && <span className="ml-1 text-blue-600 dark:text-blue-300">· 인게임 확인</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </section>

      <section>
        <h2 className="mb-4 font-pixel text-xl font-bold text-ink">육성 루트</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {BATTLE_MAGE_LEVELING.map((row) => (
            <article key={row.level} className="pixel-panel p-4">
              <div className="flex items-start gap-3">
                <span className="rounded bg-amber-100 px-2 py-1 font-pixel text-xs font-bold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">Lv.{row.level}</span>
                <div><h3 className="font-semibold text-ink">{row.route}</h3><p className="mt-1 text-sm leading-relaxed text-dim">{row.play}</p></div>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-3 text-xs text-dim">출시 전 가이드입니다. 9/7 이후 실제 젠·지형·경험치 효율과 마북 몬스터북을 확인해 보정해야 합니다.</p>
      </section>

      <section className="pixel-panel p-5">
        <h2 className="font-pixel text-sm font-bold text-ink">주요 출처</h2>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <a href={BATTLE_MAGE_SOURCES.mapleland} target="_blank" rel="noreferrer" className="text-maple hover:underline">메이플랜드 9/7 패치노트 ↗</a>
          <a href={BATTLE_MAGE_SOURCES.maplelandPreload} target="_blank" rel="noreferrer" className="text-maple hover:underline">메이플랜드 9/4 패치노트 ↗</a>
          <a href={BATTLE_MAGE_SOURCES.kms105} target="_blank" rel="noreferrer" className="text-maple hover:underline">KMS 1.2.105 공식 아카이브 ↗</a>
          <a href={BATTLE_MAGE_SOURCES.kmstSkills} target="_blank" rel="noreferrer" className="text-maple hover:underline">KMST 초기 스킬 전체 데이터 ↗</a>
          <a href={BATTLE_MAGE_SOURCES.kmstLeveling} target="_blank" rel="noreferrer" className="text-maple hover:underline">KMST 배틀메이지 육성 기록 ↗</a>
          <a href={BATTLE_MAGE_SOURCES.community} target="_blank" rel="noreferrer" className="text-maple hover:underline">9/4 마북 몬스터북 확인글 ↗</a>
        </div>
      </section>
    </div>
  );
}
