import type { CanonDiffEntry, CanonDiffStatus, CanonEntityType } from "@/lib/canonDiffs";

const MAPLELAND_DB = "https://mapledb.kr";
const MAPLESTORY_IO = "https://maplestory.io/api/gms/92";
const OFFICIAL_SKILL_PATCH = "https://maple.land/board/notices/k2u06u7rr9x8vdzw7x1vse84";

type MobSpec = {
  id: number;
  name: string;
  live: string;
  late: string;
  early?: string;
  status: CanonDiffStatus;
  evidence?: { label: string; url: string }[];
};

const MOB_SPECS: MobSpec[] = [
  { id: 130100, name: "스텀프", live: "Lv.4 · HP 45", late: "v62·v83·GMS92 모두 Lv.4 · HP 40", status: "changed", evidence: [{ label: "메랜쩔 실측 DB", url: "https://maplelandzzul.gg/monsters/%EC%8A%A4%ED%85%80%ED%94%84" }] },
  { id: 9400000, name: "까마귀", live: "Lv.25 · HP 400", late: "v62·v83·GMS92 모두 Lv.25 · HP 550", status: "changed", evidence: [{ label: "메랜쩔 실측 DB", url: "https://maplelandzzul.gg/monsters/%EA%B9%8C%EB%A7%88%EA%B7%80" }] },
  { id: 9400001, name: "불너구리", live: "Lv.30 · HP 1,200", late: "v62·v83·GMS92 모두 Lv.30 · HP 900", status: "changed", evidence: [{ label: "메랜쩔 실측 DB", url: "https://maplelandzzul.gg/monsters/%EB%B6%88%EB%84%88%EA%B5%AC%EB%A6%AC" }] },
  { id: 2130100, name: "다크 엑스텀프", live: "Lv.10 · HP 550", early: "초기 원작(v62): Lv.10 · HP 550", late: "후기 빅뱅 전(v83·GMS92): Lv.22 · HP 550", status: "version" },
  { id: 9300172, name: "중독된 트리로드", live: "Lv.62 · HP 10,500", early: "초기 원작(v62): Lv.62 · HP 10,500", late: "후기 빅뱅 전(v83·GMS92): Lv.62 · HP 6,100", status: "version" },
  { id: 9300173, name: "중독된 스톤버그", live: "Lv.65 · HP 12,500", early: "초기 원작(v62): Lv.65 · HP 12,500", late: "후기 빅뱅 전(v83·GMS92): Lv.65 · HP 7,200", status: "version" },
  { id: 9300174, name: "포이즌 플라워", live: "Lv.65 · HP 13,000", early: "초기 원작(v62): Lv.65 · HP 13,000", late: "후기 빅뱅 전(v83·GMS92): Lv.65 · HP 6,500", status: "version" },
  { id: 9300175, name: "중독된 스프라이트", live: "Lv.55 · HP 8,500", early: "초기 원작(v62): Lv.55 · HP 8,500", late: "후기 빅뱅 전(v83·GMS92): Lv.65 · HP 7,500", status: "version" },
  { id: 9300176, name: "멀쩡한 스프라이트", live: "Lv.65 · HP 720,000", early: "초기 원작(v62): Lv.65 · HP 720,000", late: "후기 빅뱅 전(v83·GMS92): Lv.65 · HP 21,000", status: "version" },
  { id: 9300177, name: "더 중독된 트리로드", live: "Lv.75 · HP 930,000", early: "초기 원작(v62): Lv.75 · HP 930,000", late: "후기 빅뱅 전(v83·GMS92): Lv.62 · HP 3,500", status: "version" },
  { id: 9300178, name: "더 중독된 스톤버그", live: "Lv.85 · HP 1,350,000", early: "초기 원작(v62): Lv.85 · HP 1,350,000", late: "후기 빅뱅 전(v83·GMS92): Lv.65 · HP 6,700", status: "version" },
  { id: 9300179, name: "더 중독된 스프라이트", live: "Lv.65 · HP 3,000", early: "초기 원작(v62): Lv.65 · HP 3,000", late: "후기 빅뱅 전(v83·GMS92): Lv.65 · HP 7,500", status: "version" },
  { id: 9300181, name: "강화형 포이즌 골렘", live: "Lv.65 · HP 12,500", early: "초기 원작(v62): Lv.65 · HP 12,500", late: "후기 빅뱅 전(v83·GMS92): Lv.75 · HP 83,000", status: "version" },
  { id: 9300182, name: "초강화형 포이즌 골렘", live: "Lv.62 · HP 10,500", early: "초기 원작(v62): Lv.62 · HP 10,500", late: "후기 빅뱅 전(v83·GMS92): Lv.85 · HP 113,500", status: "version" },
];

