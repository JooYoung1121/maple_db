import Link from "next/link";
import type { ReactNode } from "react";
import CanonDiffInfo from "@/components/CanonDiffInfo";
import { CANON_DIFFS, DOJO_CANON_DIFFS } from "@/lib/canonDiffs";
import DojoCalculator from "./DojoCalculator";

type Floor = {
  floor: number;
  stage: number;
  boss: string;
  note?: string;
};

type FloorGroup = {
  label: string;
  range: string;
  time: string;
  rest?: string;
  floors: Floor[];
};

const OFFICIAL_PATCH = "https://maple.land/board/notices/ze975xgn5g5p18nra6i1a6wf";
const MAPLEFEED = "https://maplefeed.com/";
const COMMUNITY_CLEAR = "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=3869205";
const COMMUNITY_GUIDE = "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=3864285";
const OLD_GUIDE = "https://www.southperry.net/printthread.php?tid=11782";
const GMS_PATCH = "https://maplenewsnetwork.wordpress.com/2009/08/26/gms-version-0-75-updates/";
const OLD_REWARDS = "https://bc.hidden-street.net/mu-lung-dojo-prizes";

function pointsForStage(stage: number, party = false) {
  const solo = stage <= 5 ? 2 : stage <= 10 ? 3 : stage <= 15 ? 4 : stage <= 20 ? 5 : stage <= 25 ? 6 : stage <= 30 ? 7 : 8;
  return party ? solo - 1 : solo;
}

function cumulativeScore(stage: number, party = false) {
  let total = 0;
  for (let current = 1; current <= stage; current += 1) total += pointsForStage(current, party);
  return total;
}

const FLOOR_GROUPS: FloorGroup[] = [
  {
    label: "초급",
    range: "1~5층 · 1~5단계",
    time: "5분",
    rest: "6층 휴게실",
    floors: [
      { floor: 1, stage: 1, boss: "마노" },
      { floor: 2, stage: 2, boss: "스텀피" },
      { floor: 3, stage: 3, boss: "데우" },
      { floor: 4, stage: 4, boss: "킹슬라임" },
      { floor: 5, stage: 5, boss: "대왕지네" },
    ],
  },
  {
    label: "하급",
    range: "7~11층 · 6~10단계",
    time: "6분",
    rest: "12층 휴게실",
    floors: [
      { floor: 7, stage: 6, boss: "파우스트" },
      { floor: 8, stage: 7, boss: "킹크랑" },
      { floor: 9, stage: 8, boss: "머쉬맘" },
      { floor: 10, stage: 9, boss: "알리샤르", note: "봉인·암흑" },
      { floor: 11, stage: 10, boss: "타이머" },
    ],
  },
  {
    label: "중급 I",
    range: "13~17층 · 11~15단계",
    time: "7분",
    rest: "18층 휴게실",
    floors: [
      { floor: 13, stage: 11, boss: "다일" },
      { floor: 14, stage: 12, boss: "파파픽시", note: "마법 직업 난관 제보" },
      { floor: 15, stage: 13, boss: "좀비머쉬맘" },
      { floor: 16, stage: 14, boss: "제노" },
      { floor: 17, stage: 15, boss: "데비존" },
    ],
  },
  {
    label: "중급 II",
    range: "19~23층 · 16~20단계",
    time: "8분",
    rest: "24층 휴게실",
    floors: [
      { floor: 19, stage: 16, boss: "구미호" },
      { floor: 20, stage: 17, boss: "태륜" },
      { floor: 21, stage: 18, boss: "강화형 포이즌 골렘" },
      { floor: 22, stage: 19, boss: "요괴선사" },
      { floor: 23, stage: 20, boss: "주니어 발록" },
    ],
  },
  {
    label: "상급 I",
    range: "25~29층 · 21~25단계",
    time: "9분",
    rest: "30층 휴게실",
    floors: [
      { floor: 25, stage: 21, boss: "엘리쟈" },
      { floor: 26, stage: 22, boss: "프랑켄로이드" },
      { floor: 27, stage: 23, boss: "키메라" },
      { floor: 28, stage: 24, boss: "포장마차" },
      { floor: 29, stage: 25, boss: "스노우맨" },
    ],
  },
  {
    label: "상급 II",
    range: "31~35층 · 26~30단계",
    time: "10분",
    rest: "36층 휴게실",
    floors: [
      { floor: 31, stage: 26, boss: "블루 머쉬맘" },
      { floor: 32, stage: 27, boss: "크림슨 발록", note: "점수런 권장 종료선" },
      { floor: 33, stage: 28, boss: "마뇽" },
      { floor: 34, stage: 29, boss: "그리프" },
      { floor: 35, stage: 30, boss: "레비아탄" },
    ],
  },
  {
    label: "최상층",
    range: "37~38층 · 31~32단계",
    time: "15분",
    floors: [
      { floor: 37, stage: 31, boss: "파풀라투스", note: "2페이즈 포함" },
      { floor: 38, stage: 32, boss: "무공", note: "유혹·언데드·공반" },
    ],
  },
];

