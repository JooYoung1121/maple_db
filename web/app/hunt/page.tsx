"use client";

import { useState, useMemo } from "react";

// ─── 직업 타입 ───
type Job = "all" | "warrior" | "mage" | "archer" | "thief" | "pirate";

const JOB_LABELS: Record<Job, string> = {
  all: "전체",
  warrior: "전사",
  mage: "마법사",
  archer: "궁수",
  thief: "도적",
  pirate: "해적",
};

// ─── 사냥터 데이터 ───
interface Monster {
  name: string;
  level: number;
  hp: number;
  exp: number;
}

interface HuntingSpot {
  id: string;
  levelMin: number;
  levelMax: number;
  mapName: string;
  mapNameEn?: string;
  monsters: Monster[];
  estimatedKillsPerHour: number; // 기본 킬/시
  tips: string[];
  goodFor: Job[]; // 빈 배열 = 전직업 추천
  region: string;
}

const HUNTING_SPOTS: HuntingSpot[] = [
  {
    id: "snail",
    levelMin: 1,
    levelMax: 10,
    mapName: "남쪽 숲의 달팽이들",
    mapNameEn: "Snail Hunting Ground",
    monsters: [
      { name: "달팽이", level: 1, hp: 15, exp: 3 },
      { name: "파란달팽이", level: 2, hp: 20, exp: 4 },
      { name: "버섯", level: 3, hp: 35, exp: 6 },
      { name: "빨간달팽이", level: 4, hp: 45, exp: 8 },
    ],
    estimatedKillsPerHour: 600,
    tips: ["초보 사냥터 — 아무 직업이나 쉽게 사냥 가능", "메이플 아일랜드 퀘스트 병행 추천"],
    goodFor: [],
    region: "메이플 아일랜드",
  },
  {
    id: "henesy-low",
    levelMin: 8,
    levelMax: 15,
    mapName: "헤네시스 사냥터",
    mapNameEn: "Henesys Hunting Ground",
    monsters: [
      { name: "주황버섯", level: 8, hp: 150, exp: 20 },
      { name: "초록버섯", level: 12, hp: 400, exp: 48 },
    ],
    estimatedKillsPerHour: 500,
    tips: ["1차 전직 직후 추천 사냥터", "포션 소비가 적어 경제적"],
    goodFor: [],
    region: "빅토리아 아일랜드",
  },
  {
    id: "kerning-construction",
    levelMin: 8,
    levelMax: 15,
    mapName: "커닝시티 건설현장",
    mapNameEn: "Kerning City Construction Site",
    monsters: [
      { name: "옥토퍼스", level: 10, hp: 210, exp: 28 },
    ],
    estimatedKillsPerHour: 480,
    tips: ["도적 전직 퀘스트 병행 가능", "커닝시티 접근성이 좋음"],
    goodFor: ["thief"],
    region: "빅토리아 아일랜드",
  },
  {
    id: "perion-valley",
    levelMin: 13,
    levelMax: 22,
    mapName: "페리온 위험한 골짜기",
    mapNameEn: "Perion Dangerous Valley",
    monsters: [
      { name: "스텀프", level: 13, hp: 460, exp: 52 },
      { name: "다크스텀프", level: 18, hp: 1200, exp: 105 },
    ],
    estimatedKillsPerHour: 400,
    tips: ["전사 전직 퀘스트 병행 가능", "비교적 넓은 맵에서 효율적 사냥"],
    goodFor: ["warrior"],
    region: "빅토리아 아일랜드",
  },
  {
    id: "ellinia-forest",
    levelMin: 13,
    levelMax: 22,
    mapName: "엘리니아 숲",
    mapNameEn: "Ellinia Forest",
    monsters: [
      { name: "슬라임", level: 10, hp: 200, exp: 25 },
      { name: "버블링", level: 15, hp: 700, exp: 72 },
    ],
    estimatedKillsPerHour: 420,
    tips: ["마법사 전직 퀘스트 병행 가능", "슬라임 드랍이 짭짤한 편"],
    goodFor: ["mage"],
    region: "빅토리아 아일랜드",
  },
  {
    id: "kerning-subway",
    levelMin: 20,
    levelMax: 30,
    mapName: "커닝시티 지하철 B1",
    mapNameEn: "Kerning City Subway B1",
    monsters: [
      { name: "스티지", level: 18, hp: 1000, exp: 90 },
      { name: "주니어 부기", level: 20, hp: 1400, exp: 120 },
    ],
    estimatedKillsPerHour: 380,
    tips: ["커닝PQ 대기하면서 사냥하기 좋음", "도적 직업 퀘스트 진행 가능"],
    goodFor: [],
    region: "빅토리아 아일랜드",
  },
  {
    id: "kerning-pq",
    levelMin: 21,
    levelMax: 30,
    mapName: "커닝 PQ (파티퀘스트)",
    mapNameEn: "Kerning PQ",
    monsters: [],
    estimatedKillsPerHour: 0,
    tips: ["레벨 21~30 구간 최고 효율 파티퀘스트", "4인 파티 필수", "1회당 경험치가 매우 높음"],
    goodFor: [],
    region: "빅토리아 아일랜드",
  },
  {
    id: "ant-tunnel",
    levelMin: 20,
    levelMax: 30,
    mapName: "개미굴 1~2층",
    mapNameEn: "Ant Tunnel",
    monsters: [
      { name: "이블아이", level: 22, hp: 2000, exp: 160 },
      { name: "좀비버섯", level: 25, hp: 2800, exp: 200 },
    ],
    estimatedKillsPerHour: 350,
    tips: ["좀비버섯은 언데드 — 힐로 공격 가능 (성직자)", "이블아이 드랍이 좋은 편"],
    goodFor: [],
    region: "빅토리아 아일랜드",
  },
  {
    id: "ant-tunnel-deep",
    levelMin: 25,
    levelMax: 35,
    mapName: "개미굴 깊은곳",
    mapNameEn: "Deep Ant Tunnel",
    monsters: [
      { name: "좀비버섯", level: 25, hp: 2800, exp: 200 },
      { name: "포이즌 펑거", level: 28, hp: 3500, exp: 260 },
    ],
    estimatedKillsPerHour: 320,
    tips: ["좀비버섯 힐 사냥 가능 (성직자)", "포이즌 펑거 독 공격 주의"],
    goodFor: [],
    region: "빅토리아 아일랜드",
  },
  {
    id: "wild-boar",
    levelMin: 25,
    levelMax: 35,
    mapName: "페리온 야생타이거",
    mapNameEn: "Wild Boar Land",
    monsters: [
      { name: "와일드보어", level: 25, hp: 2700, exp: 195 },
    ],
    estimatedKillsPerHour: 300,
    tips: ["넓은 맵에서 전사 계열 효율 좋음", "커닝PQ 졸업 후 추천"],
    goodFor: ["warrior"],
    region: "빅토리아 아일랜드",
  },
  {
    id: "florina-beach",
    levelMin: 30,
    levelMax: 40,
    mapName: "플로리나 비치",
    mapNameEn: "Florina Beach",
    monsters: [
      { name: "로랑", level: 32, hp: 4000, exp: 340 },
      { name: "클랑", level: 35, hp: 5000, exp: 410 },
    ],
    estimatedKillsPerHour: 280,
    tips: ["커닝PQ(21~30) 졸업 후 추천", "몬스터 밀집도가 높아 효율적"],
    goodFor: [],
    region: "빅토리아 아일랜드",
  },
  {
    id: "ludi-toy",
    levelMin: 35,
    levelMax: 50,
    mapName: "루디브리엄 장난감 공장",
    mapNameEn: "Toy Factory",
    monsters: [
      { name: "로보", level: 37, hp: 5500, exp: 450 },
      { name: "마스터 로보", level: 42, hp: 7500, exp: 600 },
    ],
    estimatedKillsPerHour: 260,
    tips: ["루디PQ 대기하면서 사냥", "루디PQ(35~50)가 이 구간 최고 효율"],
    goodFor: [],
    region: "루디브리엄",
  },
  {
    id: "ludi-pq",
    levelMin: 35,
    levelMax: 50,
    mapName: "루디 PQ (파티퀘스트)",
    mapNameEn: "Ludi PQ",
    monsters: [],
    estimatedKillsPerHour: 0,
    tips: ["레벨 35~50 구간 최고 효율 파티퀘스트", "6인 파티 필수", "1회당 경험치가 매우 높음"],
    goodFor: [],
    region: "루디브리엄",
  },
  {
    id: "block-golem",
    levelMin: 35,
    levelMax: 50,
    mapName: "지구방위본부 입구",
    mapNameEn: "Omega Sector Entrance",
    monsters: [
      { name: "블록골렘", level: 39, hp: 6000, exp: 500 },
    ],
    estimatedKillsPerHour: 280,
    tips: ["루디PQ가 안 잡히면 블록골렘 사냥", "비교적 밀집도 높은 맵"],
    goodFor: [],
    region: "루디브리엄",
  },
  {
    id: "block-golem-deep",
    levelMin: 45,
    levelMax: 55,
    mapName: "지구방위본부 깊은곳",
    mapNameEn: "Deep Omega Sector",
    monsters: [
      { name: "킹블록골렘", level: 48, hp: 10000, exp: 780 },
    ],
    estimatedKillsPerHour: 240,
    tips: ["블록골렘 상위 사냥터", "솔플 효율 괜찮은 편"],
    goodFor: [],
    region: "루디브리엄",
  },
  {
    id: "orbis-tower-low",
    levelMin: 45,
    levelMax: 55,
    mapName: "오르비스탑 아래층",
    mapNameEn: "Orbis Tower Lower Floors",
    monsters: [
      { name: "주니어 네키", level: 42, hp: 7000, exp: 550 },
      { name: "주니어 셀리온", level: 43, hp: 7200, exp: 570 },
    ],
    estimatedKillsPerHour: 250,
    tips: ["오르비스탑 이동 중 사냥 가능", "마법사 범위기로 효율 좋음"],
    goodFor: ["mage"],
    region: "오르비스",
  },
  {
    id: "orbis-tower-mid",
    levelMin: 50,
    levelMax: 60,
    mapName: "오르비스탑",
    mapNameEn: "Orbis Tower",
    monsters: [
      { name: "스타픽시", level: 52, hp: 12000, exp: 950 },
      { name: "루나픽시", level: 55, hp: 14000, exp: 1100 },
    ],
    estimatedKillsPerHour: 220,
    tips: ["오르비스 정원 진입 전 사냥터", "마법사 범위 공격으로 효율 좋음"],
    goodFor: ["mage"],
    region: "오르비스",
  },
  {
    id: "elnath-low",
    levelMin: 55,
    levelMax: 70,
    mapName: "엘나스 설원",
    mapNameEn: "El Nath Snowfield",
    monsters: [
      { name: "페페", level: 55, hp: 14000, exp: 1100 },
      { name: "화이트팽", level: 56, hp: 15000, exp: 1200 },
    ],
    estimatedKillsPerHour: 200,
    tips: ["전사 계열은 물약 소비 주의", "페페는 밀집도 높은 맵에서 효율적"],
    goodFor: [],
    region: "엘나스",
  },
  {
    id: "dead-tree-forest",
    levelMin: 55,
    levelMax: 70,
    mapName: "죽은나무 숲",
    mapNameEn: "Dead Tree Forest",
    monsters: [
      { name: "쿨리좀비", level: 58, hp: 16000, exp: 1350 },
    ],
    estimatedKillsPerHour: 200,
    tips: ["언데드 몬스터 — 성직자 힐 사냥 가능", "좀비류 중 경험치 효율 최상급"],
    goodFor: [],
    region: "엘나스",
  },
  {
    id: "orbis-garden",
    levelMin: 55,
    levelMax: 70,
    mapName: "오르비스 가든",
    mapNameEn: "Orbis Garden",
    monsters: [
      { name: "루이넬", level: 60, hp: 18000, exp: 1500 },
    ],
    estimatedKillsPerHour: 190,
    tips: ["넓은 맵에서 원거리 직업 유리", "경험치 효율 좋은 편"],
    goodFor: ["archer", "mage"],
    region: "오르비스",
  },
  {
    id: "elnath-iol",
    levelMin: 65,
    levelMax: 80,
    mapName: "엘나스 / 시간의 신전 입구",
    mapNameEn: "El Nath / Temple of Time Entrance",
    monsters: [
      { name: "이올", level: 65, hp: 22000, exp: 1800 },
      { name: "다크 지푸라기", level: 67, hp: 24000, exp: 2000 },
    ],
    estimatedKillsPerHour: 180,
    tips: ["이올은 넓은 맵에서 효율적", "다크 지푸라기 사냥터(루디브리엄)도 병행 추천"],
    goodFor: [],
    region: "엘나스",
  },
  {
    id: "leafre-wyvern",
    levelMin: 75,
    levelMax: 90,
    mapName: "리프레 하늘둥지",
    mapNameEn: "Leafre Sky Nest",
    monsters: [
      { name: "레드 와이번", level: 78, hp: 36000, exp: 3200 },
      { name: "블루 와이번", level: 80, hp: 40000, exp: 3500 },
    ],
    estimatedKillsPerHour: 160,
    tips: ["리프레 진입 퀘스트 필요", "궁수/마법사 원거리 딜이 유리"],
    goodFor: ["archer", "mage"],
    region: "리프레",
  },
  {
    id: "temple-time",
    levelMin: 75,
    levelMax: 90,
    mapName: "시간의 신전",
    mapNameEn: "Temple of Time",
    monsters: [
      { name: "리셀", level: 80, hp: 40000, exp: 3500 },
    ],
    estimatedKillsPerHour: 160,
    tips: ["시간의 신전 퀘스트 진행 필요", "파티 사냥 시 효율 상승"],
    goodFor: [],
    region: "시간의 신전",
  },
  {
    id: "leafre-dragon-forest",
    levelMin: 85,
    levelMax: 100,
    mapName: "리프레 용의 숲",
    mapNameEn: "Dragon Forest",
    monsters: [
      { name: "다크 와이번", level: 85, hp: 48000, exp: 4200 },
    ],
    estimatedKillsPerHour: 140,
    tips: ["3차 직업 스킬 활용 필수", "궁수/마법사 원거리 딜이 유리"],
    goodFor: ["archer", "mage"],
    region: "리프레",
  },
  {
    id: "mulung-thunder",
    levelMin: 85,
    levelMax: 100,
    mapName: "뇌전의 숲 (무릉)",
    mapNameEn: "Thunder Forest (Mu Lung)",
    monsters: [
      { name: "호돌", level: 88, hp: 52000, exp: 4500 },
    ],
    estimatedKillsPerHour: 150,
    tips: ["무릉 접근 퀘스트 필요", "마법사 범위기로 효율적 사냥 가능"],
    goodFor: ["mage"],
    region: "무릉",
  },
  {
    id: "coolie-zombie-high",
    levelMin: 95,
    levelMax: 110,
    mapName: "죽은나무의 숲 3",
    mapNameEn: "Dead Tree Forest 3",
    monsters: [
      { name: "쿨리좀비", level: 58, hp: 16000, exp: 1350 },
    ],
    estimatedKillsPerHour: 350,
    tips: ["고레벨에서도 높은 킬속도로 효율 유지", "성직자 힐 사냥 성지", "밀집도 높은 맵에서 범위기 효율 극대화"],
    goodFor: [],
    region: "엘나스",
  },
  {
    id: "leafre-deep",
    levelMin: 95,
    levelMax: 110,
    mapName: "리프레 깊은곳",
    mapNameEn: "Deep Leafre",
    monsters: [
      { name: "본 드래곤", level: 95, hp: 60000, exp: 5200 },
      { name: "다크 본 드래곤", level: 100, hp: 70000, exp: 6000 },
    ],
    estimatedKillsPerHour: 120,
    tips: ["높은 스펙 필요 — 장비 투자 필수", "3차 이상 스킬 필수"],
    goodFor: [],
    region: "리프레",
  },
  {
    id: "elnath-deep",
    levelMin: 105,
    levelMax: 120,
    mapName: "엘나스 깊은곳",
    mapNameEn: "Deep El Nath",
    monsters: [
      { name: "헥사", level: 108, hp: 80000, exp: 6500 },
    ],
    estimatedKillsPerHour: 110,
    tips: ["4차 전직 이후 추천", "높은 장비 스펙 필요"],
    goodFor: [],
    region: "엘나스",
  },
  {
    id: "leafre-griffin",
    levelMin: 105,
    levelMax: 120,
    mapName: "리프레 마지막",
    mapNameEn: "Leafre End",
    monsters: [
      { name: "그리핀", level: 115, hp: 100000, exp: 8000 },
    ],
    estimatedKillsPerHour: 90,
    tips: ["최상급 사냥터 — 4차 스킬 필수", "파티 사냥 강력 추천"],
    goodFor: [],
    region: "리프레",
  },
  {
    id: "skelegon",
    levelMin: 115,
    levelMax: 140,
    mapName: "헤네시스 유적",
    mapNameEn: "Henesys Ruins",
    monsters: [
      { name: "스켈레곤", level: 128, hp: 320000, exp: 12000 },
      { name: "스켈로스", level: 132, hp: 400000, exp: 14000 },
    ],
    estimatedKillsPerHour: 80,
    tips: ["4차 전직 이후 핵심 사냥터", "파티 사냥 시 효율 대폭 상승", "높은 스펙 필요"],
    goodFor: [],
    region: "빅토리아 아일랜드",
  },
  {
    id: "ninja-castle",
    levelMin: 130,
    levelMax: 200,
    mapName: "호문스쿨루 / 닌자캐슬",
    mapNameEn: "Homunculus / Ninja Castle",
    monsters: [
      { name: "호문스쿨루", level: 140, hp: 500000, exp: 18000 },
    ],
    estimatedKillsPerHour: 70,
    tips: ["엔드 컨텐츠 — 최고 레벨 사냥터", "풀 파티 + 고스펙 필수"],
    goodFor: [],
    region: "닌자캐슬",
  },
  {
    id: "sharenian",
    levelMin: 130,
    levelMax: 200,
    mapName: "헤네시스 유적 깊은곳 / 샤레니안",
    mapNameEn: "Deep Henesys Ruins / Sharenian",
    monsters: [
      { name: "스켈레곤", level: 128, hp: 320000, exp: 12000 },
      { name: "스켈로스", level: 132, hp: 400000, exp: 14000 },
    ],
    estimatedKillsPerHour: 90,
    tips: ["빅뱅 전 최종 사냥터", "보스 사냥 + 유적 반복이 주력", "150+ 이후 효율적 사냥터가 많지 않아 보스런 병행 필수"],
    goodFor: [],
    region: "빅토리아 아일랜드",
  },
];

