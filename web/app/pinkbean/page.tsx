import Link from "next/link";

/**
 * 핑크빈 공략 페이지.
 *
 * 데이터 판본 주의: 메이플랜드는 빅뱅 전 KMST 기준이라 이 문서의 수치는
 * KMS 2008~2009 출시 시점(일반 핑크빈, Lv.180 본체 2.1B)을 기준으로 한다.
 * 카오스 핑크빈(빅뱅 후 GMS/KMS) 자료와 섞지 않는다.
 * 확실한 수치(사이트 DB·공지 확인)와 추론/미검증 정보를 문장에서 구분해 표기한다.
 */

const timeline = [
  ["2026-09-09", "넥슨, 「보스 <핑크빈> 원정대 입장 차단 안내」 공지 — 미공개 보스에 원정대 비정상 접근(5명)을 오전 8:45 긴급 차단. 공략 시도 기록은 없다고 명시."],
  ["2026-09-18", "정기 점검(07:00~12:00)에서 핑크빈 정식 등장 — 점검 공지의 '신규 콘텐츠' 항목."],
];

const parts = [
  ["현자 솔로몬", "300,000,000", "석상 1단계 · 광역 창/번개, 슬로우"],
  ["현자 렉스", "300,000,000", "석상 2단계 · 언데드화(힐 봉인) 계열"],
  ["휘긴", "450,000,000", "석상 3단계 · 공격 반사, 얼음 약점"],
  ["무닌", "450,000,000", "석상 4단계 · 공격 반사, 불 약점"],
  ["아리엘", "600,000,000", "석상 5단계 · 제네시스/운석, 물리·마법 무효화, 디스펠"],
  ["핑크빈 본체", "2,100,000,000", "Lv.180 · 석상 전멸 후 등장"],
];

const patterns = [
  "공격 반사: 약 20초 지속 · 60초 주기. 빅뱅 전 핑크빈이 시간 내 격파되지 못한 최대 원인 — 반사 중 딜을 넣으면 자멸한다.",
  "1/1 공격: HP·MP를 1로 만드는 광역기. 미니빈 소환·봉인 상태이상 동반.",
  "언데드화: 힐 회복이 데미지로 바뀌어 비숍 힐이 무력화된다.",
  "음표 낙하 · 빅뱅: 광역 유혹/혼란 상태이상. 원정대 전열이 흐트러진다.",
  "본체 부활 구조: HP를 다 깎아도 즉시 재생(페이즈)하는 것으로 알려져 있어, 실질 처치량이 표기 HP보다 크다. ⚠️ 메랜 실제 페이즈 수는 오픈 후 검증 필요.",
];

const drops = [
  ["타임리스 장비 풀세트", "모자·한벌옷·신발·장갑·전 직업 무기", "사이트 DB 확인"],
  ["리버스 장비 풀세트", "동일 부위 상위군, 무기 약 0.5%", "과거버전 데이터 교차 일치"],
  ["타임리스 이어링 / 시간의 돌 / 시간 조각", "장신구·교환/강화 재료", "사이트 DB 확인"],
  ["엘릭서류", "소비", "사이트 DB 확인"],
];

