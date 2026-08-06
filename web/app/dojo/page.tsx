import Link from "next/link";

type Floor = {
  floor: number;
  boss: string;
  note?: string;
};

type FloorGroup = {
  label: string;
  range: string;
  time: string;
  points: string;
  floors: Floor[];
};

const OFFICIAL_NOTICE = "https://maple.land/board/notices/gjxe40jy7nuiac4ffq67zbjo";
const OFFICIAL_ROADMAP = "https://maple.land/board/devlog/hmplipknuxvzr4mopzwbf7w1";
const OLD_GUIDE = "https://www.southperry.net/printthread.php?tid=11782";
const GMS_PATCH = "https://maplenewsnetwork.wordpress.com/2009/08/26/gms-version-0-75-updates/";
const OLD_REWARDS = "https://bc.hidden-street.net/mu-lung-dojo-prizes";

const FLOOR_GROUPS: FloorGroup[] = [
  {
    label: "초급",
    range: "1~5층",
    time: "5분",
    points: "보스당 2P",
    floors: [
      { floor: 1, boss: "마노" },
      { floor: 2, boss: "스텀피" },
      { floor: 3, boss: "데우" },
      { floor: 4, boss: "킹슬라임" },
      { floor: 5, boss: "대왕지네", note: "이후 휴식층" },
    ],
  },
  {
    label: "하급",
    range: "6~10층",
    time: "6분",
    points: "보스당 3P",
    floors: [
      { floor: 6, boss: "파우스트" },
      { floor: 7, boss: "킹크랑" },
      { floor: 8, boss: "머쉬맘" },
      { floor: 9, boss: "타이머" },
      { floor: 10, boss: "알리샤르", note: "봉인·암흑 주의 · 이후 휴식층" },
    ],
  },
  {
    label: "중급 I",
    range: "11~15층",
    time: "7분",
    points: "보스당 4P",
    floors: [
      { floor: 11, boss: "다일" },
      { floor: 12, boss: "파파픽시" },
      { floor: 13, boss: "좀비머쉬맘" },
      { floor: 14, boss: "제노" },
      { floor: 15, boss: "데비존", note: "이후 휴식층" },
    ],
  },
  {
    label: "중급 II",
    range: "16~20층",
    time: "8분",
    points: "보스당 5P",
    floors: [
      { floor: 16, boss: "구미호" },
      { floor: 17, boss: "태륜" },
      { floor: 18, boss: "포이즌 골렘" },
      { floor: 19, boss: "묘선" },
      { floor: 20, boss: "주니어 발록", note: "이후 휴식층" },
    ],
  },
  {
    label: "상급 I",
    range: "21~25층",
    time: "9분",
    points: "보스당 6P",
    floors: [
      { floor: 21, boss: "엘리쟈" },
      { floor: 22, boss: "프랑켄로이드" },
      { floor: 23, boss: "키메라" },
      { floor: 24, boss: "포장마차" },
      { floor: 25, boss: "스노우맨", note: "이후 휴식층" },
    ],
  },
  {
    label: "상급 II",
    range: "26~30층",
    time: "10분",
    points: "보스당 7P",
    floors: [
      { floor: 26, boss: "블루 머쉬맘" },
      { floor: 27, boss: "크림슨 발록", note: "소환몹 정리 후 포탈" },
      { floor: 28, boss: "마뇽" },
      { floor: 29, boss: "그리프" },
      { floor: 30, boss: "레비아탄", note: "이후 휴식층" },
    ],
  },
  {
    label: "최종",
    range: "31~32층",
    time: "15분",
    points: "31층 8P · 무공 0P(원작)",
    floors: [
      { floor: 31, boss: "파풀라투스", note: "본체 2페이즈까지 시간 관리" },
      { floor: 32, boss: "무공", note: "유혹·좀비·물리/마법 반사" },
    ],
  },
];

const BELTS = [
  { name: "흰 띠", level: 25, points: 200, stat: "올스탯 +1", defense: "물/마방 +10", avoid: 3 },
  { name: "노란 띠", level: 35, points: 1800, stat: "올스탯 +2", defense: "물/마방 +20", avoid: 6 },
  { name: "파란 띠", level: 45, points: 4000, stat: "올스탯 +3", defense: "물/마방 +30", avoid: 9 },
  { name: "빨간 띠", level: 60, points: 9200, stat: "올스탯 +4", defense: "물/마방 +40", avoid: 12 },
  { name: "검은 띠", level: 75, points: 17000, stat: "올스탯 +5", defense: "물/마방 +50", avoid: 15 },
];