// ─── 유틸 ───
function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

function formatExpShort(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}억`;
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}천만`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return formatNumber(n);
}

// ─── 메인 컴포넌트 ───
export default function HuntPage() {
  const [level, setLevel] = useState<number | "">(30);
  const [job, setJob] = useState<Job>("all");
  const [damage, setDamage] = useState<string>("");

  const filteredSpots = useMemo(() => {
    const dmg = damage ? parseInt(damage, 10) : null;
    const lvl = level === "" ? null : level;

    return HUNTING_SPOTS.filter((spot) => {
      // 레벨이 비어있으면 전체 표시
      if (lvl !== null) {
        // 레벨 범위: 캐릭터 레벨이 사냥터 추천 범위 안에 있거나 +-5 이내
        const inRange = lvl >= spot.levelMin - 5 && lvl <= spot.levelMax + 5;
        if (!inRange) return false;
      }

      // 직업 필터
      if (job !== "all" && spot.goodFor.length > 0 && !spot.goodFor.includes(job)) {
        return false;
      }

      // 데미지 필터: 1타 데미지보다 HP가 10배 이상 높은 몬스터만 있는 맵은 제외
      if (dmg && dmg > 0) {
        const canKill = spot.monsters.some((m) => m.hp <= dmg * 10);
        if (!canKill) return false;
      }

      return true;
    }).sort((a, b) => {
      if (lvl === null) return a.levelMin - b.levelMin;

      // 캐릭터 레벨과 사냥터 중심 레벨의 차이가 적은 순
      const midA = (a.levelMin + a.levelMax) / 2;
      const midB = (b.levelMin + b.levelMax) / 2;
      const diffA = Math.abs(lvl - midA);
      const diffB = Math.abs(lvl - midB);

      // 추천도: 범위 안에 있으면 우선
      const inA = lvl >= a.levelMin && lvl <= a.levelMax ? 0 : 1;
      const inB = lvl >= b.levelMin && lvl <= b.levelMax ? 0 : 1;
      if (inA !== inB) return inA - inB;

      return diffA - diffB;
    });
  }, [level, job, damage]);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">사냥터 추천</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        레벨과 직업에 맞는 최적의 사냥터를 찾아보세요
      </p>

      {/* 입력 영역 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 레벨 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              캐릭터 레벨
            </label>
            <input
              type="number"
              min={1}
              max={200}
              value={level}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  setLevel("");
                  return;
                }
                const v = parseInt(raw, 10);
                if (!isNaN(v) && v >= 1 && v <= 200) setLevel(v);
              }}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
            />
          </div>

          {/* 직업 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              직업 선택
            </label>
            <select
              value={job}
              onChange={(e) => setJob(e.target.value as Job)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white dark:bg-gray-800"
            >
              {Object.entries(JOB_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* 1타 데미지 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              1타 데미지 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <input
              type="number"
              min={0}
              placeholder="미입력시 무시"
              value={damage}
              onChange={(e) => setDamage(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
            />
          </div>
        </div>
      </div>

      {/* 결과 */}
      {filteredSpots.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center text-gray-400">
          <p className="text-lg mb-1">추천 사냥터가 없습니다</p>
          <p className="text-sm">레벨 또는 데미지 조건을 조정해보세요</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {level !== "" ? `Lv.${level}` : "전체 레벨"} {JOB_LABELS[job]} 기준 추천 사냥터 <span className="font-bold text-orange-600">{filteredSpots.length}곳</span>
          </p>

          {filteredSpots.map((spot, idx) => {
            const isInRange = level !== "" && level >= spot.levelMin && level <= spot.levelMax;
            const avgExp = spot.monsters.reduce((sum, m) => sum + m.exp, 0) / spot.monsters.length;
            const expPerHour = Math.round(avgExp * spot.estimatedKillsPerHour);

            return (
              <div
                key={spot.id}
                className={`bg-white dark:bg-gray-800 border rounded-xl overflow-hidden ${
                  isInRange ? "border-orange-200" : "border-gray-200 dark:border-gray-700"
                }`}
              >
                {/* 헤더 */}
                <div className="px-5 py-4 flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 text-orange-600 text-sm font-bold flex items-center justify-center mt-0.5">
                      {idx + 1}
                    </div>
                    <div>
                      <h3 className="font-bold">{spot.mapName}</h3>
                      {spot.mapNameEn && (
                        <p className="text-xs text-gray-400">{spot.mapNameEn}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                          Lv.{spot.levelMin}~{spot.levelMax}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                          {spot.region}
                        </span>
                        {isInRange && (
                          <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded font-medium">
                            적정 레벨
                          </span>
                        )}
                        {spot.goodFor.length > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                            {spot.goodFor.map((j) => JOB_LABELS[j]).join(", ")} 추천
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-xs text-gray-400">시간당 예상 경험치</p>
                    <p className="text-lg font-bold text-orange-600">
                      {formatExpShort(expPerHour)}
                    </p>
                  </div>
                </div>

                {/* 몬스터 목록 */}
                <div className="px-5 pb-4">
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-500 dark:text-gray-400 text-xs">
                          <th className="text-left px-3 py-2 font-medium">몬스터</th>
                          <th className="text-center px-3 py-2 font-medium">레벨</th>
                          <th className="text-right px-3 py-2 font-medium">HP</th>
                          <th className="text-right px-3 py-2 font-medium">EXP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {spot.monsters.map((m) => {
                          const dmg = damage ? parseInt(damage, 10) : null;
                          const canOneshot = dmg ? dmg >= m.hp : null;
                          return (
                            <tr key={m.name} className="border-t border-gray-100">
                              <td className="px-3 py-2 font-medium">{m.name}</td>
                              <td className="px-3 py-2 text-center text-gray-500 dark:text-gray-400">Lv.{m.level}</td>
                              <td className="px-3 py-2 text-right">
                                {formatNumber(m.hp)}
                                {canOneshot !== null && (
                                  <span className={`ml-1 text-xs ${canOneshot ? "text-green-600" : "text-red-500"}`}>
                                    {canOneshot ? "(1타)" : "(X)"}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right text-orange-600 font-medium">
                                {formatNumber(m.exp)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* 추천 이유 / 팁 */}
                  {spot.tips.length > 0 && (
                    <div className="mt-3">
                      <ul className="space-y-1">
                        {spot.tips.map((tip, i) => (
                          <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
                            <span className="text-orange-400 flex-shrink-0">-</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 전체 사냥터 레벨 맵 */}
      <div className="mt-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h2 className="font-bold mb-4">레벨 구간별 사냥터 총정리</h2>
        <div className="space-y-2">
          {HUNTING_SPOTS.map((spot) => {
            const isHighlighted = level !== "" && level >= spot.levelMin && level <= spot.levelMax;
            return (
              <div
                key={spot.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isHighlighted ? "bg-orange-50" : "hover:bg-gray-50 dark:bg-gray-900"
                }`}
              >
                <span
                  className={`flex-shrink-0 text-xs px-2 py-1 rounded font-bold min-w-[5.5rem] text-center ${
                    isHighlighted
                      ? "bg-orange-100 text-orange-700"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  Lv.{spot.levelMin}~{spot.levelMax}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isHighlighted ? "text-orange-700" : ""}`}>
                    {spot.mapName}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {spot.monsters.map((m) => m.name).join(", ")}
                  </p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {spot.region}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