const sourceLinks = [
  { label: "메이플랜드 공지 — 보스 <핑크빈> 원정대 입장 차단 (2026-09-09)", href: "https://maple.land/board/notices/qr1jijfy00snag5nzooeoznx" },
  { label: "메이플랜드 공지 — 9월 18일(금) 점검 예정 안내", href: "https://maple.land/board/notices/zo71uykp1t3kgxo8k96mvj2r" },
  { label: "나무위키 — 핑크빈", href: "https://namu.wiki/w/%ED%95%91%ED%81%AC%EB%B9%88" },
  { label: "StrategyWiki — Pink Bean", href: "https://strategywiki.org/wiki/MapleStory/Pink_Bean" },
  { label: "넥슨 메이플 아카이브 — 핑크빈 공략 (2009 작성)", href: "https://archive.maplestory.nexon.com/MapleArt/Story/22687644?p=6&c=3" },
  { label: "메이플홀릭 — 「진짜로 깨지 말라고 낸 보스, 핑크빈」", href: "https://youtu.be/BHNzK7xrLDk" },
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
          HP·석상 수치는 사이트 DB(KMS v62 계열)와 커뮤니티 과거버전 데이터가 교차 일치하는 값입니다.
          단 <strong className="text-ink">본체 페이즈 수·반사 주기·실제 드롭률</strong>은 메이플랜드 자체 밸런스일 수 있어,
          정식 오픈(9/18) 후 실측이 쌓이면 확정 수치로 갱신합니다. ⚠️로 표시한 항목이 검증 대상입니다.
        </p>
      </section>

      {/* 한 줄 요약 */}
      <section className="pixel-panel p-5">
        <SectionTitle>핵심 요약</SectionTitle>
        <ul className="mt-3 grid gap-2 text-sm leading-6 text-ink">
          <li>· 석상 5종(누적 21억)을 정해진 순서로 처치한 뒤 본체 21억(총 76.5억)을 잡는 원정대 보스.</li>
          <li>· 빅뱅 전 원본은 <strong>맥뎀(데미지 상한) + 20초 반사</strong> 때문에 한국 서버 기준 약 2년간 격파 불가였습니다.</li>
          <li>· 메이플랜드가 이 스펙을 그대로 넣었다면 <strong>구조상 클리어가 극히 어렵거나 불가</strong>합니다(아래 분석 참고).</li>
        </ul>
      </section>

      {/* 타임라인 */}
      <section className="pixel-panel p-5">
        <SectionTitle>도입 타임라인</SectionTitle>
        <div className="mt-3 overflow-hidden border-2 border-edge">
          {timeline.map(([date, desc]) => (
            <div key={date} className="grid grid-cols-[7rem_1fr] gap-3 border-b border-edge/40 px-3 py-2 text-sm last:border-b-0">
              <span className="font-pixel text-amber-900 dark:text-maple">{date}</span>
              <span className="text-ink">{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 입장 경로 */}
      <section className="pixel-panel p-5">
        <SectionTitle>입장 경로</SectionTitle>
        <ol className="mt-3 grid gap-2 text-sm leading-6 text-ink">
          <li><strong>1.</strong> 리프레 정거장 → 미니맵 위쪽 연두색 지점의 NPC <strong>코르바</strong>와 대화해 드래곤으로 변신, 직접 조작해 시간의 신전으로 이동.</li>
          <li><strong>2.</strong> 시간의 신전에서 <strong>신전관리인</strong>과 대화. 세 개의 문 중 <strong>과거의 문</strong>으로 진입.</li>
          <li><strong>3.</strong> 과거의 길 길뚫: <strong>추억의 길 → 후회의 길 → 망각의 길</strong> 각 5구간. 구간마다 몬스터 처치 퀘스트로 다음 구간이 열립니다(테스피아 기준 구간당 999마리, 추억의 길 5는 필드보스 도도 포함). ⚠️ 메랜 본섭 요구치는 오픈 후 확인.</li>
          <li><strong>4.</strong> 망각의 길 최심부 「신들의 황혼」에서 <strong>원정대</strong>를 구성해 핑크빈에 입장. ⚠️ 원정대 인원·레벨 제한·제한시간은 오픈 후 공지/실측으로 확정(원본은 최대 24인·제한 1시간).</li>
        </ol>
        <p className="mt-3 text-xs text-dim">
          관련 데이터: <Link href="/maps?q=시간의 신전" className="text-amber-900 dark:text-maple underline">시간의 신전 맵</Link>,{" "}
          <Link href="/mobs?q=핑크빈" className="text-amber-900 dark:text-maple underline">핑크빈 몬스터</Link>
        </p>
      </section>

      {/* 보스 구조 */}
      <section className="pixel-panel p-5">
        <SectionTitle>보스 구조 · HP</SectionTitle>
        <p className="mt-1 text-xs text-dim">석상은 단계별로 활성화되며 이전 석상과 함께 싸웁니다. 누적 처치량 21억 후 본체 등장.</p>
        <div className="mt-3 overflow-hidden border-2 border-edge">
          <div className="grid grid-cols-[1.1fr_1fr_1.8fr] gap-2 bg-surface2 px-3 py-1.5 font-pixel text-xs text-dim">
            <span>대상</span>
            <span>HP</span>
            <span>역할 · 비고</span>
          </div>
          {parts.map(([name, hp, note]) => (
            <div key={name} className="grid grid-cols-[1.1fr_1fr_1.8fr] gap-2 border-t border-edge/40 px-3 py-2 text-sm">
              <span className="font-medium text-ink">{name}</span>
              <span className="text-amber-900 dark:text-maple">{hp}</span>
              <span className="text-dim">{note}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-dim">누적: 솔로몬 3억 → +렉스 6억 → +휘긴 10.5억 → +무닌 15억 → +아리엘 21억 → 본체 21억 (총 76.5억)</p>
      </section>

      {/* 패턴 */}
      <section className="pixel-panel p-5">
        <SectionTitle>패턴 · 기믹</SectionTitle>
        <ul className="mt-3 grid gap-2 text-sm leading-6 text-ink md:grid-cols-2">
          {patterns.map((p) => (
            <li key={p} className="bg-surface2 border-2 border-edge px-3 py-2">{p}</li>
          ))}
        </ul>
      </section>

      {/* 클리어 가능성 분석 — 핵심 */}
      <section className="pixel-panel p-5">
        <SectionTitle>메이플랜드 구조상 클리어 가능성</SectionTitle>
        <div className="mt-3 space-y-3 text-sm leading-6 text-ink">
          <p>
            핑크빈의 클리어 난이도를 좌우하는 단일 변수는 <strong>맥뎀(데미지 상한)</strong>입니다.
            빅뱅 전 핑크빈은 20초 반사 주기 안에 76.5억을 녹여야 하는데, 데미지 상한(예: 999,999) 때문에
            당시 최고 스펙으로도 시간 내 격파가 불가능했습니다. 한국 서버는 약 2년간 미격파였고, 빅뱅 패치로 맥뎀이
            풀린 뒤에야 스카니아 서버가 첫 격파했습니다(해외 2009, 일본 2010.2). <span className="text-dim">(출처: 나무위키·넥슨 아카이브)</span>
          </p>
          <p className="font-bold text-ink">따라서 메이플랜드에서의 시나리오는 세 갈래입니다(추론):</p>
          <div className="grid gap-2 md:grid-cols-3">
            <div className="border-2 border-edge bg-surface2 p-3">
              <p className="font-pixel text-amber-900 dark:text-maple">① 맥뎀 원본 유지</p>
              <p className="mt-1 text-dim">빅뱅 전 상한을 그대로 두면 사실상 클리어 불가. 넥슨이 의도한 그림에 가깝습니다(9/9 차단 공지의 통제 기조).</p>
            </div>
            <div className="border-2 border-edge bg-surface2 p-3">
              <p className="font-pixel text-amber-900 dark:text-maple">② 맥뎀 상향/직업 버프</p>
              <p className="mt-1 text-dim">데미지 상한을 올리거나 밸런스 패치가 동반되면 클리어 가능. 커뮤니티가 가장 유력하게 보는 경로입니다.</p>
            </div>
            <div className="border-2 border-edge bg-surface2 p-3">
              <p className="font-pixel text-amber-900 dark:text-maple">③ 극한 스펙 원정대</p>
              <p className="mt-1 text-dim">맥뎀 유지 + 24인 극한 스펙·비숍 다수·반사 회피 숙련. 이론상 가능하나 평균 스펙으론 장기 미격파 가능성.</p>
            </div>
          </div>
          <p className="text-dim">
            ⚠️ 9/18 오픈 시점 기준 실제 클리어 제보는 없습니다. 맥뎀 적용 여부가 확인되는 대로 이 섹션을 확정 결론으로 갱신합니다.
            클리어 여부는 신전 사냥의 산물인 <strong className="text-ink">시간의 조각</strong> 시세와도 직결됩니다.
          </p>
        </div>
      </section>

      {/* 드랍 */}
      <section className="pixel-panel p-5">
        <SectionTitle>드롭</SectionTitle>
        <div className="mt-3 overflow-hidden border-2 border-edge">
          <div className="grid grid-cols-[1.2fr_1.8fr_1fr] gap-2 bg-surface2 px-3 py-1.5 font-pixel text-xs text-dim">
            <span>아이템군</span>
            <span>내용</span>
            <span>근거</span>
          </div>
          {drops.map(([name, desc, src]) => (
            <div key={name} className="grid grid-cols-[1.2fr_1.8fr_1fr] gap-2 border-t border-edge/40 px-3 py-2 text-sm">
              <span className="font-medium text-ink">{name}</span>
              <span className="text-dim">{desc}</span>
              <span className="text-dim">{src}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-dim">⚠️ 실제 드롭률·구성은 메랜 오픈 후 실측으로 확정합니다.</p>
      </section>

      {/* 역사 */}
      <section className="pixel-panel p-5">
        <SectionTitle>「깨지 말라고 낸 보스」— 빅뱅 전 역사</SectionTitle>
        <p className="mt-3 text-sm leading-6 text-dim">
          핑크빈은 KMS 2008년 7월 출시 당시 <strong className="text-ink">최고 스펙으로도 격파할 수 없게 설계</strong>된 것으로 유명합니다.
          맥뎀과 20초 반사가 맞물려, 한국 서버는 약 2년(≈730일)간 격파에 실패했습니다. 첫 격파 시 서버 전체에
          「지치지 않는 열정으로 핑크빈을 물리친 원정대여」 공지가 나갔습니다. 메이플랜드가 이 시절을 재현하는 만큼,
          당시의 서사가 그대로 반복될지가 이번 업데이트의 관전 포인트입니다. <span>(출처: 나무위키·넥슨 아카이브·StrategyWiki)</span>
        </p>
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
