export type EvidenceLevel = "official" | "verified" | "original" | "candidate";

export interface BattleMageSkill {
  branch: "시티즌" | "1차" | "2차" | "3차" | "4차";
  name: string;
  masterLevel: number;
  summary: string;
  priority?: string;
}

export interface MasteryBookEvidence {
  name: string;
  tier: "20" | "30" | "20/30";
  evidence: EvidenceLevel;
  drops: { name: string; mobId?: number }[];
  note: string;
  source: string;
}

export interface LegacyQuest {
  group: "레지스탕스" | "에델슈타인";
  name: string;
  npc: string;
  level: number;
  condition: string;
}

export const BATTLE_MAGE_SOURCES = {
  mapleland: "https://maple.land/board/notices/nbudy1h3t2wjeqrx8i94yupm",
  maplelandPreload: "https://maple.land/board/notices/u59poew390cw27yfl21j5fdf",
  kms105: "https://archive.maplestory.nexon.com/News/Update/147?p=12",
  kmstSkills: "https://maplestory.pe.kr/1873",
  kmstLeveling: "https://maplestory.pe.kr/1875",
  community: "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=3933442",
} as const;

export const BATTLE_MAGE_SKILLS: BattleMageSkill[] = [
  { branch: "시티즌", name: "크리스탈 스로우", masterLevel: 3, summary: "루를 던지는 원거리 공격. 마스터 시 MP 7, 데미지 40." },
  { branch: "시티즌", name: "잠입", masterLevel: 3, summary: "위기 회피용 은신. 마스터 시 30초 은신·이동속도 +15, 재사용 1분." },
  { branch: "시티즌", name: "이피션시", masterLevel: 3, summary: "물약 회복 효율 증가. 마스터 시 회복량 130%." },
  { branch: "1차", name: "트리플 블로우", masterLevel: 20, summary: "근접한 최대 6마리를 3단 공격. 메랜은 1회 입력으로 3타 자동 발동, 마스터 기본공격력 20×3.", priority: "주력기 우선" },
  { branch: "1차", name: "피니쉬 어택", masterLevel: 10, summary: "블로우 뒤에만 이어 쓰는 마무리 공격. 최대 6마리. 메랜 마스터 기본공격력 70 (원작 30에서 상향)." },
  { branch: "1차", name: "텔레포트", masterLevel: 15, summary: "상하좌우 순간이동. 메랜 이동거리 145 (원작 150).", priority: "기동용 1 이상" },
  { branch: "1차", name: "다크 오라", masterLevel: 20, summary: "주변 파티원의 데미지 강화. 마스터 시 +10%. 오라는 한 캐릭터가 하나만 사용.", priority: "트리플 다음" },
  { branch: "2차", name: "쿼드 블로우", masterLevel: 20, summary: "트리플 블로우를 잇는 4단 공격. 메랜은 1회 입력으로 4타 자동 발동, 마스터 기본공격력 28×4.", priority: "전직 직후 1 → 우선 마스터" },
  { branch: "2차", name: "다크 체인", masterLevel: 20, summary: "원거리 적을 끌어오고 기절시키는 몹몰이 기술. 메랜 마스터 기본공격력 80 (원작 70)." },
  { branch: "2차", name: "블루 오라", masterLevel: 20, summary: "파티 피해를 분산·흡수. 메랜 흡수량 Lv.1 49% → Lv.20 30% (레벨업할수록 나빠지던 원작 오류 수정)." },
  { branch: "2차", name: "옐로우 오라", masterLevel: 20, summary: "이동속도와 공격속도 강화. KMST 마스터 시 이동속도 +20·공속 1단.", priority: "사냥 핵심" },
  { branch: "2차", name: "블러드 드레인", masterLevel: 20, summary: "공격 피해 일부를 HP로 회복. 메랜 마스터 지속 120초 (원작 90초)." },
  { branch: "2차", name: "스태프 부스터", masterLevel: 20, summary: "스태프 공격속도 강화. 메랜 마스터 지속 200초 (원작 90초)." },
  { branch: "2차", name: "스태프 마스터리", masterLevel: 20, summary: "스태프 숙련도와 마력 증가. 최종 배치와 마스터 레벨은 1.2.105 공지 기준." },
  { branch: "3차", name: "데스 블로우", masterLevel: 20, summary: "쿼드 블로우를 잇는 5단 주력 공격. 메랜은 1회 입력으로 5타 자동 발동, 마스터 기본공격력 42×5.", priority: "주력기 우선" },
  { branch: "3차", name: "배틀 마스터리", masterLevel: 20, summary: "전투 능력을 강화하는 패시브. 1.2.105 최종 스킬 목록 기준." },
  { branch: "3차", name: "다크 라이트닝", masterLevel: 20, summary: "암흑구 사이에 자기장을 만드는 범위 공격. 메랜 마스터 기본공격력 300 (원작 250), KMST 기준 재사용 10초." },
  { branch: "3차", name: "어드밴스드 다크체인", masterLevel: 20, summary: "다크 체인을 강화하는 상위 몹몰이 기술." },
  { branch: "3차", name: "컨버젼", masterLevel: 10, summary: "일정 시간 최대 HP 증가. 메랜은 지속시간이 레벨 비례로 마스터 최대 200초 (원작 60초 고정)." },
  { branch: "3차", name: "어드밴스드 블루 오라", masterLevel: 20, summary: "블루 오라 흡수율과 방어력 강화. 메랜 흡수량 Lv.1 29% → Lv.20 20% (원작 오류 수정)." },
  { branch: "3차", name: "슈퍼 바디", masterLevel: 20, summary: "사용 중인 오라를 순간 강화. 재사용 2분. 메랜은 다크 오라 중 추가 데미지 상승이 마스터 20% (원작 40%).", priority: "파티·보스 핵심" },
  { branch: "3차", name: "리바이브", masterLevel: 20, summary: "몬스터 처치 시 확률적으로 리퍼 소환. 메랜 마스터 지속 200초·리퍼 최대 5마리 (원작 90초·무제한, 리퍼 공격력은 상향)." },
  { branch: "3차", name: "텔레포트 마스터리", masterLevel: 20, summary: "텔레포트에 공격 기능을 더하는 패시브." },
  { branch: "4차", name: "피니쉬 블로우", masterLevel: 30, summary: "데스 블로우를 잇는 6단 주력 공격. 메랜은 1회 입력으로 6타 자동 발동, 마스터 기본공격력 60×6.", priority: "주력기 우선" },
  { branch: "4차", name: "어드밴스드 다크 오라", masterLevel: 30, summary: "파티 데미지 최대 +20%와 주변 지속 공격." },
  { branch: "4차", name: "어드밴스드 옐로우 오라", masterLevel: 30, summary: "이속 +40과 주변 몬스터 이동속도 감소. 메랜 공속 추가 증가는 1단 (원작 2단)." },
  { branch: "4차", name: "싸이클론", masterLevel: 30, summary: "10초간 회오리로 변해 이동 공격. 메랜 마스터 기본공격력 850·재사용 2분 (원작 770·1분)." },
  { branch: "4차", name: "다크 제네시스", masterLevel: 30, summary: "최대 15마리 광역 공격. KMST 마스터 공격력 970, 재사용 1분 (9/7 조정 없음).", priority: "광역 사냥 핵심" },
  { branch: "4차", name: "스탠스", masterLevel: 30, summary: "넉백 저항. 메랜 마스터 300초간 95% (원작 90%)." },
  { branch: "4차", name: "쉘터", masterLevel: 20, summary: "방어막 안 파티원이 피해를 받지 않음. 메랜 재사용 10분 (원작 7분)." },
  { branch: "4차", name: "메이플 용사", masterLevel: 30, summary: "일정 시간 파티원의 모든 스탯을 증가시키는 공용 4차 스킬." },
  { branch: "4차", name: "용사의 의지", masterLevel: 5, summary: "특정 상태 이상을 해제하는 공용 4차 스킬." },
  { branch: "4차", name: "에너자이즈", masterLevel: 10, summary: "배틀메이지의 전투 능력을 강화하는 4차 패시브." },
];

