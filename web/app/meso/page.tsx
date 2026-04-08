"use client";

import { useState, useMemo } from "react";

/* ── 사냥터 데이터 (hunt 페이지 데이터 기반) ── */

interface MesoSpot {
  id: string;
  mapName: string;
  region: string;
  levelMin: number;
  levelMax: number;
  monsters: { name: string; level: number; hp: number; exp: number }[];
  expPerHour: number;
}

// 메소 추정 공식: 몬스터 레벨 기반 + 평균 드롭
// baseMeso = level * 1.0 ~ 1.5 (랜덤 범위)
// 시간당 예상 메소 = (시간당 킬수) * (평균 메소 드롭)
// 시간당 킬수 = expPerHour / avgExp (추정)
function estimateMesoPerHour(spot: MesoSpot): number {
  const avgLevel = spot.monsters.reduce((s, m) => s + m.level, 0) / spot.monsters.length;
  const avgExp = spot.monsters.reduce((s, m) => s + m.exp, 0) / spot.monsters.length;
  const avgMesoDrop = avgLevel * 1.2; // 추정 메소 드롭
  const killsPerHour = avgExp > 0 ? spot.expPerHour / avgExp : 0;
  return Math.round(killsPerHour * avgMesoDrop);
}

const SPOTS: MesoSpot[] = [
  {
    id: "snail-field", mapName: "달팽이 동산", region: "메이플 아일랜드",
    levelMin: 1, levelMax: 10,
    monsters: [{ name: "달팽이", level: 2, hp: 15, exp: 3 }],
    expPerHour: 2000,
  },
  {
    id: "slime-tree", mapName: "슬라임 나무", region: "빅토리아 아일랜드",
    levelMin: 10, levelMax: 20,
    monsters: [{ name: "슬라임", level: 10, hp: 100, exp: 15 }],
    expPerHour: 8000,
  },
  {
    id: "mushroom-garden", mapName: "주황버섯 동산", region: "헤네시스",
    levelMin: 15, levelMax: 25,
    monsters: [{ name: "주황버섯", level: 15, hp: 300, exp: 25 }],
    expPerHour: 15000,
  },
  {
    id: "pig-beach", mapName: "돼지 해변", region: "헤네시스",
    levelMin: 18, levelMax: 28,
    monsters: [
      { name: "리본돼지", level: 18, hp: 450, exp: 32 },
      { name: "돼지", level: 15, hp: 300, exp: 22 },
    ],
    expPerHour: 18000,
  },
  {
    id: "ant-tunnel", mapName: "개미굴 1", region: "슬리피우드",
    levelMin: 20, levelMax: 35,
    monsters: [{ name: "이블아이", level: 23, hp: 700, exp: 45 }],
    expPerHour: 25000,
  },
  {
    id: "kerning-pq", mapName: "커닝시티 PQ", region: "커닝시티",
    levelMin: 21, levelMax: 30,
    monsters: [{ name: "PQ 몬스터", level: 25, hp: 500, exp: 50 }],
    expPerHour: 35000,
  },
  {
    id: "zombie-mushroom", mapName: "좀비버섯 숲", region: "엘리니아",
    levelMin: 30, levelMax: 45,
    monsters: [{ name: "좀비버섯", level: 35, hp: 2000, exp: 100 }],
    expPerHour: 40000,
  },
  {
    id: "wild-boar", mapName: "야생 멧돼지 땅", region: "페리온",
    levelMin: 25, levelMax: 40,
    monsters: [{ name: "와일드 보어", level: 30, hp: 1500, exp: 75 }],
    expPerHour: 30000,
  },
  {
    id: "stump-dark", mapName: "다크 스텀프 숲", region: "페리온",
    levelMin: 20, levelMax: 30,
    monsters: [{ name: "다크 스텀프", level: 22, hp: 600, exp: 38 }],
    expPerHour: 20000,
  },
  {
    id: "drake-cave", mapName: "드레이크 굴", region: "슬리피우드",
    levelMin: 35, levelMax: 50,
    monsters: [{ name: "드레이크", level: 40, hp: 4000, exp: 160 }],
    expPerHour: 55000,
  },
  {
    id: "ludi-pq", mapName: "루디브리엄 PQ", region: "루디브리엄",
    levelMin: 35, levelMax: 50,
    monsters: [{ name: "PQ 몬스터", level: 40, hp: 3000, exp: 120 }],
    expPerHour: 60000,
  },
  {
    id: "coolie-zombie", mapName: "쿨리 좀비 광산", region: "엘나스",
    levelMin: 50, levelMax: 65,
    monsters: [{ name: "쿨리 좀비", level: 55, hp: 10000, exp: 350 }],
    expPerHour: 90000,
  },
  {
    id: "hector", mapName: "헥터의 영역", region: "리프레",
    levelMin: 55, levelMax: 70,
    monsters: [{ name: "헥터", level: 58, hp: 12000, exp: 400 }],
    expPerHour: 100000,
  },
  {
    id: "ghost-ship", mapName: "유령선 갑판", region: "아쿠아로드",
    levelMin: 60, levelMax: 75,
    monsters: [{ name: "시루프", level: 63, hp: 15000, exp: 500 }],
    expPerHour: 120000,
  },
  {
    id: "goblin-house", mapName: "고블린 하우스", region: "엘나스",
    levelMin: 65, levelMax: 80,
    monsters: [{ name: "고블린", level: 68, hp: 18000, exp: 600 }],
    expPerHour: 140000,
  },
  {
    id: "wolf-spider", mapName: "늑대거미 숲", region: "리프레",
    levelMin: 70, levelMax: 85,
    monsters: [{ name: "늑대거미", level: 75, hp: 25000, exp: 800 }],
    expPerHour: 170000,
  },
  {
    id: "skelegon", mapName: "스켈레곤 둥지", region: "리프레",
    levelMin: 80, levelMax: 100,
    monsters: [{ name: "스켈레곤", level: 85, hp: 35000, exp: 1200 }],
    expPerHour: 200000,
  },
];