const MILESTONES = [
  { stage: 5, floor: 5, boss: "대왕지네", time: "5분 구간", guide: "짧은 테스트런" },
  { stage: 10, floor: 11, boss: "타이머", time: "6분 구간", guide: "저레벨 반복" },
  { stage: 15, floor: 17, boss: "데비존", time: "7분 구간", guide: "중간 저장선" },
  { stage: 20, floor: 23, boss: "주니어 발록", time: "8분 구간", guide: "중레벨 반복" },
  { stage: 25, floor: 29, boss: "스노우맨", time: "9분 구간", guide: "후반 진입 전" },
  { stage: 27, floor: 32, boss: "크림슨 발록", time: "10분 구간 초반", guide: "점수만이면 우선 추천" },
  { stage: 30, floor: 35, boss: "레비아탄", time: "10분 구간 완료", guide: "후반 3종이 빠를 때" },
  { stage: 32, floor: 38, boss: "무공", time: "15분 최종 구간", guide: "훈장·기록 목적" },
];

const BELTS = [
  { name: "흰색 허리띠", level: 25, points: 200, stat: "올스탯 +1", extra: "", defense: "물/마방 +10", avoid: 3 },
  { name: "노란색 허리띠", level: 35, points: 1800, stat: "올스탯 +2", extra: "", defense: "물/마방 +20", avoid: 6 },
  { name: "파란색 허리띠", level: 45, points: 4000, stat: "올스탯 +3", extra: "", defense: "물/마방 +30", avoid: 9 },
  { name: "빨간색 허리띠", level: 60, points: 9200, stat: "올스탯 +4", extra: "", defense: "물/마방 +40", avoid: 12 },
  { name: "검은색 허리띠", level: 75, points: 17000, stat: "올스탯 +3", extra: "공격력 +1 · 마력 +4", defense: "물/마방 +50", avoid: 15 },
];

