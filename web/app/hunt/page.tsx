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
    mapName: "달팽이 숲",
    mapNameEn: "Snail Hunting Ground",
    monsters: [
      { name: "달팽이", level: 2, hp: 15, exp: 3 },
      { name: "파란달팽이", level: 4, hp: 30, exp: 5 },
      { name: "빨간달팽이", level: 6, hp: 48, exp: 8 },
    ],
    estimatedKillsPerHour: 600,
    tips: ["초보 사냥터 — 아무 직업이나 쉽게 사냥 가능", "메이플 아일랜드 퀘스트 병행 추천"],
    goodFor: [],
    region: "메이플 아일랜드",
  },
  {
    id: "henesy-low",
    levelMin: 10,
    levelMax: 20,
    mapName: "헤네시스 사냥터",
    mapNameEn: "Henesys Hunting Ground",
    monsters: [
      { name: "슬라임", level: 10, hp: 150, exp: 14 },
      { name: "주황버섯", level: 15, hp: 500, exp: 24 },
    ],
    estimatedKillsPerHour: 500,
    tips: ["1차 전직 직후 추천 사냥터", "포션 소비가 적어 경제적"],
    goodFor: [],
    region: "빅토리아 아일랜드",
  },
  {
    id: "kerning-subway",
    levelMin: 20,
    levelMax: 30,
    mapName: "커닝시티 지하철",
    mapNameEn: "Kerning City Subway",
    monsters: [
      { name: "스티지", level: 18, hp: 800, exp: 28 },
      { name: "슬라임", level: 10, hp: 150, exp: 14 },
      { name: "Jr. 네키", level: 22, hp: 1200, exp: 42 },
    ],
    estimatedKillsPerHour: 400,
    tips: ["커닝PQ 대기하면서 사냥하기 좋음", "도적 직업 퀘스트 진행 가능"],
    goodFor: [],
    region: "빅토리아 아일랜드",
  },
  {
    id: "ant-tunnel",
    levelMin: 25,
    levelMax: 35,
    mapName: "개미굴 1",
    mapNameEn: "Ant Tunnel",
    monsters: [
      { name: "이블아이", level: 27, hp: 2000, exp: 58 },
      { name: "좀비버섯", level: 30, hp: 2800, exp: 72 },
    ],
    estimatedKillsPerHour: 350,
    tips: ["좀비버섯은 언데드 — 힐로 공격 가능 (성직자)", "이블아이 드랍이 좋은 편"],
    goodFor: [],
    region: "빅토리아 아일랜드",
  },
  {
    id: "wild-tiger",
    levelMin: 30,
    levelMax: 40,
    mapName: "야생의 땅 / 커닝PQ",
    mapNameEn: "Wild Boar Land",
    monsters: [
      { name: "와일드보어", level: 35, hp: 4000, exp: 95 },
      { name: "파이어보어", level: 38, hp: 5200, exp: 115 },
    ],
    estimatedKillsPerHour: 300,
    tips: ["커닝PQ(21~30) 졸업 후 추천", "30~35 구간은 커닝PQ가 효율 더 좋을 수 있음"],
    goodFor: [],
    region: "빅토리아 아일랜드",
  },
  {
    id: "ludi-toy",
    levelMin: 35,
    levelMax: 45,
    mapName: "루디브리엄 장난감 공장",
    mapNameEn: "Toy Factory",
    monsters: [
      { name: "로보", level: 38, hp: 5500, exp: 110 },
      { name: "마스터 로보", level: 42, hp: 7500, exp: 150 },
    ],
    estimatedKillsPerHour: 280,
    tips: ["루디PQ 대기하면서 사냥", "루디PQ(35~50)가 이 구간 최고 효율"],
    goodFor: [],
    region: "루디브리엄",
  },
  {
    id: "ludi-pq-block",
    levelMin: 40,
    levelMax: 50,
    mapName: "지구방위본부 / 루디PQ",
    mapNameEn: "Ludi PQ / Block Golems",
    monsters: [
      { name: "블록골렘", level: 45, hp: 10000, exp: 200 },
      { name: "킹블록골렘", level: 48, hp: 14000, exp: 260 },
    ],
    estimatedKillsPerHour: 250,
    tips: ["루디PQ 1회당 약 40~50% 경험치", "PQ가 안 잡히면 블록골렘 사냥"],
    goodFor: [],
    region: "루디브리엄",
  },
  {
    id: "ludi-maze",
    levelMin: 50,
    levelMax: 60,
    mapName: "루디 미궁 / 스트레이캣",
    mapNameEn: "Ludibrium Maze",
    monsters: [
      { name: "스트레이캣", level: 52, hp: 14000, exp: 280 },
      { name: "블랙라츠", level: 55, hp: 17000, exp: 330 },
    ],
    estimatedKillsPerHour: 220,
    tips: ["오르비스PQ(51~70)와 병행 추천", "마법사는 범위 공격으로 효율 좋음"],
    goodFor: ["mage"],
    region: "루디브리엄",
  },
  {
    id: "orbis-jr-neki",
    levelMin: 55,
    levelMax: 70,
    mapName: "지구방위본부 / 오르비스탑",
    mapNameEn: "Orbis Tower",
    monsters: [
      { name: "주니어 네키", level: 58, hp: 20000, exp: 380 },
      { name: "스타픽시", level: 62, hp: 24000, exp: 440 },
    ],
    estimatedKillsPerHour: 200,
    tips: ["오르비스PQ 경파 반복이 가장 효율적", "솔플시 오르비스탑 몬스터 사냥"],
    goodFor: [],
    region: "오르비스",
  },
  {
    id: "leafre-dead-tree",
    levelMin: 70,
    levelMax: 85,
    mapName: "죽은나무숲 / 리프레 입구",
    mapNameEn: "Dead Tree Forest / Leafre",
    monsters: [
      { name: "코쿨", level: 73, hp: 35000, exp: 580 },
      { name: "루이넬", level: 76, hp: 42000, exp: 650 },
    ],
    estimatedKillsPerHour: 180,
    tips: ["로미줄PQ(70~119)와 병행 추천", "리프레 진입 퀘스트 필요"],
    goodFor: [],
    region: "리프레",
  },
  {
    id: "elnath-temple",
    levelMin: 80,
    levelMax: 100,
    mapName: "엘나스 / 시간의 신전",
    mapNameEn: "El Nath / Temple of Time",
    monsters: [
      { name: "이올", level: 82, hp: 50000, exp: 750 },
      { name: "리셀", level: 88, hp: 65000, exp: 900 },
    ],
    estimatedKillsPerHour: 160,
    tips: ["전사 계열은 물약 소비 주의", "마법사는 범위기로 효율적 사냥 가능"],
    goodFor: ["mage", "warrior"],
    region: "엘나스",
  },
  {
    id: "leafre-dragon",
    levelMin: 100,
    levelMax: 120,
    mapName: "리프레 용의숲",
    mapNameEn: "Dragon Forest",
    monsters: [
      { name: "와이번", level: 102, hp: 80000, exp: 1100 },
      { name: "다크와이번", level: 110, hp: 110000, exp: 1400 },
    ],
    estimatedKillsPerHour: 140,
    tips: ["3차 직업 스킬 활용 필수", "궁수/마법사 원거리 딜이 유리"],
    goodFor: ["archer", "mage"],
    region: "리프레",
  },
  {
    id: "temple-deep",
    levelMin: 110,
    levelMax: 130,
    mapName: "시간의 신전 심화",
    mapNameEn: "Deep Temple of Time",
    monsters: [
      { name: "시간의 눈", level: 115, hp: 150000, exp: 1800 },
      { name: "시간의 입", level: 120, hp: 200000, exp: 2200 },
    ],
    estimatedKillsPerHour: 120,
    tips: ["4차 전직 이후 추천", "파티 사냥 시 효율 대폭 상승"],
    goodFor: [],
    region: "시간의 신전",
  },
  {
    id: "henesy-ruin",
    levelMin: 120,
    levelMax: 150,
    mapName: "헤네시스 유적 / 뇌전의숲",
    mapNameEn: "Henesys Ruins / Thunder Forest",
    monsters: [
      { name: "뇌전의 정령", level: 125, hp: 250000, exp: 2800 },
      { name: "고대 석상", level: 135, hp: 350000, exp: 3500 },
    ],
    estimatedKillsPerHour: 100,
    tips: ["높은 레벨 장비와 4차 스킬 필수", "뇌전의숲은 마법사에게 특히 유리"],
    goodFor: ["mage"],
    region: "빅토리아 아일랜드",
  },
  {
    id: "skelegon",
    levelMin: 140,
    levelMax: 170,
    mapName: "스켈레곤 / 닌자캐슬",
    mapNameEn: "Skelegon / Ninja Castle",
    monsters: [
      { name: "스켈레곤", level: 145, hp: 500000, exp: 4500 },
      { name: "닌자", level: 155, hp: 650000, exp: 5500 },
    ],
    estimatedKillsPerHour: 80,
    tips: ["높은 스펙 필요 — 장비 투자 필수", "파티 사냥 강력 추천"],
    goodFor: [],
    region: "리프레 / 닌자캐슬",
  },
  {
    id: "sharenian",
    levelMin: 160,
    levelMax: 200,
    mapName: "헤네시스 유적 깊은곳 / 샤레니안",
    mapNameEn: "Deep Henesys Ruins / Sharenian",
    monsters: [
      { name: "강화형 석상", level: 165, hp: 900000, exp: 7000 },
      { name: "샤레니안 기사", level: 175, hp: 1200000, exp: 9000 },
    ],
    estimatedKillsPerHour: 60,
    tips: ["엔드 컨텐츠 — 최고 레벨 사냥터", "풀 파티 + 고스펙 필수", "메소 드랍도 좋은 편"],
    goodFor: [],
    region: "샤레니안",
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
  const [level, setLevel] = useState<number>(30);
  const [job, setJob] = useState<Job>("all");
  const [damage, setDamage] = useState<string>("");

  const filteredSpots = useMemo(() => {
    const dmg = damage ? parseInt(damage, 10) : null;

    return HUNTING_SPOTS.filter((spot) => {
      // 레벨 범위: 캐릭터 레벨이 사냥터 추천 범위 안에 있거나 +-5 이내
      const inRange = level >= spot.levelMin - 5 && level <= spot.levelMax + 5;
      if (!inRange) return false;

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
      // 캐릭터 레벨과 사냥터 중심 레벨의 차이가 적은 순
      const midA = (a.levelMin + a.levelMax) / 2;
      const midB = (b.levelMin + b.levelMax) / 2;
      const diffA = Math.abs(level - midA);
      const diffB = Math.abs(level - midB);

      // 추천도: 범위 안에 있으면 우선
      const inA = level >= a.levelMin && level <= a.levelMax ? 0 : 1;
      const inB = level >= b.levelMin && level <= b.levelMax ? 0 : 1;
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
                const v = parseInt(e.target.value, 10);
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
            Lv.{level} {JOB_LABELS[job]} 기준 추천 사냥터 <span className="font-bold text-orange-600">{filteredSpots.length}곳</span>
          </p>

          {filteredSpots.map((spot, idx) => {
            const isInRange = level >= spot.levelMin && level <= spot.levelMax;
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
            const isHighlighted = level >= spot.levelMin && level <= spot.levelMax;
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
