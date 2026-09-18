import Link from "next/link";

/**
 * 핑크빈 공략 페이지.
 *
 * 데이터 판본 주의: 메이플랜드는 빅뱅 전 KMST 기준이라 이 문서의 수치는
 * KMS 2008~2009 출시 시점(일반 핑크빈, Lv.180 본체 2.1B)을 기준으로 한다.
 * 카오스 핑크빈(빅뱅 후 GMS/KMS) 자료와 섞지 않는다.
 * 확실한 수치(사이트 DB·공지·영상 실측)와 추론/미검증 정보를 문장에서 구분해 표기한다.
 * 주요 공략 근거: 메이플홀릭 영상(빅뱅 전 KMS 기준 실측 분석) + 나무위키/넥슨 아카이브.
 */

const timeline = [
  ["2008-07-17", "KMS 시간의 신전 최종 보스로 핑크빈 출시. 본체 패턴(빅뱅) 미구현 상태."],
  ["2008-12-23", "플라나 서버 일반 서버 최초 본체 진입 — 진입 순간 전원 강제 종료(빅뱅 발동 모션 미구현)."],
  ["2009-05", "테스트 서버에서 스피드핵 6인이 한국 서버 첫 격파. 드롭이 이때 처음 확인됨."],
  ["2010-07-17", "빅뱅 패치(데미지 공식 변경) 이후 스카니아 서버가 정식 첫 격파."],
  ["2026-09-09", "메이플랜드, 「보스 <핑크빈> 원정대 입장 차단 안내」 — 미공개 보스 비정상 접근(5명) 긴급 차단."],
  ["2026-09-18", "정기 점검(07:00~12:00)에서 핑크빈 정식 등장."],
];

// 처치 순서: 페이지가 오를수록 상대할 석상이 늘어난다. 총 16마리.
const parts = [
  ["현자 솔로몬", "300,000,000", "회피 50", "번개(봉인) · 1/1+스턴 · 슬로우. 5번 처치"],
  ["현자 렉스", "300,000,000", "회피 51", "번개(암흑) · 포자(중독) · 1/1+언데드 · 혼란/스킬봉인. 4번 처치"],
  ["휘긴", "450,000,000", "회피 52", "돌 나뭇잎(언데드) · 공격 반사(물리/마법). 3번 처치"],
  ["무닌", "450,000,000", "회피 ↑", "돌 나뭇잎(혼란) · 단체 유혹(10~15명·맵 전체) · 추방. 2번 처치"],
  ["아리엘", "600,000,000", "회피 ↑", "성속성 무효·불/얼음/번개 반감 · 독구름(초당 2천) · 메테오(스턴/넉백) · 버프해제 · 제네시스(고정 12,000). 1번 처치"],
  ["핑크빈 본체", "2,100,000,000", "회피 55", "Lv.180 · 무속성+물리 반감 · 석상 15마리 전멸 후 등장"],
];

const patterns = [
  "투명 파워업(영상 핵심): 본체가 1~5페이지 내내 중앙에서 석상들에게 아이콘 없는 공격력 버프를 계속 걸어주며, 시간이 지날수록 강해진다. 비숍 디스펠로 잠깐만 해제 가능 — 후반 석상 데미지 급증의 원인.",
  "공격 반사(본체): 20초 지속 후 약 40초 텀(전체 ≈60초 사이클). 반사 중 딜을 넣으면 자멸 — 공대장 오더·타이머 필수. 빅뱅 전 격파를 막은 최대 시간 손실.",
  "1/1 계열: HP·MP를 1로 만드는 광역기. 석상은 개인 만병통치약(권장 1인 1,200개)으로, 본체는 만통/디스펠로 대응.",
  "언데드화(렉스·휘긴·본체): 힐 회복이 데미지로 바뀌어 비숍 힐이 무력화 — 힐 타이밍 각별히 주의.",
  "유혹(무닌·본체): 무닌은 맵 전체 단체 유혹, 본체는 음표 낙하 유혹(피격 시 왼쪽으로 강제 이동). 본체는 우측에 몰아두고 잡는 편이 안전.",
  "빅뱅(본체): 최소 17,000+ 데미지. 전사가 우측에서 어그로를 잡아 본체를 우향시키고 원거리 딜러는 뒤에서 치는 배치로 회피.",
];

const drops = [
  ["리버스 장비 (생드랍)", "무기·방어구 상위군, 무기 약 0.5%", "격파 영상 확인 — 핑크빈이 직접 드랍"],
  ["시간의 돌", "타임리스 제작 재료", "격파 영상 확인"],
  ["메이플 용사의 증표 등", "특수/소비", "영상·DB"],
  ["타임리스 장비", "리버스 상위군 — 생드랍이 아니라 시간의 돌로 제작으로 추정", "⚠️ 실측 격파 영상에 생드랍 사례 없음 · 사이트 DB 항목은 GMS 덤프 기반 가능성"],
];