export interface BalanceChange {
  branch: "1차" | "2차" | "3차" | "4차" | "해적";
  skill: string;
  before: string;
  after: string;
}

// 9/7 패치노트(당일 수정본)의 밸런스 조정 전문 — 마스터 기준.
export const BALANCE_CHANGES_0907: BalanceChange[] = [
  { branch: "1차", skill: "트리플 블로우", before: "연타 방식·내부 공식", after: "1회 입력 시 기본공격력 20으로 3회 자동 공격" },
  { branch: "1차", skill: "피니쉬 어택", before: "기본공격력 30", after: "기본공격력 70" },
  { branch: "1차", skill: "텔레포트", before: "이동거리 150", after: "이동거리 145" },
  { branch: "2차", skill: "쿼드 블로우", before: "4번째 추가 1타 240", after: "1회 입력 시 기본공격력 28으로 4회 자동 공격" },
  { branch: "2차", skill: "다크 체인", before: "기본공격력 70", after: "기본공격력 80" },
  { branch: "2차", skill: "블루 오라", before: "흡수 Lv.1 11% → Lv.20 30%", after: "흡수 Lv.1 49% → Lv.20 30% (오류 수정)" },
  { branch: "2차", skill: "블러드 드레인", before: "지속 90초", after: "지속 120초" },
  { branch: "2차", skill: "스태프 부스터", before: "지속 90초", after: "지속 200초" },
  { branch: "3차", skill: "데스 블로우", before: "5번째 추가 1타 480", after: "1회 입력 시 기본공격력 42으로 5회 자동 공격" },
  { branch: "3차", skill: "어드밴스드 블루 오라", before: "흡수 Lv.1 31% → Lv.20 50%", after: "흡수 Lv.1 29% → Lv.20 20% (오류 수정)" },
  { branch: "3차", skill: "다크 라이트닝", before: "기본공격력 250", after: "기본공격력 300" },
  { branch: "3차", skill: "컨버전", before: "지속 60초 고정", after: "레벨 비례 최대 200초" },
  { branch: "3차", skill: "슈퍼바디", before: "다크 오라 데미지 +40%", after: "다크 오라 데미지 +20%" },
  { branch: "3차", skill: "리바이브", before: "지속 90초·리퍼 무제한", after: "지속 200초·리퍼 공격력 상향·최대 5마리" },
  { branch: "4차", skill: "피니쉬 블로우", before: "6번째 추가 1타 690", after: "1회 입력 시 기본공격력 60으로 6회 자동 공격" },
  { branch: "4차", skill: "어드밴스드 옐로우 오라", before: "공속 추가 +2", after: "공속 추가 +1" },
  { branch: "4차", skill: "싸이클론", before: "기본공격력 770·재사용 1분", after: "기본공격력 850·재사용 2분" },
  { branch: "4차", skill: "스탠스", before: "발동 확률 90%", after: "발동 확률 95%" },
  { branch: "4차", skill: "쉘터", before: "재사용 7분", after: "재사용 10분" },
  { branch: "해적", skill: "에너지 차지 (버커니어)", before: "공격력 보너스 조건부 중첩", after: "무조건 중첩" },
  { branch: "해적", skill: "배틀쉽 (캡틴)", before: "이동속도 80", after: "이동속도 110" },
];