export default function DojoPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <header>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h1 className="font-pixel text-2xl font-bold">🥋 무릉도장 공략</h1>
          <span className="font-pixel text-[10px] px-2 py-1 border border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300">
            8/7 공식 패치·첫날 실측 반영
          </span>
        </div>
        <p className="text-sm text-dim">
          메이플랜드 38층의 보스·점수·구간 제한 시간, 솔플 점수런과 최상층 파티 조합을 정리했습니다.
        </p>
      </header>

      <section className="pixel-panel p-4 border-emerald-400 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-pixel text-sm text-ink">📢 메이플랜드 공식 사양</h2>
            <p className="text-sm mt-2">
              <b>Lv.25 이상</b> 입장, 파티원 레벨 차 <b>30 이하</b>. 커닝시티·무릉 사원의 공고문 또는 차원의 거울로 이동해 소공과의 대결 후 입장합니다.
            </p>
          </div>
          <a href={OFFICIAL_PATCH} target="_blank" rel="noopener noreferrer" className="pixel-btn px-3 py-2 text-xs shrink-0">8/7 공식 패치노트 ↗</a>
        </div>
        <div className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 px-3 py-2">
          공식 명칭은 <b>38층</b>이지만, 휴게실 6층을 제외하면 보스는 원작과 같은 <b>32단계</b>입니다. 포인트·시간표에는 실제 층과 보스 단계를 함께 표시합니다.
        </div>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
        <QuickCard label="입장" value="Lv.25+" note="파티 레벨 차 30 이하" />
        <QuickCard label="구성" value="38층" note="보스 32단계 + 휴게실 6층" info={<CanonDiffInfo entry={CANON_DIFFS["dojo.floor-count"]} compact />} />
        <QuickCard label="솔플 완주" value="151P" note="파티 완주 119P" />
        <QuickCard label="하루 제한" value="3,500P" note="입장 10회 제한 제보 (커뮤 실측)" />
        <QuickCard label="한정 훈장" value="9/11까지" note="38층 클리어 · 소공의 후계자" />
      </section>

      <section className="pixel-panel p-5 space-y-4">
        <div>
          <h2 className="font-pixel text-base text-ink">🎒 입장 전 준비</h2>
          <p className="text-xs text-dim mt-1">공식 사양과 첫날 반복 제보를 구분해 정리했습니다.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Checklist title="공통 세팅" items={[
            "표창·불릿·소환돌·마법의 돌 등 직업 소모품은 입장 전에 충분히 준비",
            "일반 소비 아이템은 도장 안에서 제한되므로 입장 전 도핑·파티 버프를 마친 뒤 유지 여부 확인",
            "보스가 소환한 몬스터의 도장 전용 회복 아이템은 획득 즉시 파티 전체에 적용",
            "포탈을 타야 점수가 반영되므로 보스 처치 후 사망·시간 초과 전에 오른쪽 포탈 이동",
          ]} />
          <Checklist title="생존·사망 주의" items={[
            "첫날 호부가 차감됐다는 제보가 있어 공식 확인 전에는 사망하지 않는 운영을 권장",
            "38층 무공의 언데드 상태에서는 비숍 힐이 치명적일 수 있으므로 언데드 콜 후 힐 중지",
            "공격 반사 아이콘·모션이 보이면 즉시 공격 중단, 리저렉션은 최종 구간용으로 보존",
            "휴게실에서 HP·MP를 회복하고 솔플 기록을 저장할 수 있지만 저장 이탈 기록은 랭킹에서 제외 예정",
          ]} />
        </div>
        <div className="flex justify-end"><CanonDiffInfo entry={CANON_DIFFS["dojo.death-penalty"]} /></div>
      </section>

      <section className="pixel-panel p-5 space-y-4">
        <div>
          <h2 className="font-pixel text-base text-ink">🧭 점수런 핵심</h2>
          <p className="text-xs text-dim mt-1">훈장 1회 완주와 허리띠 반복 점수런은 목표를 분리하는 편이 효율적입니다.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Tip number="1" title="솔플은 보스마다 +1P" text="파티보다 모든 보스 단계에서 1점씩 더 받습니다. 완주 기준 솔플 151P, 파티 119P라 허리띠 누적은 가능한 스펙이라면 솔플이 유리합니다." />
          <Tip number="2" title="점수만이면 32층 크림슨 발록" text="크림슨 발록까지 솔플 114P로 완주 점수의 75.5%를 확보합니다. 고HP 마뇽·그리프·레비아탄·파풀라투스·무공 5마리를 건너뛰는 첫 우선 효율선입니다." />
          <Tip number="3" title="후반 3종이 빠르면 레비아탄" text="크림슨 발록에서 레비아탄까지 추가 점수는 21P입니다. 계산기의 손익분기 시간보다 빨리 세 보스를 잡을 때만 더 깊게 가는 편이 점수/시간상 이득입니다." />
          <Tip number="4" title="최상층은 훈장·기록 목적" text="파풀라투스와 무공은 15분을 공유하고 합계 16P입니다. 9월 11일 전 소공의 후계자 훈장을 한 번 확보한 뒤 점수런 목표를 다시 정하세요." />
          <Tip number="5" title="하루 상한을 기준으로 일정 계획" text="커뮤니티 실측 기준 수련 점수는 하루 3,500P 상한, 입장은 하루 10회 제한 제보가 있습니다. 검은 띠 17,000P는 풀컷을 채워도 최소 5일이 필요하니 매일 상한까지 채우는 루틴이 최단 경로입니다." />
        </div>

        <div className="border-t-2 border-edge pt-4">
          <h3 className="font-pixel text-sm text-ink mb-2">도장 필살기</h3>
          <p className="text-xs text-dim mb-3">공격하거나 피격될 때 게이지가 차며, 원작과 같은 세 기술을 상황에 맞춰 사용합니다.</p>
          <div className="grid sm:grid-cols-3 gap-2">
            <SkillCard name="죽간천격" effect="보스 HP 30% 피해" use="고HP 후반 보스에 우선" />
            <SkillCard name="금강불괴" effect="일정 시간 무적" use="1/1·위험 패턴 넘기기" />
            <SkillCard name="지화천폭" effect="일정 시간 피해 2배" use="구간 타이머 단축" />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-pixel text-base text-ink">🏯 38층 · 32단계 보스와 누적 점수</h2>
          <p className="text-xs text-dim mt-1">시간은 실제 평균 클리어 시간이 아니라 각 구간의 제한 시간입니다. 휴게실·로딩 시간은 별도입니다.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {FLOOR_GROUPS.map((group) => (
            <article key={group.range} className="pixel-panel p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="font-pixel text-sm text-ink">{group.label} · {group.range}</h3>
                  <p className="text-[11px] text-dim mt-0.5">구간 제한 {group.time}</p>
                </div>
                <span className="font-pixel text-[9px] text-maple border border-maple px-1.5 py-1 text-right">
                  1인 +{pointsForStage(group.floors[0].stage)}P<br />파티 +{pointsForStage(group.floors[0].stage, true)}P
                </span>
              </div>
              <div className="divide-y divide-edge/50">
                {group.floors.map((floor) => (
                  <div key={floor.floor} className="flex items-center gap-2 py-1.5 text-sm">
                    <span className="font-pixel text-[9px] text-dim w-14 shrink-0">{floor.floor}F · {floor.stage}단계</span>
                    <b className="shrink-0">{floor.boss}</b>
                    {floor.note && <span className="hidden sm:inline text-[10px] text-dim ml-auto text-right">{floor.note}</span>}
                    <span className="font-pixel text-[9px] text-maple ml-auto shrink-0" title="솔플 누적 / 파티 누적">
                      {cumulativeScore(floor.stage)} / {cumulativeScore(floor.stage, true)}P
                    </span>
                  </div>
                ))}
              </div>
              {group.rest && <div className="mt-2 pt-2 border-t border-dashed border-edge text-[10px] text-dim text-center">☕ {group.rest} · 시간 제한 없이 회복·저장</div>}
            </article>
          ))}
        </div>
      </section>

      <section className="pixel-panel p-5 space-y-4">
        <div>
          <h2 className="font-pixel text-base text-ink">📈 어디까지 가면 몇 점인가</h2>
          <p className="text-xs text-dim mt-1">누적 제한 시간 상한은 구간별 5+6+7+8+9+10+15분으로 총 60분이며, 실제 강한 캐릭터는 훨씬 빠릅니다.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-dim border-b-2 border-edge">
                <th className="py-2 pr-3">종료 보스</th>
                <th className="pr-3">단계·층</th>
                <th className="pr-3">솔플 누적</th>
                <th className="pr-3">파티 누적</th>
                <th className="pr-3">해당 구간</th>
                <th>용도</th>
              </tr>
            </thead>
            <tbody>
              {MILESTONES.map((item) => (
                <tr key={item.stage} className={`border-b border-edge/50 ${item.stage === 27 ? "bg-maple/5" : ""}`}>
                  <td className="py-2 pr-3 font-bold">{item.boss}</td>
                  <td className="pr-3 text-dim">{item.stage}단계 · {item.floor}층</td>
                  <td className="pr-3 font-pixel text-xs">{cumulativeScore(item.stage)}P</td>
                  <td className="pr-3 font-pixel text-xs">{cumulativeScore(item.stage, true)}P</td>
                  <td className="pr-3 text-dim">{item.time}</td>
                  <td className={item.stage === 27 ? "text-maple font-bold" : "text-dim"}>{item.guide}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-dim">첫날 공유된 고자본 나로 영상에는 32층 진입까지 약 5분대 사례가 있지만, 이는 보편 시간이 아닙니다. 아래 계산기에는 본인 실측 시간을 입력하세요.</p>
      </section>

      <DojoCalculator />

      <section className="pixel-panel p-5 space-y-4">
        <div>
          <h2 className="font-pixel text-base text-ink">👥 38층 전체 클리어 파티</h2>
          <p className="text-xs text-dim mt-1">첫날 완주·모집 사례에서 반복된 역할 기준입니다. 직업을 강제하는 절대 조합은 아닙니다.</p>
        </div>
        <div className="border border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 p-3 text-sm">
          <b className="text-emerald-700 dark:text-emerald-300">첫날 확인된 완주 사례</b>
          <p className="text-xs text-dim mt-1">평균 Lv.185+ · 비숍 1 · 보우마스터 1 · 나이트로드 3 · 다크나이트 1. 비숍은 최종층에서 힐을 멈추고 리저렉션 1회를 사용했습니다.</p>
          <a href={COMMUNITY_CLEAR} target="_blank" rel="noopener noreferrer" className="inline-block text-[11px] text-maple underline mt-1">완주 게시물 확인 ↗</a>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <RoleCard role="생존" jobs="다크나이트" text="하이퍼 바디로 1/1 이후 생존 여유 확보. 딜보다 파티 HP 유지가 우선입니다." />
          <RoleCard role="크리 보조" jobs="보마 또는 신궁" text="샤프 아이즈로 나로·물리 딜러 효율을 높입니다. 모집 피드에서 가장 반복된 고정 자리입니다." />
          <RoleCard role="회복·복구" jobs="비숍" text="중반 회복과 리저렉션 담당. 38층 언데드 중 힐 금지 콜이 핵심입니다." />
          <RoleCard role="주력 딜 3" jobs="나로·히어로·섀도어 등" text="나로 다수 구성이 첫 완주에서 확인됐고, 섀도어 연막을 섞은 안정 조합도 활발히 모집됐습니다." />
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <Danger floor="37F" boss="파풀라투스" text="2페이즈까지 포함. 최종 15분을 무공과 공유하므로 리저·필살기·주력 버프를 전부 소모하지 않습니다." />
          <Danger floor="38F" boss="무공" text="유혹·언데드·공격 반사 사용이 첫날 확인됐습니다. 언데드=힐 중지, 공반=전원 공격 중단을 짧게 콜합니다." />
          <Danger floor="전멸 대응" boss="리저렉션" text="첫 완주 사례는 리저렉션 1회로 복구했습니다. 비숍이 먼저 쓰러지지 않도록 HB와 위치를 우선합니다." />
        </div>
      </section>

      <section className="pixel-panel p-5 space-y-4">
        <div>
          <h2 className="font-pixel text-base text-ink">💬 첫날 커뮤니티 반응</h2>
          <p className="text-xs text-dim mt-1">공식 Discord 모집 미러와 메랜갤 게시물을 같은 시각대에 교차 확인했습니다.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-2">
          <ReactionCard title="6인 훈장팟이 중심" text="Lv.140~180+ 모집이 빠르게 늘었고 비숍·HB·샤프 자리가 사실상 핵심으로 굳는 분위기입니다." />
          <ReactionCard title="솔플은 점수, 파티는 최초 완주" text="파티는 보스당 1점이 적어 검은 띠 반복에는 불리하지만, 9/11 한정 훈장을 먼저 따려는 수요가 큽니다." />
          <ReactionCard title="직업 격차 우려" text="법사·전사 일부가 딜 기여와 파티 선호도에 불만을 보였고, 나로·보마 선호가 두드러졌습니다. 아직 첫날 평가라 고정 티어로 보기는 이릅니다." />
          <ReactionCard title="17,000P 반복 부담" text="검은 띠는 완주 솔플 113판, 크림슨 발록 종료 솔플 150판입니다. 파티 완주는 143판이라 계산기 기반 목표 설정이 중요합니다." />
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <a href={MAPLEFEED} target="_blank" rel="noopener noreferrer" className="pixel-card px-3 py-2 text-maple">공식 Discord 모집 미러 ↗</a>
          <a href={COMMUNITY_GUIDE} target="_blank" rel="noopener noreferrer" className="pixel-card px-3 py-2 text-maple">층·점수 커뮤니티 정리 ↗</a>
          <Link href="/channels" className="pixel-card px-3 py-2 text-maple">커뮤니티 채널 모음 →</Link>
        </div>
      </section>

      <section className="pixel-panel p-5 space-y-4">
        <div>
          <h2 className="font-pixel text-base text-ink">🎁 허리띠·훈장·랭킹 보상</h2>
          <p className="text-xs text-dim mt-1">허리띠는 낮은 단계부터 순서대로 받아야 하며 각 아이템은 업그레이드 3회입니다.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-dim border-b-2 border-edge">
                <th className="py-2 pr-3">보상</th>
                <th className="pr-3">착용 Lv.</th>
                <th className="pr-3">필요 누적 P</th>
                <th className="pr-3">능력치</th>
                <th className="pr-3">추가</th>
                <th className="pr-3">방어</th>
                <th>회피</th>
              </tr>
            </thead>
            <tbody>
              {BELTS.map((belt) => (
                <tr key={belt.name} className="border-b border-edge/50">
                  <td className={`py-2 pr-3 font-bold ${belt.name === "검은색 허리띠" ? "text-maple" : ""}`}>
                    <span className="inline-flex items-center gap-1">{belt.name}{belt.name === "검은색 허리띠" && <CanonDiffInfo entry={CANON_DIFFS["dojo.black-belt"]} compact align="left" />}</span>
                  </td>
                  <td className="pr-3">{belt.level}</td>
                  <td className="pr-3 font-pixel text-xs">{belt.points.toLocaleString()}P</td>
                  <td className="pr-3">{belt.stat}</td>
                  <td className="pr-3 text-maple">{belt.extra || "-"}</td>
                  <td className="pr-3 text-dim">{belt.defense}</td>
                  <td>+{belt.avoid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid md:grid-cols-2 gap-3 text-xs">
          <div className="pixel-card p-3">
            <div className="flex items-center justify-between gap-2">
              <b className="text-ink">소공의 후계자 · Lv.80</b>
              <CanonDiffInfo entry={CANON_DIFFS["dojo.successor-medal"]} />
            </div>
            <p className="text-maple mt-1">올스탯 +3 · HP/MP +100</p>
            <p className="text-dim mt-1">2026년 9월 11일까지 최상층 클리어 시 지급. 고유 아이템·교환 불가입니다.</p>
            <Link href="/medals" className="inline-block text-maple underline mt-2">훈장 가이드 보기 →</Link>
          </div>
          <div className="pixel-card p-3">
            <div className="flex items-center justify-between gap-2">
              <b className="text-ink">솔로 클리어 시간 랭킹 · 출시됨</b>
              <CanonDiffInfo entry={CANON_DIFFS["dojo.ranking"]} />
            </div>
            <p className="text-dim mt-1">저장 후 이탈 기록은 제외. 기간제 엔젤릭 블레스(공5/마10)·다크(공10/마20)·화이트(공15/마30) 보상이 예고됐습니다.</p>
            <p className="text-[10px] text-amber-600 dark:text-amber-300 mt-2">8/10 무중단 배포로 적용 · 순위 반영이 늦다는 제보 있음 · 순위 구간·지급 기간은 후속 공지 대기</p>
          </div>
        </div>
      </section>

      <section className="pixel-panel p-5 space-y-3">
        <div>
          <h2 className="font-pixel text-base text-ink">ⓘ 원작과 달라진 점</h2>
          <p className="text-xs text-dim mt-1">메이플랜드 확정값과 2009년 빅뱅 전 원작 기준을 분리했습니다. 각 항목의 ⓘ 버튼을 눌러도 같은 비교를 볼 수 있습니다.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-2">
          {DOJO_CANON_DIFFS.map((entry) => (
            <div key={entry.id} className="pixel-card p-3">
              <div className="flex items-center justify-between gap-2">
                <b className="text-sm text-ink">{entry.subject}</b>
                <CanonDiffInfo entry={entry} compact />
              </div>
              <p className="text-[11px] mt-2"><span className="font-pixel text-[9px] text-maple">메랜</span> {entry.mapleland}</p>
              <p className="text-[11px] text-dim mt-1"><span className="font-pixel text-[9px]">원작</span> {entry.original}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="text-[11px] text-dim leading-relaxed border-t-2 border-edge pt-4">
        <p className="font-pixel text-[10px] text-ink mb-1">출처와 판정 기준</p>
        <p>
          메이플랜드 확정: <a href={OFFICIAL_PATCH} target="_blank" rel="noopener noreferrer" className="underline text-maple">2026년 8월 7일 공식 패치노트</a>.{` `}
          첫날 실측·모집 경향: <a href={MAPLEFEED} target="_blank" rel="noopener noreferrer" className="underline text-maple">메랜피드 공식 Discord 미러</a>,{` `}
          <a href={COMMUNITY_CLEAR} target="_blank" rel="noopener noreferrer" className="underline text-maple">최상층 완주 사례</a>,{` `}
          <a href={COMMUNITY_GUIDE} target="_blank" rel="noopener noreferrer" className="underline text-maple">층·점수 정리글</a>. 원작 대조: {` `}
          <a href={GMS_PATCH} target="_blank" rel="noopener noreferrer" className="underline text-maple">GMS v0.75 보존 공지</a>,{` `}
          <a href={OLD_GUIDE} target="_blank" rel="noopener noreferrer" className="underline text-maple">2009 공략 보존본</a>,{` `}
          <a href={OLD_REWARDS} target="_blank" rel="noopener noreferrer" className="underline text-maple">Hidden Street 보상표</a>.
          커뮤니티 값은 첫날 메타이므로 공식 수정·다수 실측이 나오면 갱신합니다.
        </p>
      </section>
    </div>
  );
}

function QuickCard({ label, value, note, info }: { label: string; value: string; note: string; info?: ReactNode }) {
  return (
    <div className="pixel-panel p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-pixel text-[10px] text-dim">{label}</div>{info}
      </div>
      <div className="font-bold text-lg text-maple mt-1">{value}</div>
      <div className="text-[11px] text-dim">{note}</div>
    </div>
  );
}

function Checklist({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="font-pixel text-xs text-maple mb-2">{title}</h3>
      <ul className="space-y-2">
        {items.map((item) => <li key={item} className="flex gap-2 text-sm"><span className="text-maple shrink-0">✓</span><span>{item}</span></li>)}
      </ul>
    </div>
  );
}

function Tip({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="pixel-card p-3 flex gap-3"><span className="font-pixel text-maple text-sm shrink-0">{number}</span><div><b className="text-sm">{title}</b><p className="text-xs text-dim mt-1 leading-relaxed">{text}</p></div></div>;
}

function SkillCard({ name, effect, use }: { name: string; effect: string; use: string }) {
  return <div className="pixel-card p-3 text-center"><div className="font-bold text-sm text-maple">{name}</div><div className="text-xs mt-1">{effect}</div><div className="text-[11px] text-dim mt-1">{use}</div></div>;
}

function RoleCard({ role, jobs, text }: { role: string; jobs: string; text: string }) {
  return <div className="pixel-card p-3"><div className="font-pixel text-[9px] text-maple">{role}</div><div className="font-bold text-sm mt-1">{jobs}</div><p className="text-[11px] text-dim mt-1.5 leading-relaxed">{text}</p></div>;
}

function ReactionCard({ title, text }: { title: string; text: string }) {
  return <div className="pixel-card p-3"><b className="text-sm text-ink">{title}</b><p className="text-xs text-dim mt-1 leading-relaxed">{text}</p></div>;
}

function Danger({ floor, boss, text }: { floor: string; boss: string; text: string }) {
  return <div className="pixel-card p-3"><div className="font-pixel text-[10px] text-red-500">{floor}</div><div className="font-bold text-sm mt-0.5">{boss}</div><p className="text-[11px] text-dim mt-1.5 leading-relaxed">{text}</p></div>;
}
