"use client";

import { useState, useEffect, useCallback } from "react";

// ─── PQ 데이터 ───
interface PQStage {
  name: string;
  desc: string;
}

interface PQData {
  id: string;
  name: string;
  nameEn: string;
  levelMin: number;
  levelMax: number;
  members: number;
  dailyLimit: number;
  timeLimit: string;
  location: string;
  npc: string;
  requiredJobs: string[];
  stages: PQStage[];
  rewards: { exp: string; items: string[] };
  tips: string[];
}

const PQ_LIST: PQData[] = [
  {
    id: "kerning",
    name: "커닝시티 파티퀘스트",
    nameEn: "첫 번째 동행 (Kerning City PQ)",
    levelMin: 21,
    levelMax: 30,
    members: 4,
    dailyLimit: 5,
    timeLimit: "없음",
    location: "커닝시티 하수구",
    npc: "라케시스",
    requiredJobs: [],
    stages: [
      { name: "1단계: 통행증 수집", desc: "리게이터를 잡아 통행증을 수집합니다. 파티장의 질문 답변 수만큼 필요합니다." },
      { name: "2단계: 밧줄(사다리) 퍼즐", desc: "4개의 밧줄 중 3명이 매달려 정답 조합을 찾습니다." },
      { name: "3단계: 발판 퍼즐", desc: "1~5번 발판 중 3명이 올라가 정답 조합을 찾습니다. (일명 '고양이 발판')" },
      { name: "4단계: 드럼통 퍼즐", desc: "1~6번 드럼통 중 3명이 올라가 정답 조합을 찾습니다." },
      { name: "최종: 보스전", desc: "주니어 네키 처치 후 통행증 수집 → 보스 '킹 슬라임' 처치." },
      { name: "보너스", desc: "커닝시티 하수구에서 나가는 길." },
    ],
    rewards: {
      exp: "레벨 대비 약 15~25% 경험치",
      items: ["전신 갑옷 주문서 10%/60%", "각종 원석", "알약"],
    },
    tips: [
      "4명 파티 필수 (3명 이하 입장 불가)",
      "밧줄/발판/드럼통 퍼즐은 3명이 올라가고 리더가 조합 시도",
      "킹 슬라임이 소환하는 슬라임들에 주의",
    ],
  },
  {
    id: "ludi",
    name: "루디브리엄 파티퀘스트",
    nameEn: "차원의 균열 (Ludibrium PQ)",
    levelMin: 35,
    levelMax: 50,
    members: 6,
    dailyLimit: 5,
    timeLimit: "약 60분",
    location: "루디브리엄 101층",
    npc: "표지판",
    requiredJobs: ["도적 (헤이스트)", "마법사 (텔레포트)", "도적 (다크사이트 - 2단계)"],
    stages: [
      { name: "1단계: 통행증 수집", desc: "라츠, 블랙라츠를 잡아 통행증 25장을 수집합니다." },
      { name: "2단계: 트랩 방", desc: "박스를 깨서 통행증 15장 수집. 일부 포탈은 1단계로 강제 워프됩니다." },
      { name: "3단계: 블록퍼스 처치", desc: "블록퍼스를 처치하고 통행증 32장을 수집합니다." },
      { name: "4단계: 어둠의 방", desc: "하단 포탈을 통해 들어가 섀도우아이를 잡고 통행증 6장 수집." },
      { name: "5단계: 미로 방", desc: "박스를 깨고 들어가는 구조. 통행증 24장 수집." },
      { name: "6단계: 숫자 발판 퍼즐", desc: "3개의 발판 조합(1-3-3, 2-2-1 등)을 맞춰 꼭대기로 이동합니다." },
      { name: "7단계: 롬바드 처치", desc: "통행증 3장 수집. 원거리 격수 필수입니다." },
      { name: "8단계: 숫자 발판(1~9)", desc: "5명이 발판에 올라가 정답 조합 찾기. 수학적 계산이 필요합니다." },
      { name: "최종: 보스 알리샤르", desc: "보스 알리샤르를 처치합니다. 어둠/봉인 공격에 주의하세요." },
    ],
    rewards: {
      exp: "레벨 대비 약 40~50% 경험치",
      items: ["전신 갑옷 이동속도 주문서 10%/60%", "전신 갑옷 지력 주문서 10%/60%", "귀 장식 지력 주문서"],
    },
    tips: [
      "6명 풀파티 필수",
      "헤이스트(도적), 텔레포트(마법사), 다크사이트(도적) 필수",
      "2단계 함정 포탈 주의 — 다크사이트로 통과",
      "알리샤르 봉인에 만병통치약 준비",
      "가장 인기 있는 PQ — 35렙부터 경험치 효율 최고",
    ],
  },
  {
    id: "orbis",
    name: "오르비스 파티퀘스트",
    nameEn: "여신의 흔적 (Orbis PQ)",
    levelMin: 51,
    levelMax: 70,
    members: 6,
    dailyLimit: 5,
    timeLimit: "45분",
    location: "알수없는탑 (오르비스 타워 입구 우하단)",
    npc: "알수없는탑 입구",
    requiredJobs: [],
    stages: [
      { name: "중앙홀", desc: "6개 방으로 연결된 중앙홀. 각 방에서 여신상 조각을 모아야 합니다." },
      { name: "휴게실", desc: "요일별로 다른 레코드판을 축음기에 올려 조각을 획득합니다." },
      { name: "봉인된 방", desc: "발판 위에서 업다운(Up/Down) 퍼즐을 수행합니다." },
      { name: "대기실", desc: "셀리온/그류핀/라이오너를 잡고 조각을 획득합니다." },
      { name: "산책로", desc: "네펜데스를 잡고 식량/조각을 획득합니다." },
      { name: "창고", desc: "픽시들을 잡고 조각을 획득합니다." },
      { name: "탑의 감옥", desc: "고스트픽시를 잡고 조각을 획득합니다." },
      { name: "보스: 파파픽시", desc: "여신상을 모두 복구한 뒤 파파픽시를 소환하여 처치합니다." },
    ],
    rewards: {
      exp: "경파: 15,500 EXP / 완파: 80,000~100,000 EXP",
      items: ["여신의 팔찌", "귀 장식 지력 주문서 60%", "장갑 공격력 주문서 60%"],
    },
    tips: [
      "경파 (구름방+라운지만): 2~4분, 15,500 EXP — 반복 효율 좋음",
      "완파: 15~40분, 주문서 드랍 기대",
      "경파/완파 선택은 파티원과 미리 협의",
      "휴게실 레코드판은 요일마다 다르므로 미리 확인",
    ],
  },
  {
    id: "romeo",
    name: "로미오와 줄리엣 PQ",
    nameEn: "마가티아 파퀘 (Romeo & Juliet PQ)",
    levelMin: 70,
    levelMax: 119,
    members: 4,
    dailyLimit: 5,
    timeLimit: "45분",
    location: "마가티아",
    npc: "마가티아 연구소",
    requiredJobs: ["마법사 (텔레포트 권장)", "도적 (헤이스트 권장)"],
    stages: [
      { name: "도서관", desc: "스위치를 찾아 비밀 통로를 개방합니다." },
      { name: "연구소: 액체 수집", desc: "몹을 잡고 액체를 수집하여 비커를 채웁니다." },
      { name: "장치 가동", desc: "발판 퍼즐 및 몬스터를 처치합니다." },
      { name: "특수 임무", desc: "유타의 보고서 등을 찾아 '해피 엔딩' 조건을 충족시킵니다. (보상이 달라짐)" },
      { name: "보스: 프랑켄로이드", desc: "화난 프랑켄/일반 프랑켄을 처치합니다." },
    ],
    rewards: {
      exp: "레벨 대비 약 20~30% 경험치",
      items: ["호루스 눈 (목걸이)", "알카드노 구슬", "제뉴미스트 구슬", "구슬 → 연금술사 반지 교환"],
    },
    tips: [
      "해피엔딩: 유타의 보고서 등 특수 아이템을 모두 찾으면 보상 최대",
      "배드엔딩도 기본 보상은 획득 가능",
      "구슬 모아서 연금술사 반지로 교환하는 것이 핵심",
      "텔레포트, 헤이스트가 있으면 진행이 훨씬 빠름",
    ],
  },
];