function formatNumber(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  return n.toLocaleString();
}

type SortKey = "mesoPerHour" | "expPerHour" | "level" | "efficiency";

export default function MesoCalcPage() {
  const [levelFilter, setLevelFilter] = useState<number>(0);
  const [sortBy, setSortBy] = useState<SortKey>("mesoPerHour");
  const [mesoRate, setMesoRate] = useState<number>(100); // 메소 획득률 (%) - 장비/축복 등

  const spotsWithMeso = useMemo(() => {
    return SPOTS.map((spot) => {
      const baseMeso = estimateMesoPerHour(spot);
      const adjustedMeso = Math.round(baseMeso * (mesoRate / 100));
      return {
        ...spot,
        mesoPerHour: adjustedMeso,
        efficiency: spot.expPerHour > 0 ? adjustedMeso / spot.expPerHour : 0, // 메소/EXP 비율
      };
    });
  }, [mesoRate]);

  const filtered = useMemo(() => {
    let list = spotsWithMeso;
    if (levelFilter > 0) {
      list = list.filter((s) => s.levelMin <= levelFilter && s.levelMax >= levelFilter);
    }
    list.sort((a, b) => {
      switch (sortBy) {
        case "mesoPerHour": return b.mesoPerHour - a.mesoPerHour;
        case "expPerHour": return b.expPerHour - a.expPerHour;
        case "level": return a.levelMin - b.levelMin;
        case "efficiency": return b.efficiency - a.efficiency;
        default: return 0;
      }
    });
    return list;
  }, [spotsWithMeso, levelFilter, sortBy]);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">메소 효율 계산기</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-6">
        사냥터별 예상 메소/경험치 수입을 비교하세요 (추정치 기반)
      </p>

      {/* 필터 영역 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 레벨 필터 */}
          <div>
            <label className="text-sm text-gray-400 block mb-1">내 레벨</label>
            <input
              type="number"
              value={levelFilter || ""}
              onChange={(e) => setLevelFilter(Number(e.target.value) || 0)}
              placeholder="전체"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {/* 메소 획득률 */}
          <div>
            <label className="text-sm text-gray-400 block mb-1">
              메소 획득률 <span className="text-orange-500 font-bold">{mesoRate}%</span>
            </label>
            <input
              type="range"
              min={50}
              max={200}
              step={10}
              value={mesoRate}
              onChange={(e) => setMesoRate(Number(e.target.value))}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>50%</span>
              <span>200%</span>
            </div>
          </div>

          {/* 정렬 */}
          <div>
            <label className="text-sm text-gray-400 block mb-1">정렬</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="mesoPerHour">메소/시간 (높은순)</option>
              <option value="expPerHour">경험치/시간 (높은순)</option>
              <option value="level">레벨 (낮은순)</option>
              <option value="efficiency">메소 효율 (높은순)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 안내 */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 mb-6 text-sm text-yellow-700 dark:text-yellow-300">
        💡 메소 수입은 몬스터 레벨 기반 추정치입니다. 실제 수입은 드롭률, 장비, 사냥 속도에 따라 달라집니다.
      </div>

      {/* 결과 목록 */}
      <div className="space-y-3">
        {filtered.map((spot, idx) => {
          const avgLevel = Math.round(spot.monsters.reduce((s, m) => s + m.level, 0) / spot.monsters.length);
          return (
            <div
              key={spot.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    {idx < 3 && (
                      <span className={`text-sm font-bold ${
                        idx === 0 ? "text-yellow-500" : idx === 1 ? "text-gray-400" : "text-orange-600"
                      }`}>
                        {["🥇", "🥈", "🥉"][idx]}
                      </span>
                    )}
                    <h3 className="font-bold">{spot.mapName}</h3>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {spot.region} · Lv.{spot.levelMin}~{spot.levelMax} · 몬스터 평균 Lv.{avgLevel}
                  </div>
                </div>
              </div>

              {/* 수입 그리드 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-400 mb-1">메소/시간</div>
                  <div className="font-bold text-green-600 dark:text-green-400">{formatNumber(spot.mesoPerHour)}</div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-400 mb-1">경험치/시간</div>
                  <div className="font-bold text-blue-600 dark:text-blue-400">{formatNumber(spot.expPerHour)}</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-400 mb-1">메소 효율</div>
                  <div className="font-bold text-purple-600 dark:text-purple-400">{spot.efficiency.toFixed(2)}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-400 mb-1">몬스터</div>
                  <div className="font-medium text-sm truncate">
                    {spot.monsters.map((m) => m.name).join(", ")}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          해당 레벨의 사냥터가 없습니다
        </div>
      )}
    </div>
  );
}
