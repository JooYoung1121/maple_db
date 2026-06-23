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
  {
    label: "KMSDB v1.2.70 (발록 출시 패치노트)",
    href: "http://www.kmsdb.pe.kr/2011/11/v1270.html",
  },
  {
    label: "커뮤니티 마왕발록 데이터 분석 (디시 메이플랜드갤)",
    href: "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=3664182",
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
  {
    name: "마왕 발록 (원정대)",
    subtitle: "KMS 1.2.70(2009)에서 원정대 시스템과 함께 추가된 보스",
    status: "7/16 본섭 추가 예정 (개발일지 로드맵)",
    dataWarning:
      "사이트 DB와 커뮤니티 WZ 분석이 일치하는 수치: 머리 Lv.105 HP 428만, 양손 Lv.56~60 HP 264만/306만. 그 외 변형 데이터(HP 998만, 206만~750만대)는 난이도/리뉴얼 변형으로 추정됩니다. 마왕발록(9101003) 단일 레코드는 스펙 미수집 상태이며, 메랜 2.0 적용 버전·수치는 7/16 출시 후 실측 확인이 필요합니다.",
    parts: [
      ["머리 (본체)", "4,280,000 HP", "Lv.105 · 명중 44 (WZ·커뮤니티 분석 일치)"],
      ["양손", "2,640,000 / 3,060,000 HP", "Lv.60 / Lv.56"],
      ["변형 데이터", "9,980,000 등", "난이도/리뉴얼 변형 추정 — 메랜 적용 여부 미확인"],
      ["입장 위치", "저주받은 신전 지하 — 발록의 무덤", "신전의 밑바닥에서 NPC 무영"],
    ],
    patterns: [
      "입장 후 약 3분간 봉인 해제 연출로 체력이 줄지 않습니다 — 단 일정 데미지를 누적하지 못하면 추방된다는 제보가 있어 꾸준히 공격해야 합니다.",
      "전투 중 발록의 양손을 함께 타격할 수 있는 광역기가 효율적이며, 진행에 따라 팔이 사슬로 봉인되고 이후 머리를 집중 공격하는 구조입니다.",
      "1/1 공격(HP·MP를 1로), 약 1분 주기의 공격반사(피격 시 큰 피해), 언데드화 디버프(물약 효과 절반·힐 피격)가 핵심 위험 요소입니다. 힐 사용 직업은 언데드화 타이밍에 특히 주의해야 합니다.",
      "옛 KMS 기준 입장 횟수 제한(일 7회), 처치 경험치 약 52만, 전투 중 3·4차 스킬 봉인 및 무기 공격력 일정화 규칙이 커뮤니티 분석에 정리돼 있습니다 — 메랜 2.0 원정대 규칙으로 확정된 것은 아니므로 출시 후 확인이 필요합니다.",
    ],
    drops: {
      db: "WZ 기준 사이트 DB에 발록 신발 2종(가죽 Lv.58/털가죽 Lv.68, 둘 다 올스탯+2)과 신발용 발록 주문서 12종 데이터 보유",
      note:
        "획득 경로 ① 처치 후 보상맵 오브젝트 파괴: '발록의~' 접두 80·90제 무기(업그레이드 9회), 베인 무기 시리즈, 혼돈의 주문서(60%), 백의 주문서(1%), 발록 신발 확률 획득 ② 발록의 가죽조각을 '지하로 내려가는 길' NPC 수상한 남자에게 신발·주문서로 교환(비율 미확인). 발록 주문서: 스탯+2/HP·MP+30/이속+3/점프+5/명중·회피+5/방어+10 계열 30% 11종 + 석양의 발록 주문서 5%(올스탯+4·물마방+14·명중회피+4·이속점프+4·HP/MP+40). 메랜 2.0 적용 여부·드롭률은 미확정입니다.",
    },
    strategy:
      "연계 퀘스트(레벨 50+): 만지와 발록(선행: 만지의 낡은 글라디우스) → 버려진 쪽지(알 수 없는 종이조각) → 악마를 쫓는 방법(크리슈라마) → 트리스탄의 후계자(트리스탄의 영혼, 보상: 트리스탄 후계자의 훈장). 페리온의 만지가 메소를 받고 입장맵으로 보내주는 경로도 알려져 있습니다. 7/16 원정대 시스템과 동시 출시 예정이므로, 원정대 인원·레벨 제한과 실제 드롭을 실측해 채우는 것이 우선입니다.",
  },
];

function Badge({ children }: { children: string }) {
  return (
    <span className="pixel-badge inline-flex font-pixel bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] px-2.5 py-1 text-xs text-maple">
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
        <h1 className="text-2xl font-bold text-ink md:text-3xl font-pixel">
          테스피아 엔드 보스 공략 메모
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-dim">
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
            className="pixel-panel p-5"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-ink font-pixel">{boss.name}</h2>
                  <Badge>{boss.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-dim">{boss.subtitle}</p>
              </div>
            </div>

            <div className="mt-4 bg-surface2 border-2 border-edge p-3 text-sm text-ink">
              {boss.dataWarning}
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
              <section>
                <h3 className="mb-2 text-sm font-bold text-ink font-pixel">체력/파츠</h3>
                <div className="overflow-hidden border-2 border-edge">
                  {boss.parts.map(([part, hp, note]) => (
                    <div
                      key={part}
                      className="grid grid-cols-[1fr_1.2fr] gap-3 border-b border-edge/40 px-3 py-2 text-sm last:border-b-0"
                    >
                      <span className="font-medium text-ink">{part}</span>
                      <span className="text-dim">
                        {hp}
                        <span className="block text-xs text-dim">{note}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-bold text-ink font-pixel">드롭테이블</h3>
                <div className="border-2 border-edge p-3 text-sm leading-6">
                  <p className="font-medium text-ink">{boss.drops.db}</p>
                  <p className="mt-2 text-dim">{boss.drops.note}</p>
                </div>
              </section>
            </div>

            <section className="mt-5">
              <h3 className="mb-2 text-sm font-bold text-ink font-pixel">패턴/기믹</h3>
              <ul className="grid gap-2 text-sm leading-6 text-ink md:grid-cols-2">
                {boss.patterns.map((pattern) => (
                  <li key={pattern} className="bg-surface2 border-2 border-edge px-3 py-2">
                    {pattern}
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-5 border-2 border-edge p-3 text-sm leading-6 text-ink">
              <h3 className="mb-1 font-bold text-ink font-pixel">공략 정리 방향</h3>
              <p>{boss.strategy}</p>
            </section>
          </article>
        ))}
      </section>

      <section className="pixel-panel p-5">
        <h2 className="text-lg font-bold text-ink font-pixel">참고한 자료</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {sourceLinks.map((source) => (
            <a
              key={source.href}
              href={source.href}
              target="_blank"
              rel="noreferrer"
              className="border-2 border-edge px-3 py-2 text-sm text-ink transition-colors hover:border-maple hover:text-maple"
            >
              {source.label}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