export const REQUIRED_MASTERY_BOOKS = [
  "피니쉬 블로우 20·30",
  "어드밴스드 다크 오라 20·30",
  "어드밴스드 옐로우 오라 20·30",
  "싸이클론 20·30",
  "다크 제네시스 20·30",
  "스탠스 20·30",
  "쉘터 20",
  "메이플 용사 20·30",
] as const;

export const MASTERY_BOOK_EVIDENCE: MasteryBookEvidence[] = [
  {
    name: "어드밴스드 다크 오라",
    tier: "20",
    evidence: "verified",
    drops: [{ name: "라이카", mobId: 8220006 }, { name: "파풀라투스", mobId: 8500002 }],
    note: "몬스터북 스크린샷으로 확인 (라이카 9/4, 파풀라투스 9/7). 성공률 70%, 스킬 Lv.5 이상 조건. 9/7 실물 드롭 인증도 있음.",
    source: "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=3942941",
  },
  {
    name: "어드밴스드 옐로우 오라",
    tier: "30",
    evidence: "verified",
    drops: [{ name: "망각의 수호대장", mobId: 8200012 }],
    note: "9/4 몬스터북 스크린샷에서 확인. 성공률 50%, 스킬 Lv.15 이상 조건. 어드 옐로우 20도 망각의 수호대장 드롭 제보가 있으나 스크린샷 미확인.",
    source: "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=3933442",
  },
  {
    name: "다크 제네시스",
    tier: "30",
    evidence: "verified",
    drops: [{ name: "망각의 수호병", mobId: 8200011 }],
    note: "9/7 몬스터북 스크린샷에서 확인. 성공률 50%, 스킬 Lv.15 이상 조건.",
    source: "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=3942941",
  },
  {
    name: "싸이클론",
    tier: "30",
    evidence: "verified",
    drops: [{ name: "후회의 수호대장", mobId: 8200008 }],
    note: "9/7 몬스터북 스크린샷에서 확인. 성공률 50%, 스킬 Lv.15 이상 조건. 싸이클론 20은 뉴트주니어 드롭 제보(스크린샷 미확인).",
    source: "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=3942951",
  },
  {
    name: "쉘터",
    tier: "20",
    evidence: "verified",
    drops: [{ name: "망각의 사제", mobId: 8200009 }],
    note: "9/7 몬스터북 스크린샷에서 확인. 쉘터의 최종 마스터 레벨은 20이라 필요 마북은 이 한 권.",
    source: "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=3943054",
  },
  {
    name: "스탠스",
    tier: "20/30",
    evidence: "official",
    drops: [
      { name: "다크 코니언", mobId: 8150201 },
      { name: "파풀라투스", mobId: 8500002 },
      { name: "레비아탄", mobId: 8220003 },
      { name: "후회의 수호병", mobId: 8200007 },
      { name: "후회의 수호대장", mobId: 8200008 },
      { name: "애프터로드", mobId: 8120102 },
      { name: "자쿰", mobId: 8800002 },
    ],
    note: "전사와 마북 공유 (9/4 공식 툴팁 변경 + 9/7 실측 재확인, 배메 마스터 시 95%). 드롭처는 사이트 DB의 기존 스탠스 마북 기준.",
    source: BATTLE_MAGE_SOURCES.maplelandPreload,
  },
  {
    name: "피니쉬 블로우 20/30 · 다크 제네시스 20 · 어드 다크 오라 30 · 싸이클론 20 · 어드 옐로우 오라 20",
    tier: "20/30",
    evidence: "candidate",
    drops: [{ name: "메랜 드롭처 미확인" }],
    note: "9/8 기준 커뮤니티에서도 드롭처가 확인되지 않은 마북들. 특히 피니쉬 블로우는 '드롭을 모르겠다'는 글만 존재. 유튜브 등의 빅뱅 이후 KMS 드롭표(광석 이터→피니쉬 블로우 등)는 메랜에 적용되지 않는 것이 광석 이터 몬스터북 실측으로 확인됨 — 광석 이터 전리품에 배메 마북 없음.",
    source: "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=3943972",
  },
  {
    name: "메이플 용사",
    tier: "20/30",
    evidence: "candidate",
    drops: [{ name: "혼테일", mobId: 8810018 }, { name: "핑크빈", mobId: 8820014 }],
    note: "현재 사이트 DB의 기존 공용 메이플 용사 20·30 드롭표. 배틀메이지에게 동일 아이템이 적용되는지는 메랜 툴팁·몬스터북 최종 확인 필요.",
    source: "/items/2290096",
  },
];