// ─── 보상 비교 데이터 ───
const REWARD_COMPARE = [
  { id: "kerning", expPerRun: "15~25%", expPerHour: "약 3~5회/시간", efficiency: "높음 (21~30)", mainDrops: "전신갑옷 주문서 10%/60%" },
  { id: "ludi", expPerRun: "40~50%", expPerHour: "약 2~3회/시간", efficiency: "최고 (35~50)", mainDrops: "전신 이속/지력, 귀지력 주문서" },
  { id: "orbis", expPerRun: "경파 15.5k / 완파 80~100k", expPerHour: "경파 15+회/시간", efficiency: "높음 (51~70)", mainDrops: "여신의 팔찌, 귀지력60, 장공60" },
  { id: "romeo", expPerRun: "20~30%", expPerHour: "약 1~2회/시간", efficiency: "보통 (70~119)", mainDrops: "호루스 눈, 연금술사 반지" },
];

type Tab = "guide" | "timer" | "compare";

export default function PQPage() {
  const [activeTab, setActiveTab] = useState<Tab>("guide");

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">파티퀘스트 가이드</h1>
      <p className="text-sm text-gray-500 mb-6">
        PQ 가이드, 재입장 타이머, 보상 비교
      </p>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { key: "guide" as Tab, label: "PQ 가이드" },
          { key: "timer" as Tab, label: "재입장 타이머" },
          { key: "compare" as Tab, label: "보상 비교" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.key
                ? "bg-white text-orange-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "guide" && <GuideTab />}
      {activeTab === "timer" && <TimerTab />}
      {activeTab === "compare" && <CompareTab />}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  PQ 가이드 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function GuideTab() {
  const [openPQ, setOpenPQ] = useState<string | null>("ludi");

  return (
    <div className="space-y-3">
      {PQ_LIST.map((pq) => (
        <div key={pq.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* 헤더 */}
          <button
            onClick={() => setOpenPQ(openPQ === pq.id ? null : pq.id)}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div>
                <h3 className="font-bold text-left">{pq.name}</h3>
                <p className="text-xs text-gray-500 text-left">{pq.nameEn}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex gap-2">
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                  Lv.{pq.levelMin}~{pq.levelMax}
                </span>
                <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">
                  {pq.members}명
                </span>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${
                  openPQ === pq.id ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {/* 상세 내용 */}
          {openPQ === pq.id && (
            <div className="px-5 pb-5 border-t border-gray-100">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 mb-5">
                <InfoBadge label="레벨" value={`${pq.levelMin}~${pq.levelMax}`} />
                <InfoBadge label="인원" value={`${pq.members}명`} />
                <InfoBadge label="일일 제한" value={`${pq.dailyLimit}회`} />
                <InfoBadge label="제한시간" value={pq.timeLimit} />
              </div>

              <div className="text-sm space-y-1 mb-4">
                <p><span className="text-gray-500">위치:</span> {pq.location}</p>
                <p><span className="text-gray-500">NPC:</span> {pq.npc}</p>
                {pq.requiredJobs.length > 0 && (
                  <p>
                    <span className="text-gray-500">필수 직업:</span>{" "}
                    {pq.requiredJobs.map((j, i) => (
                      <span key={i} className="inline-block text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded mr-1">
                        {j}
                      </span>
                    ))}
                  </p>
                )}
              </div>

              {/* 스테이지 */}
              <h4 className="font-bold text-sm mb-2">진행 단계</h4>
              <div className="space-y-2 mb-4">
                {pq.stages.map((stage, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{stage.name}</p>
                      <p className="text-xs text-gray-500">{stage.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* 보상 */}
              <h4 className="font-bold text-sm mb-2">보상</h4>
              <div className="bg-green-50 rounded-lg p-3 mb-4">
                <p className="text-sm text-green-700 mb-1">
                  <span className="font-medium">경험치:</span> {pq.rewards.exp}
                </p>
                <div className="flex flex-wrap gap-1">
                  {pq.rewards.items.map((item, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* 팁 */}
              <h4 className="font-bold text-sm mb-2">팁</h4>
              <ul className="space-y-1">
                {pq.tips.map((tip, i) => (
                  <li key={i} className="text-sm text-gray-600 flex gap-2">
                    <span className="text-orange-400 flex-shrink-0">-</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function InfoBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  재입장 타이머 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface PQCounter {
  count: number;
  lastReset: string; // YYYY-MM-DD
}

function getToday(): string {
  return new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD
}

function getTimeUntilMidnight(): string {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff = midnight.getTime() - now.getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}시간 ${m}분`;
}

function TimerTab() {
  const [counters, setCounters] = useState<Record<string, PQCounter>>({});
  const [timeLeft, setTimeLeft] = useState(getTimeUntilMidnight());

  // localStorage 로드
  useEffect(() => {
    const saved = localStorage.getItem("pq-counters");
    if (saved) {
      try {
        const data = JSON.parse(saved) as Record<string, PQCounter>;
        const today = getToday();
        // 자정 지나면 리셋
        const reset: Record<string, PQCounter> = {};
        for (const [key, val] of Object.entries(data)) {
          reset[key] = val.lastReset === today ? val : { count: 0, lastReset: today };
        }
        setCounters(reset);
      } catch {
        setCounters({});
      }
    }
  }, []);

  // 저장
  useEffect(() => {
    if (Object.keys(counters).length > 0) {
      localStorage.setItem("pq-counters", JSON.stringify(counters));
    }
  }, [counters]);

  // 자정까지 타이머
  useEffect(() => {
    const interval = setInterval(() => setTimeLeft(getTimeUntilMidnight()), 60000);
    return () => clearInterval(interval);
  }, []);

  const increment = useCallback((pqId: string) => {
    setCounters((prev) => {
      const today = getToday();
      const current = prev[pqId];
      const existing = current && current.lastReset === today ? current.count : 0;
      if (existing >= 5) return prev;
      return { ...prev, [pqId]: { count: existing + 1, lastReset: today } };
    });
  }, []);

  const decrement = useCallback((pqId: string) => {
    setCounters((prev) => {
      const today = getToday();
      const current = prev[pqId];
      const existing = current && current.lastReset === today ? current.count : 0;
      if (existing <= 0) return prev;
      return { ...prev, [pqId]: { count: existing - 1, lastReset: today } };
    });
  }, []);

  const resetAll = useCallback(() => {
    const today = getToday();
    const reset: Record<string, PQCounter> = {};
    PQ_LIST.forEach((pq) => {
      reset[pq.id] = { count: 0, lastReset: today };
    });
    setCounters(reset);
  }, []);

  return (
    <div className="space-y-6">
      {/* 자정 타이머 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
        <p className="text-sm text-gray-500 mb-1">일일 초기화까지</p>
        <p className="text-3xl font-mono font-bold text-orange-500">{timeLeft}</p>
        <p className="text-xs text-gray-400 mt-1">자정(00:00)에 모든 PQ 입장 횟수가 초기화됩니다</p>
      </div>

      {/* PQ별 카운터 */}
      <div className="space-y-3">
        {PQ_LIST.map((pq) => {
          const today = getToday();
          const counter = counters[pq.id];
          const count = counter && counter.lastReset === today ? counter.count : 0;
          const remaining = pq.dailyLimit - count;

          return (
            <div key={pq.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm">{pq.name}</h3>
                  <p className="text-xs text-gray-500">
                    Lv.{pq.levelMin}~{pq.levelMax} · {pq.members}명
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {/* 남은 횟수 표시 */}
                  <div className="flex gap-1">
                    {Array.from({ length: pq.dailyLimit }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-5 h-5 rounded-full border-2 transition-colors ${
                          i < count
                            ? "bg-orange-500 border-orange-500"
                            : "bg-white border-gray-300"
                        }`}
                      />
                    ))}
                  </div>

                  <span
                    className={`text-sm font-bold min-w-[3rem] text-center ${
                      remaining === 0 ? "text-red-500" : "text-green-600"
                    }`}
                  >
                    {remaining}/{pq.dailyLimit}
                  </span>

                  {/* 버튼 */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => decrement(pq.id)}
                      disabled={count <= 0}
                      className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center text-sm font-bold"
                    >
                      -
                    </button>
                    <button
                      onClick={() => increment(pq.id)}
                      disabled={count >= pq.dailyLimit}
                      className="w-8 h-8 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-30 flex items-center justify-center text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {remaining === 0 && (
                <p className="text-xs text-red-500 mt-2">오늘 입장 횟수를 모두 소진했습니다</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-center">
        <button
          onClick={resetAll}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          전체 초기화
        </button>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  보상 비교 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function CompareTab() {
  return (
    <div className="space-y-6">
      {/* 효율 비교 테이블 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="font-bold">PQ 효율 비교</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="text-left px-4 py-2.5 font-medium">PQ</th>
                <th className="text-left px-4 py-2.5 font-medium">레벨</th>
                <th className="text-left px-4 py-2.5 font-medium">1회 경험치</th>
                <th className="text-left px-4 py-2.5 font-medium">시간당 횟수</th>
                <th className="text-left px-4 py-2.5 font-medium">효율</th>
              </tr>
            </thead>
            <tbody>
              {REWARD_COMPARE.map((r) => {
                const pq = PQ_LIST.find((p) => p.id === r.id)!;
                return (
                  <tr key={r.id} className="border-t border-gray-50">
                    <td className="px-4 py-2.5 font-medium">{pq.name.replace(" 파티퀘스트", "").replace(" PQ", "")}</td>
                    <td className="px-4 py-2.5">{pq.levelMin}~{pq.levelMax}</td>
                    <td className="px-4 py-2.5">{r.expPerRun}</td>
                    <td className="px-4 py-2.5">{r.expPerHour}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          r.efficiency.startsWith("최고")
                            ? "bg-orange-100 text-orange-700"
                            : r.efficiency.startsWith("높음")
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {r.efficiency}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 주요 드랍 아이템 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="font-bold">주요 드랍 아이템</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="text-left px-4 py-2.5 font-medium">PQ</th>
                <th className="text-left px-4 py-2.5 font-medium">주요 드랍</th>
                <th className="text-left px-4 py-2.5 font-medium">상세 보상</th>
              </tr>
            </thead>
            <tbody>
              {PQ_LIST.map((pq) => {
                const compare = REWARD_COMPARE.find((r) => r.id === pq.id);
                return (
                  <tr key={pq.id} className="border-t border-gray-50">
                    <td className="px-4 py-2.5 font-medium">
                      {pq.name.replace(" 파티퀘스트", "").replace(" PQ", "")}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-orange-600">
                      {compare?.mainDrops}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {pq.rewards.items.map((item, i) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                            {item}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 레벨 구간별 추천 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold mb-4">레벨 구간별 추천 PQ</h2>
        <div className="space-y-3">
          {[
            { range: "21~30", rec: "커닝시티 PQ", desc: "유일한 선택지. 4명만 모이면 빠르게 반복 가능", color: "blue" },
            { range: "35~50", rec: "루디브리엄 PQ", desc: "최고의 경험치 효율. 6명 풀파티로 40~50% 경험치", color: "orange" },
            { range: "51~70", rec: "오르비스 PQ (경파)", desc: "경파로 2~4분 반복이 효율적. 주문서 노리면 완파", color: "green" },
            { range: "70+", rec: "로미오와 줄리엣 PQ", desc: "구슬 모아 장비 교환. 경험치보다 보상 위주", color: "purple" },
          ].map((item) => (
            <div key={item.range} className="flex gap-3 items-start">
              <span
                className={`flex-shrink-0 text-xs px-2 py-1 rounded font-bold min-w-[4rem] text-center ${
                  item.color === "blue" ? "bg-blue-100 text-blue-700" :
                  item.color === "orange" ? "bg-orange-100 text-orange-700" :
                  item.color === "green" ? "bg-green-100 text-green-700" :
                  "bg-purple-100 text-purple-700"
                }`}
              >
                Lv.{item.range}
              </span>
              <div>
                <p className="text-sm font-medium">{item.rec}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
