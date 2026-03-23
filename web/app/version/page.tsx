"use client";

const VERSION = "1.1.1";

const SEMVER_EXPLANATION = [
  { label: "패치 (1.0.X)", desc: "버그 수정", color: "bg-gray-100 text-gray-700" },
  { label: "마이너 (1.X.0)", desc: "새로운 기능 추가", color: "bg-blue-50 text-blue-700" },
  { label: "메이저 (X.0.0)", desc: "대규모 변경", color: "bg-orange-50 text-orange-700" },
];

const CHANGELOG: {
  version: string;
  date: string;
  type: "major" | "minor" | "patch";
  title: string;
  features: { category: string; items: string[] }[];
}[] = [
  {
    version: "1.1.1",
    date: "2026-03-23",
    type: "patch",
    title: "법사 데미지 공식 수정 및 몬스터 데이터 보정",
    features: [
      {
        category: "버그 수정",
        items: [
          "법사 MIN 데미지 공식: (INT+LUK×0.5) → (INT×숙련도(60%)+LUK) 로 수정 — 숙련도 개념 올바르게 반영",
          "스켈로스 방어 데이터 수정: 물방 950→810, 마방 950→710 (메이플랜드 실제값)",
        ],
      },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-03-23",
    type: "minor",
    title: "커뮤니티 기능 추가 및 엔방컷 계산기 개선",
    features: [
      {
        category: "커뮤니티 — 투표",
        items: [
          "투표 생성/참여/삭제 기능 (질문 + 선택지 2~6개)",
          "득표율 바 차트 시각화",
          "IP 기반 중복 투표 방지",
        ],
      },
      {
        category: "커뮤니티 — 룰렛",
        items: [
          "참가자 이름 추가/삭제, 당첨 수 설정",
          "공평 모드: 모든 참가자 동일 확률",
          "불공평 모드: 클릭마다 무작위 가중치 재배분",
          "SVG 파이 차트 시각화 + 10초 회전 애니메이션",
        ],
      },
      {
        category: "사냥터 추천 탭 개선",
        items: [
          "사냥터 탭 자체 캐릭터 레벨/평균 데미지 입력 가능",
          "계산기 탭 값으로 불러오기 버튼 추가",
        ],
      },
      {
        category: "스킬 데이터 수정",
        items: [
          "아이스스트라이크 맥스 레벨 30 확인",
        ],
      },
    ],
  },
  {
    version: "1.0.5",
    date: "2026-03-23",
    type: "patch",
    title: "엔방컷 계산기 개선 및 스킬 데이터 정확도 향상",
    features: [
      {
        category: "버그 수정",
        items: [
          "숫자 입력 필드에서 백스페이스로 한 자리 수 삭제 안 되는 문제 수정",
        ],
      },
      {
        category: "스킬 데이터 수정 (메이플랜드 기준)",
        items: [
          "비숍 제네시스: 670% → 650%, 타격 마리수 15 → 10",
          "썬콜 체인 라이트닝: 300% → 210% (Lv.30 기준)",
          "썬콜 아이스 스트라이크: 210% → 90% (Lv.20 기준)",
        ],
      },
      {
        category: "엔방컷 계산기 — 레벨 기준 스탯 자동 계산",
        items: [
          "캐릭터 레벨 변경 시 주 스탯 자동 계산 (레벨 × 5)",
          "직업 변경 시 주/부 스탯 자동 초기화",
          "직업별 기본 부스탯 설정 (전사 DEX 25, 마법사 LUK 20 등)",
          "자동 계산 ON/OFF 토글 지원",
        ],
      },
      {
        category: "엔방컷 계산기 — 패시브 스킬 추가",
        items: [
          "보우마스터 크리티컬샷 패시브 추가 (크리티컬 확률 +40%)",
          "신궁 크리티컬샷 패시브 추가 (크리티컬 확률 +40%)",
        ],
      },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-03-22",
    type: "major",
    title: "최초 릴리즈",
    features: [
      {
        category: "데이터베이스",
        items: [
          "아이템 데이터베이스 — 장비, 소비, 기타 아이템 전체 수록",
          "몬스터 데이터베이스 — 스탯, 드롭 정보 포함",
          "맵 데이터베이스 — 필드/던전/지역 분류",
          "NPC 데이터베이스 — 상점 및 퀘스트 NPC",
          "퀘스트 데이터베이스 — 선행/보상 조건 포함",
          "스킬 데이터베이스 — 직업별 스킬 목록",
        ],
      },
      {
        category: "경험치 계산기",
        items: [
          "한타임 사냥 경험치 계산",
          "목표 레벨 달성 시간 계산",
          "경험치표 조회",
        ],
      },
      {
        category: "주문서 시뮬레이션",
        items: [
          "성공 확률 계산",
          "주문서 시뮬레이터",
          "강화 후 스탯 비교표",
        ],
      },
      {
        category: "수수료 계산기",
        items: [
          "공대 분배 수수료 계산 (노수작 / 수수작)",
          "거래 방식별 수수료 (직접 거래 / 일반 / 택배)",
          "최적 분할 단위 자동 계산",
          "공제 항목 다중 추가 지원",
        ],
      },
      {
        category: "비매박제 게시판",
        items: [
          "비매너 유저 신고 게시판",
          "직업 세분화 (히어로, 팔라딘, 썬콜 등)",
          "아이템 분류 필터",
        ],
      },
      {
        category: "보스 정보",
        items: ["보스 몬스터 스탯 및 드롭 정보"],
      },
      {
        category: "파티퀘스트 가이드",
        items: ["파티퀘스트 진행 방법 및 보상 안내"],
      },
      {
        category: "검색",
        items: ["FTS5 기반 통합 전문 검색"],
      },
    ],
  },
];

const TYPE_BADGE: Record<"major" | "minor" | "patch", string> = {
  major: "bg-orange-100 text-orange-700 border border-orange-200",
  minor: "bg-blue-50 text-blue-700 border border-blue-200",
  patch: "bg-gray-100 text-gray-600 border border-gray-200",
};

const TYPE_LABEL: Record<"major" | "minor" | "patch", string> = {
  major: "메이저",
  minor: "마이너",
  patch: "패치",
};

export default function VersionPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <span className="inline-block bg-orange-500 text-white text-2xl font-bold px-6 py-2 rounded-full tracking-wide">
          v{VERSION}
        </span>
        <h1 className="text-3xl font-bold text-gray-900">버전 정보 / 변경 이력</h1>
        <p className="text-gray-500 text-sm">추억길드 전용 메랜 정보 사이트</p>
      </div>

      {/* Semver explanation */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
        <h2 className="text-base font-semibold text-gray-700">시맨틱 버전 안내</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          {SEMVER_EXPLANATION.map((s) => (
            <div key={s.label} className={`flex-1 rounded-lg px-4 py-3 ${s.color}`}>
              <p className="font-semibold text-sm">{s.label}</p>
              <p className="text-xs mt-0.5 opacity-80">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Changelog timeline */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-800">변경 이력</h2>

        {CHANGELOG.map((entry) => (
          <div key={entry.version} className="flex gap-4">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-orange-500 mt-1.5 shrink-0" />
              <div className="w-px flex-1 bg-gray-200 mt-1" />
            </div>

            {/* Card */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 flex-1 space-y-4">
              {/* Version header */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold text-gray-900">v{entry.version}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_BADGE[entry.type]}`}>
                  {TYPE_LABEL[entry.type]}
                </span>
                <span className="text-xs text-gray-400 ml-auto">{entry.date}</span>
              </div>
              <p className="text-sm font-medium text-orange-600">{entry.title}</p>

              {/* Feature categories */}
              <div className="space-y-4">
                {entry.features.map((cat) => (
                  <div key={cat.category}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      {cat.category}
                    </p>
                    <ul className="space-y-1">
                      {cat.items.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-orange-400 mt-0.5 shrink-0">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