const VERIFY_ITEMS = [
  "실제 입장 레벨·일일 횟수·솔로/파티 인원 조건",
  "파티원 레벨 차 제한과 체크포인트 저장 방식",
  "소비 아이템·펫 자동물약·입장 전 버프 적용 여부",
  "구간 제한 시간·보스 HP·스킬·속성의 원작 대비 변경",
  "층별 포인트와 띠 교환 비용·스탯·업그레이드 슬롯",
  "수행자 훈장 32종·정복자 훈장의 실제 지급 조건과 기간",
];

export default function DojoPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <header>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h1 className="font-pixel text-2xl font-bold">🥋 무릉도장 공략</h1>
          <span className="font-pixel text-[10px] px-2 py-1 border border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300">
            8/7 패치 세부 확인 중
          </span>
        </div>
        <p className="text-sm text-dim">
          오늘 메이플랜드 업데이트 현황과 2009년 빅뱅 전 원작의 32라운드 진행 방식·준비·보상을 분리해 정리했습니다.
        </p>
      </header>

      <section className="pixel-panel p-4 border-amber-400 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-pixel text-sm text-ink">📢 오늘 공식 확정 내용</h2>
            <p className="text-sm mt-2"><b>2026년 8월 7일 07:00~12:00</b> 점검 중 신규 콘텐츠로 무릉도장이 업데이트될 예정입니다.</p>
          </div>
          <a href={OFFICIAL_NOTICE} target="_blank" rel="noopener noreferrer" className="pixel-btn px-3 py-2 text-xs shrink-0">공식 점검 공지 ↗</a>
        </div>
        <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 px-3 py-2">
          아직 공식 패치노트에 입장 조건·포인트·보상이 공개되지 않았습니다. 아래 수치는 <b>2009년 빅뱅 전 원작 참고값</b>이며, 메이플랜드 실측이 확인되는 대로 교체합니다.
        </div>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <QuickCard label="원작 입장" value="Lv.25+" note="솔로 또는 3인 이상 파티" />
        <QuickCard label="원작 구성" value="32라운드" note="5층마다 휴식·저장" />
        <QuickCard label="소비 아이템" value="사용 불가" note="드롭 즉시회복 아이템 이용" />
        <QuickCard label="원작 최종 보상" value="검은 띠" note="누적 17,000P" />
      </section>

      <section className="pixel-panel p-5 space-y-4">
        <div>
          <h2 className="font-pixel text-base text-ink">🎒 시작 전 준비 체크</h2>
          <p className="text-xs text-dim mt-1">메이플랜드 세부 규칙이 확인되기 전까지는 원작에서 실제로 중요했던 항목 위주입니다.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Checklist title="장비·세팅" items={[
            "무기·방어구 수리 개념은 없지만, 공격 장비와 스킬 키 배치는 입장 전에 끝내기",
            "표창·불릿 직업은 충분히 충전하고 소환돌·마법의 돌 사용 가능 여부 확인",
            "원작은 인벤토리 소비 아이템을 사용할 수 없어 물약을 대량 구매해 가는 콘텐츠가 아니었음",
            "펫 자동물약·도핑·입장 전 버프 유지 여부는 메랜에서 첫 입장 후 확인",
          ]} />
          <Checklist title="파티·생존" items={[
            "원작 파티 모드는 3인 이상, 공략 자료상 파티원 레벨 차 30 이내",
            "프리스트가 있으면 중반 생존이 편하지만 32층 무공의 좀비화 중 힐은 오히려 위험",
            "27층 크림슨 발록 이후 소환몹에 죽으면 포탈을 못 타 포인트를 놓칠 수 있음",
            "사망 시 경험치 감소는 없었지만, 메랜에서도 동일한지는 첫날 확인 필요",
          ]} />
        </div>
      </section>

      <section className="pixel-panel p-5 space-y-4">
        <div>
          <h2 className="font-pixel text-base text-ink">🧭 원작 진행 방식과 핵심 꿀팁</h2>
          <p className="text-xs text-dim mt-1">보스를 잡는 것보다 포탈·구간 타이머·회복 드롭 관리에서 기록이 갈립니다.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Tip number="1" title="처치 후 반드시 우측 포탈" text="원작 포인트는 보스를 쓰러뜨린 순간이 아니라 다음 층 포탈을 통과할 때 지급됐습니다. 막판 소환몹과 상태이상을 정리하고 이동하세요." />
          <Tip number="2" title="5층 단위로 시간 배분" text="제한 시간은 한 보스가 아니라 해당 5개 층 전체에 적용됩니다. 초반 보스에서 시간을 쓰면 구간 마지막 보스가 급해집니다." />
          <Tip number="3" title="휴식층에서 체크포인트 저장" text="5·10·15·20·25·30층 뒤 휴식층은 시간 제한이 없습니다. HP·MP를 정비하고 소공에게 진행 상황을 저장하면 다음 도전 시작점을 당길 수 있었습니다." />
          <Tip number="4" title="회복 드롭은 파티 전체 적용" text="쫄몹이 떨구는 도장 전용 엘릭서·파워엘릭서·만병통치약은 획득 즉시 적용되고 파티원 전체가 효과를 받았습니다. 급하지 않으면 타이밍을 맞추세요." />
        </div>

        <div className="border-t-2 border-edge pt-4">
          <h3 className="font-pixel text-sm text-ink mb-2">에너지 게이지 필살기</h3>
          <p className="text-xs text-dim mb-3">피격 시 차오르고 한동안 맞지 않으면 감소합니다. 가득 찼을 때 원작 전용 기술 중 하나를 사용했습니다.</p>
          <div className="grid sm:grid-cols-3 gap-2">
            <SkillCard name="메테오" effect="보스 최대 HP 30% 감소" use="고HP 후반 보스에 우선" />
            <SkillCard name="신체강화" effect="30초 무적" use="유혹·반사·위험 패턴 넘기기" />
            <SkillCard name="광폭화" effect="30초 공격력 100% 증가" use="구간 타이머가 빠듯할 때" />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-pixel text-base text-ink">🏯 빅뱅 전 원작 32라운드</h2>
          <p className="text-xs text-dim mt-1">시간은 각 구간 전체 제한 시간입니다. 포인트와 보스 구성 모두 메랜 적용 여부를 확인 중입니다.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {FLOOR_GROUPS.map((group) => (
            <article key={group.range} className="pixel-panel p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="font-pixel text-sm text-ink">{group.label} · {group.range}</h3>
                  <p className="text-[11px] text-dim mt-0.5">구간 제한 {group.time}</p>
                </div>
                <span className="font-pixel text-[10px] text-maple border border-maple px-1.5 py-1">{group.points}</span>
              </div>
              <div className="divide-y divide-edge/50">
                {group.floors.map((floor) => (
                  <div key={floor.floor} className="flex items-baseline gap-2 py-1.5 text-sm">
                    <span className="font-pixel text-[10px] text-dim w-7 shrink-0">{floor.floor}F</span>
                    <b className="shrink-0">{floor.boss}</b>
                    {floor.note && <span className="text-[11px] text-dim ml-auto text-right">{floor.note}</span>}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="pixel-panel p-5 space-y-4">
        <div>
          <h2 className="font-pixel text-base text-ink">⚠️ 후반 위험 구간</h2>
          <p className="text-xs text-dim mt-1">원작 기준으로 첫날 파티에서 미리 콜하면 좋은 지점입니다.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <Danger floor="27F" boss="크림슨 발록" text="소환된 주니어 발록까지 정리하고 포탈 이동. 처치만 하고 쓰러지면 포인트를 못 받을 수 있습니다." />
          <Danger floor="28~30F" boss="마뇽·그리프·레비아탄" text="연속 고HP 보스 구간. 전용 공격력 버프와 회복 드롭을 다음 보스까지 고려해 사용합니다." />
          <Danger floor="31F" boss="파풀라투스" text="본체 2페이즈까지 포함해 32층과 15분을 공유합니다. 필살기와 주력 쿨을 무공용으로 남길지 결정하세요." />
          <Danger floor="32F" boss="무공" text="유혹·약화·좀비화·물리/마법 반사. 좀비화 중 힐과 반사 중 공격 중단 콜이 핵심입니다." />
        </div>
      </section>

      <section className="pixel-panel p-5 space-y-4">
        <div>
          <h2 className="font-pixel text-base text-ink">🎁 원작 누적 포인트 보상 — 무릉 띠</h2>
          <p className="text-xs text-dim mt-1">2009년 원작에서는 교환해도 누적 포인트가 차감되지 않았고 각 띠는 업그레이드 슬롯 3칸이었습니다.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-dim border-b-2 border-edge">
                <th className="py-2 pr-3">보상</th>
                <th className="pr-3">착용 Lv.</th>
                <th className="pr-3">필요 누적 P</th>
                <th className="pr-3">능력치</th>
                <th className="pr-3">방어</th>
                <th>회피</th>
              </tr>
            </thead>
            <tbody>
              {BELTS.map((belt) => (
                <tr key={belt.name} className="border-b border-edge/50">
                  <td className={`py-2 pr-3 font-bold ${belt.name === "검은 띠" ? "text-maple" : ""}`}>{belt.name}</td>
                  <td className="pr-3">{belt.level}</td>
                  <td className="pr-3 font-pixel text-xs">{belt.points.toLocaleString()}P</td>
                  <td className="pr-3">{belt.stat}</td>
                  <td className="pr-3 text-dim">{belt.defense}</td>
                  <td>+{belt.avoid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <div className="pixel-card p-3">
            <b className="text-ink">수행자 훈장</b>
            <p className="text-dim mt-1">원작은 같은 보스를 솔로로 100회 처치하며 앞 단계부터 순서대로 진행하는 32종 훈장이 있었습니다.</p>
            <Link href="/medals" className="inline-block text-maple underline mt-2">훈장 스탯 대표값 보기 →</Link>
          </div>
          <div className="pixel-card p-3">
            <b className="text-ink">무릉도장 정복자</b>
            <p className="text-dim mt-1">원작 GMS 공지는 무공 100회 처치로 최종 훈장을 안내했습니다. 메랜의 횟수·기간제 여부는 확인 전입니다.</p>
          </div>
        </div>
      </section>

      <section className="pixel-panel p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-pixel text-base text-ink">🔎 패치 후 실측 확인 목록</h2>
            <p className="text-xs text-dim mt-1">공식 패치노트 또는 여러 캐릭터의 동일 결과가 확인되면 원작 표시를 메랜 확정값으로 바꿉니다.</p>
          </div>
          <Link href="/channels" className="pixel-card px-3 py-2 font-pixel text-[11px] text-maple">공식 Discord 동선 →</Link>
        </div>
        <ul className="grid sm:grid-cols-2 gap-2">
          {VERIFY_ITEMS.map((item) => (
            <li key={item} className="flex gap-2 text-xs pixel-card p-2.5">
              <span className="text-amber-500">□</span><span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="text-[11px] text-dim leading-relaxed border-t-2 border-edge pt-4">
        <p className="font-pixel text-[10px] text-ink mb-1">출처와 기준</p>
        <p>
          메이플랜드 일정: <a href={OFFICIAL_NOTICE} target="_blank" rel="noopener noreferrer" className="underline text-maple">8/7 공식 점검 안내</a>,{` `}
          <a href={OFFICIAL_ROADMAP} target="_blank" rel="noopener noreferrer" className="underline text-maple">2.0 여름 로드맵</a>. 원작 시스템: {` `}
          <a href={GMS_PATCH} target="_blank" rel="noopener noreferrer" className="underline text-maple">GMS v0.75 업데이트 공지 보존본</a>,{` `}
          <a href={OLD_GUIDE} target="_blank" rel="noopener noreferrer" className="underline text-maple">2009 무릉도장 공략 보존본</a>,{` `}
          <a href={OLD_REWARDS} target="_blank" rel="noopener noreferrer" className="underline text-maple">Hidden Street 원작 보상표</a>.
          서버별·시기별 차이가 있으므로 메이플랜드 공식 수치가 확인되면 그 값을 우선합니다.
        </p>
      </section>
    </div>
  );
}

function QuickCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="pixel-panel p-3">
      <div className="font-pixel text-[10px] text-dim">{label}</div>
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
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm">
            <span className="text-maple shrink-0">✓</span><span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tip({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="pixel-card p-3 flex gap-3">
      <span className="font-pixel text-maple text-sm shrink-0">{number}</span>
      <div><b className="text-sm">{title}</b><p className="text-xs text-dim mt-1 leading-relaxed">{text}</p></div>
    </div>
  );
}

function SkillCard({ name, effect, use }: { name: string; effect: string; use: string }) {
  return (
    <div className="pixel-card p-3 text-center">
      <div className="font-bold text-sm text-maple">{name}</div>
      <div className="text-xs mt-1">{effect}</div>
      <div className="text-[11px] text-dim mt-1">{use}</div>
    </div>
  );
}

function Danger({ floor, boss, text }: { floor: string; boss: string; text: string }) {
  return (
    <div className="pixel-card p-3">
      <div className="font-pixel text-[10px] text-red-500">{floor}</div>
      <div className="font-bold text-sm mt-0.5">{boss}</div>
      <p className="text-[11px] text-dim mt-1.5 leading-relaxed">{text}</p>
    </div>
  );
}