const sourceLinks = [
  { label: "메이플홀릭 — 「진짜로 깨지 말라고 낸 보스, 핑크빈」 (빅뱅 전 KMS 실측 분석)", href: "https://youtu.be/BHNzK7xrLDk" },
  { label: "메이플랜드 공지 — 보스 <핑크빈> 원정대 입장 차단 (2026-09-09)", href: "https://maple.land/board/notices/qr1jijfy00snag5nzooeoznx" },
  { label: "메이플랜드 공지 — 9월 18일(금) 점검 예정 안내", href: "https://maple.land/board/notices/zo71uykp1t3kgxo8k96mvj2r" },
  { label: "나무위키 — 핑크빈", href: "https://namu.wiki/w/%ED%95%91%ED%81%AC%EB%B9%88" },
  { label: "StrategyWiki — Pink Bean", href: "https://strategywiki.org/wiki/MapleStory/Pink_Bean" },
  { label: "넥슨 메이플 아카이브 — 핑크빈 공략 (2009 작성)", href: "https://archive.maplestory.nexon.com/MapleArt/Story/22687644?p=6&c=3" },
];

function Badge({ children }: { children: string }) {
  return (
    <span className="pixel-badge inline-flex font-pixel bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] px-2.5 py-1 text-xs text-amber-900 dark:text-maple">
      {children}
    </span>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="text-lg font-bold text-ink font-pixel">{children}</h2>;
}

export default function PinkBeanPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>시간의 신전</Badge>
          <Badge>원정대 보스</Badge>
          <Badge>2026-09-18 등장</Badge>
        </div>
        <h1 className="text-2xl font-bold text-ink md:text-3xl font-pixel">핑크빈 공략</h1>
        <p className="max-w-3xl text-sm leading-6 text-dim">
          시간의 신전 최심부 「신들의 황혼」의 원정대 보스. 메이플랜드는 빅뱅 전 KMST 기준이라,
          이 문서는 KMS 2008~2009 출시 시점의 <strong className="text-ink">일반 핑크빈(Lv.180 본체 2.1B)</strong>을 기준으로 합니다.
          카오스 핑크빈(빅뱅 후) 자료와 섞지 않습니다.
        </p>
      </section>

      {/* 데이터 판본 주의 */}
      <section className="border-2 border-edge bg-surface2 p-4 text-sm leading-6 text-ink">
        <p className="font-bold font-pixel">ⓘ 데이터 판본 주의</p>
        <p className="mt-1 text-dim">
          HP·석상·패턴 수치는 사이트 DB(KMS v62 계열)와 빅뱅 전 실측 공략(메이플홀릭 영상)이 교차 일치하는 값입니다.
          단 <strong className="text-ink">실제 드롭 구성·반사/파워업의 메랜 적용 여부·원정대 세부 규칙</strong>은 메이플랜드 자체 밸런스일 수 있어,
          정식 오픈(9/18) 후 실측이 쌓이면 확정 수치로 갱신합니다. ⚠️로 표시한 항목이 검증 대상입니다.
        </p>
      </section>

      {/* 한 줄 요약 */}
      <section className="pixel-panel p-5">
        <SectionTitle>핵심 요약</SectionTitle>
        <ul className="mt-3 grid gap-2 text-sm leading-6 text-ink">
          <li>· 석상 5종을 정해진 순서로 <strong>총 16마리</strong> 처치(솔로몬 5·렉스 4·휘긴 3·무닌 2·아리엘 1)한 뒤, 본체 21억을 잡는 원정대 보스. 제한시간 1시간.</li>
          <li>· 빅뱅 전 원본은 한국 서버 기준 약 2년간 정식 격파 실패 — 그러나 원인은 스펙 부족이 아니라 <strong>캐시성 물량(부활·회복·체력) 강제 구조</strong>였다는 것이 실측 분석의 결론입니다.</li>
          <li>· 메이플랜드에서의 클리어 가능성은 <strong>데미지 공식(맥뎀) + 캐시 소모품 투입 의지</strong>에 달려 있습니다(아래 분석).</li>
        </ul>
      </section>

      {/* 타임라인 */}
      <section className="pixel-panel p-5">
        <SectionTitle>역사 · 도입 타임라인</SectionTitle>
        <div className="mt-3 overflow-hidden border-2 border-edge">
          {timeline.map(([date, desc]) => (
            <div key={date} className="grid grid-cols-[7rem_1fr] gap-3 border-b border-edge/40 px-3 py-2 text-sm last:border-b-0">
              <span className="font-pixel text-amber-900 dark:text-maple">{date}</span>
              <span className="text-ink">{desc}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-dim">
          한국은 빅뱅 전 정식 격파에 끝내 실패했고(핵 격파만 존재), 일본·글로벌·유럽·동남아·대만은 모두 격파했습니다.
          아이러니하게도 우리가 아는 빅뱅 전 핑크빈 드롭은 2009년 핵 격파로 확인된 것입니다. <span>(출처: 메이플홀릭 영상)</span>
        </p>
      </section>

      {/* 입장 경로 */}
      <section className="pixel-panel p-5">
        <SectionTitle>입장 경로</SectionTitle>
        <ol className="mt-3 grid gap-2 text-sm leading-6 text-ink">
          <li><strong>레벨 조건:</strong> 퀘스트라인 수행 레벨 140부터 도전 가능(최저 레벨 제한 자체는 없으나 길뚫 퀘스트가 140 요구).</li>
          <li><strong>1.</strong> 리프레 정거장 → 미니맵 위쪽 연두색 지점의 NPC <strong>코르바</strong>와 대화해 드래곤으로 변신, 직접 조작해 시간의 신전으로 이동.</li>
          <li><strong>2.</strong> 시간의 신전에서 <strong>신전관리인</strong>과 대화. 과거의 문으로 진입해 추억 → 후회 → 망각의 길을 길뚫.</li>
          <li><strong>3.</strong> 부서진 회랑의 결계를 풀려면 퀘스트 보상인 <strong>카오스의 구슬</strong>이 필요(매일 제작 가능하나 재료 수급이 관문). 이 구슬로 신전 최심부로 이동.</li>
          <li><strong>4.</strong> 입장은 <strong>15채널</strong>에서만 가능. 잊혀진 신전관리인을 통해 「신들의 황혼」으로 <strong>최대 30인 원정대</strong> 입장. 제한시간 1시간. <span className="text-dim">⚠️ 메랜 본섭의 레벨·채널·인원 규칙은 오픈 후 공지로 재확인.</span></li>
        </ol>
        <p className="mt-3 text-xs text-dim">
          관련 데이터: <Link href="/maps?q=시간의 신전" className="text-amber-900 dark:text-maple underline">시간의 신전 맵</Link>,{" "}
          <Link href="/mobs?q=핑크빈" className="text-amber-900 dark:text-maple underline">핑크빈 몬스터</Link>
        </p>
      </section>

      {/* 보스 구조 */}
      <section className="pixel-panel p-5">
        <SectionTitle>보스 구조 · HP · 처치 순서</SectionTitle>
        <p className="mt-1 text-xs text-dim">페이지가 오를수록 활성 석상이 늘어납니다(1p 솔로몬 → 5p 5종 동시). 총 16마리를 잡아야 본체 등장.</p>
        <div className="mt-3 overflow-hidden border-2 border-edge">
          <div className="grid grid-cols-[1.1fr_1fr_0.7fr_2fr] gap-2 bg-surface2 px-3 py-1.5 font-pixel text-xs text-dim">
            <span>대상</span>
            <span>HP</span>
            <span>회피</span>
            <span>패턴 · 처치 횟수</span>
          </div>
          {parts.map(([name, hp, dodge, note]) => (
            <div key={name} className="grid grid-cols-[1.1fr_1fr_0.7fr_2fr] gap-2 border-t border-edge/40 px-3 py-2 text-sm">
              <span className="font-medium text-ink">{name}</span>
              <span className="text-amber-900 dark:text-maple">{hp}</span>
              <span className="text-dim">{dodge}</span>
              <span className="text-dim">{note}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-dim">
          누적: 솔로몬 3억 → +렉스 6억 → +휘긴 10.5억 → +무닌 15억 → +아리엘 21억 → 본체 21억 (총 76.5억).
          미니빈은 본체가 소환하는 잡몹(HP 138,000 → 이후 303,000 상향, 사이트 DB는 303,000판).
        </p>
      </section>

      {/* 패턴 */}
      <section className="pixel-panel p-5">
        <SectionTitle>패턴 · 기믹</SectionTitle>
        <ul className="mt-3 grid gap-2 text-sm leading-6 text-ink md:grid-cols-2">
          {patterns.map((p) => (
            <li key={p} className="bg-surface2 border-2 border-edge px-3 py-2">{p}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-dim">
          동선의 핵심: 무닌 앞을 지나갈 때 단체 유혹으로 원정대가 전멸할 수 있어, 파티 전원이 용사의 의지로 유혹을 씹고 한 번에 넘는 것이 정석. 무닌의 추방·수레바퀴 부활자는 맵 왼쪽에서 등장하므로 좌우 진영을 유지합니다.
        </p>
      </section>

      {/* 클리어 가능성 분석 — 핵심 */}
      <section className="pixel-panel p-5">
        <SectionTitle>메이플랜드 구조상 클리어 가능성</SectionTitle>
        <div className="mt-3 space-y-3 text-sm leading-6 text-ink">
          <p>
            빅뱅 전 핑크빈이 한국에서 정식 격파되지 못한 원인은 흔히 알려진 <strong>맥뎀(데미지 상한)</strong>만이 아닙니다.
            실측 분석(메이플홀릭)의 결론은 <strong>「캐시성 물량 강제」</strong>입니다 — 일본 첫 격파 원정대에는 <strong>비숍이 없었고</strong>
            (언데드·디버프 탓에 힐러 대신 딜러를 채우고 만병통치약을 도배), 운명의 수레바퀴(부활)와 AP 되돌리기로 체력을 3만까지 올리는 것이
            사실상 개발진이 의도한 공략이었습니다. 한국은 공략(2009 초 완성)과 딜이 부족해서가 아니라, 그 물량을 쏟지 않아 못 깬 것으로 분석됩니다.
            <span className="text-dim"> (빅뱅의 데미지 공식 변경 이후에야 2010.7 스카니아 첫 격파.)</span>
          </p>
          <p className="font-bold text-ink">메이플랜드 관점 시나리오(추론):</p>
          <div className="grid gap-2 md:grid-cols-3">
            <div className="border-2 border-edge bg-surface2 p-3">
              <p className="font-pixel text-amber-900 dark:text-maple">① 원본 데미지 공식 유지</p>
              <p className="mt-1 text-dim">맥뎀·데미지 공식이 빅뱅 전 그대로면 딜 부족 + 반사·투명 파워업으로 타임어택이 극악. 캐시 물량 없이는 사실상 불가.</p>
            </div>
            <div className="border-2 border-edge bg-surface2 p-3">
              <p className="font-pixel text-amber-900 dark:text-maple">② 캐시 물량 총동원</p>
              <p className="mt-1 text-dim">수레바퀴·AP 되돌리기·만병통치약을 갈아넣고 비숍을 딜러로 대체하는 「의도된 공략」을 그대로 재현하면, 30인 극한 스펙 기준 이론상 가능.</p>
            </div>
            <div className="border-2 border-edge bg-surface2 p-3">
              <p className="font-pixel text-amber-900 dark:text-maple">③ 운영 밸런스 조정</p>
              <p className="mt-1 text-dim">메랜이 데미지 상한을 올리거나 직업 버프를 동반하면 난이도 급락. 넥슨의 9/9 차단 기조를 보면 통제 의도가 읽힙니다.</p>
            </div>
          </div>
          <p className="text-dim">
            참고: 바이퍼의 <strong className="text-ink">오크통</strong>(1바이퍼)은 물약쌀에는 유효하지만, 본체(6페이지)에는 통하지 않아 클리어 타임 단축에는 무의미합니다 — 커뮤니티의 「1바이퍼로 가능?」 논쟁에 대한 답.
          </p>
          <p className="text-dim">
            ⚠️ 9/18 오픈 시점 기준 실제 클리어 제보는 없습니다. 맥뎀·캐시 소모품 적용 여부가 확인되는 대로 이 섹션을 확정 결론으로 갱신합니다.
            클리어 여부는 신전 사냥의 산물인 <strong className="text-ink">시간의 조각</strong> 시세와도 직결됩니다.
          </p>
        </div>
      </section>

      {/* 드랍 */}
      <section className="pixel-panel p-5">
        <SectionTitle>드롭</SectionTitle>
        <div className="mt-3 overflow-hidden border-2 border-edge">
          <div className="grid grid-cols-[1.2fr_1.8fr_1.3fr] gap-2 bg-surface2 px-3 py-1.5 font-pixel text-xs text-dim">
            <span>아이템군</span>
            <span>내용</span>
            <span>근거</span>
          </div>
          {drops.map(([name, desc, src]) => (
            <div key={name} className="grid grid-cols-[1.2fr_1.8fr_1.3fr] gap-2 border-t border-edge/40 px-3 py-2 text-sm">
              <span className="font-medium text-ink">{name}</span>
              <span className="text-dim">{desc}</span>
              <span className="text-dim">{src}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-dim">⚠️ 실제 드롭률·구성은 메랜 오픈 후 실측으로 확정합니다. 리버스=생드랍, 타임리스=시간의 돌 제작 구조가 유력합니다.</p>
      </section>

      {/* 참고 자료 */}
      <section className="pixel-panel p-5">
        <SectionTitle>참고한 자료</SectionTitle>
        <div className="mt-3 flex flex-wrap gap-2">
          {sourceLinks.map((s) => (
            <a
              key={s.href}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="border-2 border-edge px-3 py-2 text-sm text-ink transition-colors hover:border-maple hover:text-maple"
            >
              {s.label}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