const MOB_DIFFS: CanonDiffEntry[] = MOB_SPECS.map((spec) => ({
  id: `mob.${spec.id}.level-hp`,
  path: `/mobs/${spec.id}`,
  subject: `${spec.name} 레벨·HP`,
  status: spec.status,
  mapleland: spec.live,
  original: spec.early ? `${spec.early} / ${spec.late}` : spec.late,
  note: spec.status === "version"
    ? "메이플랜드는 초기 원작값과 일치합니다. 사이트의 후기 GMS92/v83 기반값을 메이플랜드 현재값으로 교정했습니다."
    : "서로 다른 원작 스냅샷과 모두 달라 메이플랜드 변경으로 분류했습니다.",
  sourceLabel: "메이플랜드 현행 DB",
  sourceUrl: `${MAPLELAND_DB}/search.php?q=${spec.id}&t=mob`,
  originalSourceLabel: "GMS v92 원본 데이터",
  originalSourceUrl: `${MAPLESTORY_IO}/mob/${spec.id}`,
  verifiedAt: "2026-08-07",
  entityType: "mob",
  entityId: spec.id,
  entityNames: [spec.name],
  evidence: spec.evidence,
}));

const ITEM_DIFFS: CanonDiffEntry[] = [
  { id: 1002517, name: "메이플 2000일 두건", live: "착용 레벨 제한 없음", original: "초기 원작(v62)은 제한 없음, 후기 v83·GMS92는 레벨 30", status: "version" as const },
  { id: 1032031, name: "타임리스 이어링", live: "착용 레벨 100", original: "초기 원작(v62)은 레벨 100, 후기 v83·GMS92는 레벨 120", status: "version" as const },
  { id: 2331000, name: "블레이즈 캡슐", live: "착용 레벨 제한 없음", original: "v62·v83·GMS92 원작은 레벨 70", status: "changed" as const },
  { id: 2332000, name: "글레이스 캡슐", live: "착용 레벨 제한 없음", original: "v62·v83·GMS92 원작은 레벨 70", status: "changed" as const },
  { id: 1372002, name: "메탈 완드", live: "직업 제한 없음(공용)", original: "초기 원작(v62)은 공용, 후기 v83·GMS92는 마법사 전용", status: "version" as const },
].map((spec) => ({
  id: `item.${spec.id}.level`,
  path: `/items/${spec.id}`,
  subject: `${spec.name} 착용 조건`,
  status: spec.status,
  mapleland: spec.live,
  original: spec.original,
  note: `${spec.status === "version" ? "메이플랜드는 초기 원작값과 일치합니다." : "서로 다른 원작 스냅샷과 모두 다릅니다."} 현행 DB와 원본 WZ/API를 대조해 실제 표시값도 교정했습니다.`,
  sourceLabel: "메이플랜드 현행 DB",
  sourceUrl: `${MAPLELAND_DB}/search.php?q=${spec.id}&t=item`,
  originalSourceLabel: "GMS v92 원본 데이터",
  originalSourceUrl: `${MAPLESTORY_IO}/item/${spec.id}`,
  verifiedAt: "2026-08-07",
  entityType: "item" as const,
  entityId: spec.id,
  entityNames: [spec.name],
}));

type SkillSpec = { names: string[]; mapleland: string; original?: string; status?: CanonDiffStatus };