// 9/7 출시 후 커뮤니티 실측 메모 — 출처는 디시 메이플랜드 갤러리 글번호
export const BATTLE_MAGE_FIELD_NOTES: { title: string; body: string; source: string }[] = [
  {
    title: "에델슈타인 가는 법",
    body: "엘리니아 좌측 꼭대기의 선착장에서 이동. 빅뱅 이후 지형(여섯갈래길)은 없다.",
    source: "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=3945794",
  },
  {
    title: "4차 전직 비용",
    body: "레지스탕스 4차 전직 시 1,000만 메소 납부 필요 (복수 유저 교차 확인). 원작(빅뱅 직후 KMS)의 500만에서 상향된 것으로 보임.",
    source: "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=3944597",
  },
  {
    title: "에델슈타인 일반 퀘스트",
    body: "총 71개, 완주 약 4~5시간 실측. 시간제한 퀘스트 2개(오후 6시/밤 10시에만 등장하는 NPC), 블랙윙 본거지 진입용 모자 2개 필요(개당 10만 메소), 로봇 칩 20개류 퀘템은 드롭률이 매우 낮다는 평.",
    source: "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=3944707",
  },
  {
    title: "몹 실측 스탯 반영",
    body: "라키~광석 이터 구간의 경험치는 버닝 월드 관측값을 ×2/3으로 본섭 환산했습니다. 본섭 직접 측정값은 아닙니다. 광석 이터는 몬스터북 기준 HP 57,000·MP 250, 라키 HP 약 15,000은 글쓴이 추정치입니다. 그 외 HP는 GMS 참고값입니다.",
    source: "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=3943694",
  },
  {
    title: "광석 이터 위치·평가",
    body: "연결 글은 광산 최심부(겔리메르 연구소 방면)의 젠과 솔로·1:1 쩔 효율을 평가합니다. 정확한 메랜 맵명·ID 매칭은 확인 대기입니다. 해당 몬스터북에서 배메 마북이 보이지 않았다는 관측만으로 모든 마북의 드롭 부재를 확정하지 않습니다.",
    source: "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=3944293",
  },
  {
    title: "오라 활용 · 커뮤니티 의견 1건",
    body: "연결 글에는 쩔·파티사냥에서 오라 활용이 제한적이고 보스 파티에서는 가치가 높다는 개인 평가가 있습니다. 검증 과정이 제시된 실측 자료는 아닙니다. 파티 적용 범위·중첩 규칙과 사냥 효율은 별도 검증이 필요합니다.",
    source: "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=3943616",
  },
  {
    title: "9/11 오라 자동 전이 중단 — '오라캐' 차단",
    body: "9/11 패치로 오라류에 자동 전이 중단 로직이 추가됐습니다(공식 패치노트). 저레벨 배메 부캐를 사냥터에 세워두고 다크 오라(파티 데미지 +10~20%)만 받는 '오라캐' 운용이 차단 대상 — 커뮤니티 실측으로는 시전자가 일정 시간 조작·전투 없이 방치되면 파티원 전이가 끊깁니다. 직접 플레이하는 배메의 오라는 영향이 없고, 재적용 세부 규칙은 실측 진행 중입니다.",
    source: "https://maple.land/board/notices/uc6cu3mlb78f1zyavaceeq64",
  },
];

