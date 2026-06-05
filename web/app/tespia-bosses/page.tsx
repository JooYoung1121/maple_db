const sourceLinks = [
  {
    label: "테스피아 Ver. Test 2.2.62 공지",
    href: "https://tespia.maple.land/board/notices/w5zcuwl1isqmwxqgzeaz346z",
  },
  {
    label: "StrategyWiki Zakum",
    href: "https://strategywiki.org/wiki/MapleStory/Zakum",
  },
  {
    label: "StrategyWiki Horntail",
    href: "https://strategywiki.org/wiki/MapleStory/Horntail",
  },
  {
    label: "StrategyWiki Pink Bean",
    href: "https://strategywiki.org/wiki/MapleStory/Pink_Bean",
  },
];

const bosses = [
  {
    name: "카오스 자쿰",
    subtitle: "Lv.140 기준 데이터 보유, 드롭테이블 미확정",
    status: "테스피아 등장 확인",
    dataWarning:
      "사이트 DB의 본체 HP는 528M / 704M / 880M이지만, v62 WZ 원본은 748M / 904M / 1.28B로 더 높습니다. 테스피아 실측 또는 최신 메랜 패치 기준 재확인이 필요합니다.",
    parts: [
      ["본체 1", "528,000,000 HP", "WZ: 748,000,000"],
      ["본체 2", "704,000,000 HP", "WZ: 904,000,000"],
      ["본체 3", "880,000,000 HP", "WZ: 1,280,000,000"],
      ["팔 1~8", "176,000,000 ~ 264,000,000 HP", "팔별 HP 차이 있음"],
    ],
    patterns: [
      "WZ 기준 본체는 무기/마법 공격 무효화 계열 스킬과 소환 스킬을 보유합니다.",
      "외부 공략 기준 팔 구간은 플랫폼 장판, 팔 내려찍기, 소환몹, 무기/마법 캔슬 대응이 핵심입니다.",
      "팔을 모두 제거한 뒤에는 전맵 폭발 또는 즉사급 패턴을 회복 타이밍과 안전 구역으로 처리해야 합니다.",
      "테스피아에서는 수치와 패턴 주기가 조정될 수 있어 팔 재생 여부, 폭발 피해량, 캔슬 주기 실측이 우선입니다.",
    ],
    drops: {
      db: "현재 사이트 DB 드롭 0건",
      note:
        "외부 현대 자료에는 카오스 자쿰 투구/분노한 자쿰 장비류가 언급되지만 메랜 테스피아 드롭으로 확정하지 않았습니다.",
    },
    strategy:
      "우선 팔 생존 여부가 패턴 난이도를 크게 바꿀 가능성이 큽니다. 전사는 몸박과 장판, 원거리는 플랫폼 표식, 마법사는 매직 캔슬 시간대를 따로 기록해 두는 방식으로 실측 공략표를 채우는 것이 좋습니다.",
  },
  {
    name: "카오스 혼테일",
    subtitle: "다중 파츠 보스, 사이트 DB에는 파츠 수치 존재",
    status: "테스피아 등장 확인",
    dataWarning:
      "사이트 DB와 v62 WZ 기준 머리 HP는 1.65B / 1.95B 계열입니다. 현대 자료의 3.3B / 3.9B 수치와 다르므로 그대로 수입하면 안 됩니다.",
    parts: [
      ["왼쪽/오른쪽 머리", "각 1,650,000,000 HP", "와이번 소환"],
      ["머리 A/C", "각 1,650,000,000 HP", "전투 본편"],
      ["머리 B", "1,950,000,000 HP", "중앙 머리"],
      ["양손", "각 1,150,000,000 HP", "상태이상 주의"],
      ["날개/다리/꼬리", "1,350,000,000 / 650,000,000 / 450,000,000 HP", "처치 순서 영향 큼"],
    ],
    patterns: [
      "외부 공략 기준 왼쪽 머리는 얼음 계열 전맵 공격, 오른쪽 머리는 번개 계열 전맵 공격을 사용합니다.",
      "중앙 머리는 불 계열 공격과 소환, 손 파츠는 유혹과 MP 드레인 계열 패턴이 핵심 위험 요소로 정리됩니다.",
      "날개는 본체 회복과 코니언 소환, 다리와 꼬리는 지진/기절/독 안개형 패턴이 언급됩니다.",
      "실전 순서는 꼬리와 다리를 먼저 정리해 접촉 피해와 지진 리스크를 줄이는 공략이 자주 쓰입니다.",
    ],
    drops: {
      db: "현재 사이트 DB 드롭 0건",
      note:
        "외부 자료에는 카오스 혼테일 목걸이, 실버 블라썸 링, 데아 시두스 이어링 등이 언급되지만 메랜 테스피아 확정 드롭은 아닙니다.",
    },
    strategy:
      "파츠별 HP와 상태이상 기록이 중요합니다. 특히 유혹 담당 파츠, 와이번 소환 주기, 날개 회복량을 분리해서 기록하면 공략 페이지의 가치가 커집니다.",
  },
  {
    name: "핑크빈",
    subtitle: "일반 핑크빈 기준 데이터 보유, 카오스 핑크빈 아님",
    status: "테스피아 등장 확인",
    dataWarning:
      "테스피아 공지는 보스 <핑크빈>으로 표기되어 있고, 사이트 DB도 Lv.180 일반 핑크빈 2.1B 체력 기준입니다. 카오스 핑크빈 자료와 섞지 않아야 합니다.",
    parts: [
      ["핑크빈 본체", "2,100,000,000 HP", "Lv.180"],
      ["아리엘", "600,000,000 HP", "석상"],
      ["솔로몬/렉스", "각 300,000,000 HP", "석상"],
      ["휘긴/무닌", "각 450,000,000 HP", "석상"],
      ["페이즈 더미", "300M / 600M / 1.05B / 1.5B / 2.1B", "진행 연출용 데이터"],
    ],
    patterns: [
      "석상 페이즈에서는 반사, 봉인, 스턴, 약화, 유혹, 맵 추방, 디스펠, 좀비화 계열 패턴이 주요 위험 요소로 정리됩니다.",
      "아리엘은 회복/디스펠/좀비화와 광역 마법 패턴이 특히 중요합니다.",
      "본체는 1/1 계열 공격, 음표 낙하, 넉백, 미니빈 소환, 데미지 반사, 좀비화, 키 반전 패턴이 언급됩니다.",
      "석상은 한 점사 순서가 중요하며, 반사와 디스펠을 쓰는 석상을 먼저 정리하는 공략이 유효합니다.",
    ],
    drops: {
      db: "현재 사이트 DB 드롭 13건: 타임리스 이어링, 순록의 우유, 황혼의 이슬, 엘릭서, 파워엘릭서, 시간 조각, 시간의 돌",
      note:
        "외부 현대 자료의 블랙빈 마크, 핑크빛 성배 등은 메랜 테스피아 드롭으로 검증 전입니다.",
    },
    strategy:
      "우선 일반 핑크빈 기준으로 정리하고, 테스피아에서 실제 드롭/난이도 제보가 쌓이면 카오스 핑크빈과 별도 엔트리로 나누는 편이 안전합니다.",
  },
];