const SKILL_SPECS: SkillSpec[] = [
  { names: ["위협"], mapleland: "다수 공격력 감소, 최종 데미지 최대 +7%, 최대 8초 블라인드가 적용됩니다." },
  { names: ["차지 블로우"], mapleland: "사정거리가 소폭 증가했습니다." },
  { names: ["블로킹"], mapleland: "마스터 발동 확률이 20%입니다." },
  { names: ["스탠스"], mapleland: "마스터 발동 확률이 95%입니다." },
  { names: ["돌진"], mapleland: "마스터 데미지 140%, 가동 범위 135%입니다." },
  { names: ["브랜디쉬"], mapleland: "마스터 데미지가 270%입니다." },
  { names: ["인레이지"], mapleland: "최대 +16 중첩 공격력 파티버프, 쿨타임 480초, 지속 180초이며 콤보 10개를 실제 소모합니다.", original: "원작과 달리 콤보 10개를 실제로 소모합니다.", status: "changed" },
  { names: ["어드밴스드 차지"], mapleland: "습득 시 차지 계열 사정거리가 추가 상승합니다." },
  { names: ["블래스트"], mapleland: "마스터 데미지가 600%입니다." },
  { names: ["생츄어리"], mapleland: "마스터 쿨타임 20초이며, 스펙이 너무 낮으면 데미지를 넣지 못하는 로직이 있습니다." },
  { names: ["비홀더스 버프", "비홀더스 힐링"], mapleland: "비홀더스 힐링에 의한 버프 지급 주기가 10초에서 4초로 줄었습니다." },
  { names: ["썬더볼트", "선더 볼트"], mapleland: "공격 범위가 확장되었습니다." },
  { names: ["엘리먼트 엠플리피케이션"], mapleland: "공격 마법 데미지 150%이며, 해제 공격에 지워지지 않는 온·오프 스킬입니다." },
  { names: ["홀리 심볼"], mapleland: "메이플랜드 자체 제약과 일반 경험치 분배 로직을 유지합니다.", original: "원작과 다른 메이플랜드 경험치 분배·사용 제약이 유지됩니다.", status: "changed" },
  { names: ["파이어 데몬"], mapleland: "마스터 기본 공격력이 150입니다." },
  { names: ["메테오"], mapleland: "소모 MP가 1,000 감소했습니다." },
  { names: ["아이스 데몬"], mapleland: "마스터 기본 공격력이 130입니다." },
  { names: ["블리자드"], mapleland: "소모 MP가 1,000 감소했습니다." },
  { names: ["아마존의 눈"], mapleland: "기존 메이플랜드 월드 보정 수치가 추가 적용됩니다." },
  { names: ["에로우 봄 : 활", "에로우 봄"], mapleland: "마스터 데미지가 150%입니다." },
  { names: ["아이언 에로우 : 석궁", "아이언 에로우"], mapleland: "마스터 데미지가 200%입니다." },
  { names: ["파이어 샷"], mapleland: "마스터 데미지가 150%입니다." },
  { names: ["스트레이프"], mapleland: "일정 확률로 결빙된 적을 즉사시킬 수 있습니다." },
  { names: ["피어싱"], mapleland: "차지 속도가 소폭 빨라졌습니다." },
  { names: ["스나이핑"], mapleland: "재사용 대기시간이 5초입니다." },
  { names: ["킨 아이즈"], mapleland: "기존 메이플랜드 월드 보정 수치가 추가 적용됩니다." },
  { names: ["다크 사이트", "다크사이트"], mapleland: "재사용 대기시간이 없고, 사용 중 물약·상태이상 회복 아이템을 쓸 수 있습니다." },
  { names: ["인듀어"], mapleland: "HP·MP 회복량이 상승했습니다." },
  { names: ["스틸"], mapleland: "그림자가 닿는 범위까지, 마스터 기준 최대 4마리를 공격합니다." },
  { names: ["어썰터"], mapleland: "마스터 데미지가 500%입니다." },
  { names: ["시브즈"], mapleland: "첫 타가 일반 공격 범위를 쓰지 않아 앞뒤로 떨어진 몬스터도 공격할 수 있습니다." },
  { names: ["쇼다운"], mapleland: "최대 6마리를 타격하는 관통형 스킬입니다." },
  { names: ["베놈"], mapleland: "독 지속시간과 성공 확률이 증가했습니다." },
  { names: ["암살"], mapleland: "최대 차징이 12초에서 8초로 압축됐고 다크사이트 없이 즉시 발동할 수 있습니다." },
  { names: ["연막탄"], mapleland: "공격반사 데미지까지 가드합니다.", original: "원작 연막탄은 공격반사 데미지까지 막지 못했습니다.", status: "changed" },
  { names: ["더블 파이어", "더블파이어"], mapleland: "사정거리와 기본 공격력이 향상됐고, 건 스킬은 근접 타격이 발동하지 않습니다." },
  { names: ["오크통"], mapleland: "몬스터가 포커싱을 잃던 원작 버그가 수정됐습니다.", original: "원작에서는 오크통 사용 시 몬스터가 포커싱을 잃는 버그가 있었습니다.", status: "changed" },
  { names: ["더블 어퍼"], mapleland: "마스터 데미지가 310%입니다." },
  { names: ["백스핀 블로우"], mapleland: "마스터 데미지가 260%입니다." },
  { names: ["인비지블샷", "인비지블 샷"], mapleland: "마스터 데미지가 180%입니다." },
  { names: ["백스텝샷"], mapleland: "재사용 가능 시간이 단축됐습니다." },
  { names: ["에너지 차지"], mapleland: "마스터 지속시간 60초, 지속 중 스탠스 발동률 100%입니다." },
  { names: ["에너지 버스터"], mapleland: "공격 범위가 상향됐습니다." },
  { names: ["트리플 파이어"], mapleland: "마스터 데미지가 210%입니다." },
  { names: ["파이어 버너"], mapleland: "마스터 데미지가 190%입니다." },
  { names: ["쿨링 이펙트"], mapleland: "마스터 데미지가 160%입니다." },
  { names: ["피스트"], mapleland: "공격 범위가 확대됐습니다." },
  { names: ["윈드 부스터"], mapleland: "물리 공격뿐 아니라 마법 공격 속도도 올립니다.", original: "원작 윈드 부스터는 마법 공격 속도를 올리지 않았습니다.", status: "changed" },
  { names: ["속성강화"], mapleland: "도트 데미지 증가폭과 결빙 지속시간이 향상됐습니다." },
  { names: ["래피드 파이어"], mapleland: "마스터 데미지가 200%입니다." },
  { names: ["배틀쉽"], mapleland: "내구도 증가, 파괴 후 재사용 대기시간 감소, 스탠스가 적용됩니다." },
];