const LEGACY_QUESTS_RAW = `
레지스탕스|선생님 알려주세요!|페르디|0|레벨 제한 없음
레지스탕스|유치원 교사의 부탁|일렉스|0|레벨 제한 없음
레지스탕스|경찰관의 부탁|벨|0|레벨 제한 없음
레지스탕스|의사의 부탁|지그문트|0|레벨 제한 없음
레지스탕스|미화원의 부탁|헨리테|0|레벨 제한 없음
레지스탕스|곰돌이 알바생의 부탁|체키|0|레벨 제한 없음
레지스탕스|의문의 초대장|페르디|10|Lv.10 이상
레지스탕스|배틀 메이지의 길|헨리테|10|Lv.10 이상
레지스탕스|와일드 헌터의 길|벨|10|Lv.10 이상
레지스탕스|재규어 길들이기|벨|10|Lv.10 이상·와일드헌터
레지스탕스|방과 후 특별수업|페르디|30|Lv.30 이상
레지스탕스|복수와 성장|각 직업 전직관|30|Lv.30 이상
레지스탕스|특별수업 현장학습|페르디|70|Lv.70 이상
레지스탕스|에너지 전송 장치 파괴|각 직업 전직관|70|Lv.70 이상
레지스탕스|특별수업 비상소집|페르디|120|Lv.120 이상
레지스탕스|실종된 전직교관을 찾아라|지그문트|120|Lv.120 이상
레지스탕스|위험한 실험실|겔리메르|120|Lv.120 이상
레지스탕스|나를 넘어서는 너|각 직업 전직관|120|Lv.120 이상
레지스탕스|특별수업 종료|페르디|200|Lv.200 이상
레지스탕스|레지스탕스의 교육생|각 직업 전직관|10|Lv.10 이상
레지스탕스|순발력 강화 프로그램|일렉스|11|Lv.11 이상
레지스탕스|공격력 강화 프로그램|일렉스|12|Lv.12 이상
레지스탕스|인내심 강화 프로그램|일렉스|13|Lv.13 이상
레지스탕스|종합 강화 프로그램|일렉스|14|Lv.14 이상
레지스탕스|첫 번째 임무|각 직업 전직관|14|Lv.14 이상
레지스탕스|순찰로봇 퇴치|지그문트|14|Lv.14 이상
레지스탕스|경고 전달|지그문트|14|Lv.14 이상
레지스탕스|수아르의 부탁|수아르|15|Lv.15 이상
레지스탕스|변신과 변장은 레지스탕스의 기본|지그문트|15|Lv.15 이상
레지스탕스|깨어난 실험체|지그문트|16|Lv.16 이상
레지스탕스|실험체의 회복|지그문트|16|Lv.16 이상
레지스탕스|실험체의 부탁1|지그문트|18|Lv.18 이상
레지스탕스|실험체의 부탁2|벨비티|18|Lv.18 이상
레지스탕스|실험체의 부탁3|벨비티|18|Lv.18 이상
레지스탕스|두 번째 임무|지그문트|20|Lv.20 이상
레지스탕스|물 도둑 잡기|수아르|20|Lv.20 이상
레지스탕스|물 거래|수아르|23|Lv.23 이상
레지스탕스|블랙윙의 행태|수아르|23|Lv.23 이상
레지스탕스|실험체를 위한 선물|웬델린|26|Lv.26 이상
레지스탕스|실험체의 약|벨비티|26|Lv.26 이상
레지스탕스|실험체의 약 전달|지그문트|26|Lv.26 이상
레지스탕스|세 번째 임무|지그문트|29|Lv.29 이상
레지스탕스|수아르 보호하기|수아르|29|Lv.29 이상
에델슈타인|사랑을 고백하는 방법1|일렉스|14|Lv.14 이상
에델슈타인|감시자 바반의 부탁|바반|15|Lv.15 이상
에델슈타인|감시자 레오나르의 부탁|레오나르|15|Lv.15 이상
에델슈타인|감시자 와니의 부탁|레오나르|15|Lv.15 이상
에델슈타인|이상한 이정표 퇴치|벨|17|Lv.17 이상
에델슈타인|재활용은 중요해|헨리테|18|Lv.18 이상
에델슈타인|사랑을 고백하는 방법2|일렉스|18|Lv.18 이상
에델슈타인|인형옷 안에 든 것은?1|울리카|19|Lv.19 이상
에델슈타인|인형옷 안에 든 것은?2|울리카|19|Lv.19 이상
에델슈타인|인형옷 안에 든 것은?3|체키|19|Lv.19 이상
에델슈타인|떠나야 할까요?|에밀리|21|Lv.21 이상
에델슈타인|신선한 공기가 필요해|체키|22|Lv.22 이상
에델슈타인|산소 호흡기 만들기|지그문트|22|Lv.22 이상
에델슈타인|문제는 다른 곳에 있다|지그문트|22|Lv.22 이상
에델슈타인|사랑을 고백하는 방법3|일렉스|22|Lv.22 이상
에델슈타인|레드독의 실수|레드독|22|Lv.22 이상
에델슈타인|사랑 혹은...|레오나르|22|Lv.22 이상
에델슈타인|언니의 생일파티1|울리카|23|Lv.23 이상
에델슈타인|언니의 생일파티2|울리카|23|Lv.23 이상
에델슈타인|가출소녀 찾기|지그문트|24|Lv.24 이상
에델슈타인|그녀가 바쁜 이유|지그문트|24|Lv.24 이상
에델슈타인|언니를 위한 선물|울리카|25|Lv.25 이상
에델슈타인|잃어버린 물건을 찾아주세요|웬델린|16|Lv.16 이상
에델슈타인|알베르트의 딸|알베르트|27|Lv.27 이상
에델슈타인|그들이 전해줄지도 몰라|알베르트|27|Lv.27 이상
에델슈타인|와니의 고뇌|와니|27|Lv.27 이상
에델슈타인|임무일 뿐이야|와니|28|Lv.28 이상
에델슈타인|진심은 어디에|헨리테|28|Lv.28 이상
에델슈타인|블랙윙의 비밀포탈|라이언 헤드|28|Lv.28 이상
에델슈타인|내가 의회장이야|안소니|29|Lv.29 이상
에델슈타인|중요한 건 돈이야|스테판|31|Lv.31 이상
에델슈타인|동생을 찾아주세요|준|33|Lv.33 이상
에델슈타인|돌입 준비|반|33|Lv.33 이상
에델슈타인|은밀한 제의|스테판|60|Lv.60 이상
에델슈타인|위장복 구입|스테판|60|Lv.60 이상
에델슈타인|아버지는 잘 계신가요?|가브리엘|60|Lv.60 이상
에델슈타인|또 다른 방법|반|61|Lv.61 이상
에델슈타인|탈출 시도||0|원문 레벨·NPC 미기재
에델슈타인|전 탈출할 수 없어요||0|원문 레벨·NPC 미기재
에델슈타인|방범 장치 점검||0|원문 레벨·NPC 미기재
에델슈타인|프란시스님의 방청소를 도와주세요||0|원문 레벨·NPC 미기재
에델슈타인|모든 것은 임무를 위해||0|원문 레벨·NPC 미기재
에델슈타인|다고쓰님의 음료수를 구해주세요||0|원문 레벨·NPC 미기재
에델슈타인|바로크님의 책상 재료를 구해주세요||0|원문 레벨·NPC 미기재
에델슈타인|그 녀석들 거슬려|수아르|70|Lv.70 이상
에델슈타인|불쾌한 기계 인형|콴|72|Lv.72 이상
에델슈타인|나는 감정없는 인형|젝트|73|Lv.73 이상
에델슈타인|무사도 배가 고프다|창|74|Lv.74 이상
에델슈타인|누나는 괜찮은지 봐줘|젝트|75|Lv.75 이상
에델슈타인|실험에 필요한 것1|겔리메르|76|Lv.76 이상
에델슈타인|가브리엘의 부탁|가브리엘|79|Lv.79 이상
에델슈타인|엘레오노르님의 애완동물을 잡아 주세요|르티에|80|Lv.80 이상
에델슈타인|도둑이 든 것 같아|스벤|81|Lv.81 이상
에델슈타인|실험에 필요한 것2|겔리메르|82|Lv.82 이상
에델슈타인|이래도 괜찮은 걸까?|알렌|87|Lv.87 이상
에델슈타인|탈출 계획|알렌|87|Lv.87 이상
에델슈타인|흔적 지우기|알렌|87|Lv.87 이상
에델슈타인|실험에 필요한 것3|겔리메르|88|Lv.88 이상
에델슈타인|젝트의 마음|젝트|88|Lv.88 이상
에델슈타인|뮈스카데의 배려|뮈스카데|88|Lv.88 이상
에델슈타인|고장난 방어 시스템 격퇴|돌체토|90|Lv.90 이상
에델슈타인|실패작은 없애버려1|겔리메르|96|Lv.96 이상
에델슈타인|실패작은 없애버려2|돌체토|96|Lv.96 이상
에델슈타인|세포 샘플이 필요해|겔리메르|101|Lv.101 이상
에델슈타인|경계의 마을|페르디|25|Lv.25 이상·시그너스
에델슈타인|울리카의 말|울리카|25|Lv.25 이상·시그너스
에델슈타인|준의 말|준|25|Lv.25 이상·시그너스
에델슈타인|에델슈타인을 도와줄 수 있나요?||0|원문 레벨·NPC 미기재
에델슈타인|배신자 시그너스||0|원문 레벨·NPC 미기재
에델슈타인|의심의마을|페르디|25|Lv.25 이상·모험가/에반/아란
에델슈타인|그들의 정체||0|원문 레벨·NPC 미기재
에델슈타인|리린의 반응||35|Lv.35 이상·아란
에델슈타인|미르의 반응||67|Lv.67 이상·에반
에델슈타인|분노의 대상은 어디에||70|Lv.70 이상·에반
`;