function Badge({ children }: { children: string }) {
  return (
    <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
      {children}
    </span>
  );
}

export default function TespiaBossesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>테스피아 2.0</Badge>
          <Badge>Ver. Test 2.2.62</Badge>
          <Badge>드롭/밸런스 변동 가능</Badge>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 md:text-3xl">
          테스피아 엔드 보스 공략 메모
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-300">
          카오스 자쿰, 카오스 혼테일, 핑크빈은 테스피아 공지에서 진행 가능 보스로 확인됐습니다.
          이 페이지는 현재 사이트 DB와 v62 WZ 대조 결과를 기준으로 정리한 초안이며, 실제 메랜 테스피아의 드롭과 밸런스는 추후 변경될 수 있습니다.
        </p>
      </section>

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
        <p className="font-semibold">데이터 확인 상태</p>
        <p className="mt-1">
          카오스 자쿰과 카오스 혼테일은 사이트 DB에 몬스터/파츠 수치는 있으나 드롭테이블이 비어 있습니다.
          핑크빈은 일부 드롭이 있으나, 현대 메이플 자료와 동일하다고 볼 근거는 아직 부족합니다.
        </p>
      </section>

      <section className="grid gap-5">
        {bosses.map((boss) => (
          <article
            key={boss.name}
            className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{boss.name}</h2>
                  <Badge>{boss.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{boss.subtitle}</p>
              </div>
            </div>

            <div className="mt-4 rounded-md bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-900/50 dark:text-gray-300">
              {boss.dataWarning}
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
              <section>
                <h3 className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-100">체력/파츠</h3>
                <div className="overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
                  {boss.parts.map(([part, hp, note]) => (
                    <div
                      key={part}
                      className="grid grid-cols-[1fr_1.2fr] gap-3 border-b border-gray-200 px-3 py-2 text-sm last:border-b-0 dark:border-gray-700"
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-200">{part}</span>
                      <span className="text-gray-600 dark:text-gray-300">
                        {hp}
                        <span className="block text-xs text-gray-400">{note}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-100">드롭테이블</h3>
                <div className="rounded-md border border-gray-200 p-3 text-sm leading-6 dark:border-gray-700">
                  <p className="font-medium text-gray-800 dark:text-gray-200">{boss.drops.db}</p>
                  <p className="mt-2 text-gray-600 dark:text-gray-300">{boss.drops.note}</p>
                </div>
              </section>
            </div>

            <section className="mt-5">
              <h3 className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-100">패턴/기믹</h3>
              <ul className="grid gap-2 text-sm leading-6 text-gray-700 dark:text-gray-300 md:grid-cols-2">
                {boss.patterns.map((pattern) => (
                  <li key={pattern} className="rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-900/50">
                    {pattern}
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-5 rounded-md border border-gray-200 p-3 text-sm leading-6 text-gray-700 dark:border-gray-700 dark:text-gray-300">
              <h3 className="mb-1 font-bold text-gray-900 dark:text-gray-100">공략 정리 방향</h3>
              <p>{boss.strategy}</p>
            </section>
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">참고한 자료</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {sourceLinks.map((source) => (
            <a
              key={source.href}
              href={source.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 transition-colors hover:border-orange-300 hover:text-orange-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-orange-700 dark:hover:text-orange-300"
            >
              {source.label}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