const normalizeName = (value: string) => value.normalize("NFC").replace(/[\s:·_-]/g, "").toLowerCase();

const SKILL_DIFFS: CanonDiffEntry[] = SKILL_SPECS.map((spec, index) => ({
  id: `skill.2-0.${index + 1}`,
  path: "/skills",
  subject: `${spec.names[0]} 스킬`,
  status: spec.status ?? "version",
  mapleland: spec.mapleland,
  original: spec.original ?? "기존 메이플랜드는 KMS 1.2.35 원작판을 기준으로 했고, 2.0부터 KMS 1.2.89 원작판을 기준으로 재조정했습니다.",
  note: spec.status === "changed"
    ? "공식 패치가 원작과 다른 동작을 직접 명시한 항목입니다."
    : "공식 현재값은 확인됐지만 v1.2.35·v1.2.89의 세부 WZ 수치 대조는 계속 보강합니다.",
  sourceLabel: "메이플랜드 6/19 공식 스킬 패치",
  sourceUrl: OFFICIAL_SKILL_PATCH,
  verifiedAt: "2026-08-07",
  entityType: "skill",
  entityNames: spec.names,
}));

export const ENTITY_CANON_DIFFS: CanonDiffEntry[] = [...MOB_DIFFS, ...ITEM_DIFFS, ...SKILL_DIFFS];

export function getEntityCanonDiffs(type: CanonEntityType, id?: number, name?: string): CanonDiffEntry[] {
  const normalizedName = name ? normalizeName(name) : "";
  return ENTITY_CANON_DIFFS.filter((entry) => {
    if (entry.entityType !== type) return false;
    if (id != null && entry.entityId === id) return true;
    return Boolean(normalizedName && entry.entityNames?.some((candidate) => normalizeName(candidate) === normalizedName));
  });
}

export const DATASET_COMPARISON_COVERAGE = [
  { type: "몬스터", site: 1877, live: 749, fields: "ID·이름·레벨·HP", result: "14종 교정 · 내부/센티널 2종 제외", state: "field" },
  { type: "아이템", site: 14146, live: 3956, fields: "ID·이름·착용 레벨·직업", result: "착용 조건 30종 교정 · 파서 오탐 41건 분리", state: "field" },
  { type: "맵", site: 4771, live: 1082, fields: "ID·이름", result: "ID 일치 1,080 · 현행에만 2 · 명칭 후보 139", state: "identity" },
  { type: "NPC", site: 1598, live: 826, fields: "ID·이름", result: "ID 일치 825 · 현행에만 1 · 명칭 36건 현행값 우선", state: "identity" },
  { type: "퀘스트", site: 425, live: 778, fields: "이름", result: "이름 일치 178 · 현행에만 574 · ID 체계 달라 자동병합 보류", state: "identity" },
  { type: "스킬", site: 265, live: 51, fields: "공식 변경 스킬명·현재 동작", result: "6/19 공식 변경 51개 규칙 연결", state: "official" },
] as const;