export const LEGACY_EDELSTEIN_QUESTS: LegacyQuest[] = LEGACY_QUESTS_RAW.trim()
  .split("\n")
  .map((line) => {
    const [group, name, npc, level, condition] = line.split("|");
    return {
      group: group as LegacyQuest["group"],
      name,
      npc,
      level: Number(level),
      condition,
    };
  });

export const LIVE_QUEST_SCREENSHOT_NAMES = new Set([
  "의심의마을",
  "중요한 건 돈이야",
  "돌입 준비",
  "블랙윙의 비밀포탈",
  "방범 장치 점검",
  "프란시스님의 방청소를 도와주세요",
  "모든 것은 임무를 위해",
  "불쾌한 기계 인형",
  "나는 감정없는 인형",
  "무사도 배가 고프다",
  "실험에 필요한 것1",
  "도둑이 든 것 같아",
]);

export const BATTLE_MAGE_LEVELING = [
  { level: "1~10", route: "에델슈타인 시티즌 필수 스토리", play: "눈앞의 NPC 퀘스트를 모두 진행해야 1차 전직 가능. 화분류 몬스터를 자연스럽게 사냥." },
  { level: "10~14", route: "지하 트레이닝 룸 A~D", play: "강화 프로그램 퀘스트와 훈련로봇을 병행. 트리플 블로우와 텔레포트에 적응." },
  { level: "14~30", route: "산책로 → 뱀 나오는 길 → 광산 가는 길", play: "직업 임무와 지역 퀘스트 중심. 다크 오라를 유지하고 일자형 지형에서 몰이." },
  { level: "30~40", route: "광산 입구·바위길·광석길", play: "쿼드 블로우와 다크 체인으로 모아잡기. 에델 퀘스트가 끊기면 공용 사냥터 합류." },
  { level: "40~67", route: "기존 메랜 공용 루트", play: "개미굴·골렘·커닝 지하철·파티퀘스트 등 레벨과 장비에 맞는 밀집 사냥터 선택." },
  { level: "67~80", route: "발전소·갱도·너구리 소굴", play: "경비로봇부터 경비로봇L까지 순차 진행. 갱도4 경비로봇L 솔플이 무난하다는 실측(9/7). 3차 직후엔 망각의 길 계열도 경험치 효율이 좋다는 후기." },
  { level: "83~105", route: "제2광장·안드로이드/방어 시스템 연구소", play: "라칸(Lv.83)부터 광석 이터(Lv.101)까지. 원작 스탯 기반 추천이므로 메랜 젠·효율은 실측으로 보정 중." },
  { level: "105+", route: "기존 고레벨 공용 루트", play: "4차 전까지 기존 메랜 고효율 사냥터 이용. 4차 이후 피니쉬 블로우·다크 제네시스 중심." },
] as const;
