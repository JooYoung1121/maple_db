"use client";

import { useState, useMemo } from "react";

// ─── 무기 배율 테이블 ───
const WEAPON_MULTIPLIERS: Record<
  string,
  { mult: number; mainStat: string; subStat: string; type: "melee" | "ranged" | "magic" }
> = {
  "한손검": { mult: 4.0, mainStat: "STR", subStat: "DEX", type: "melee" },
  "두손검": { mult: 4.6, mainStat: "STR", subStat: "DEX", type: "melee" },
  "한손도끼/둔기": { mult: 4.4, mainStat: "STR", subStat: "DEX", type: "melee" },
  "두손도끼/둔기": { mult: 4.8, mainStat: "STR", subStat: "DEX", type: "melee" },
  "창": { mult: 5.0, mainStat: "STR", subStat: "DEX", type: "melee" },
  "폴암": { mult: 5.0, mainStat: "STR", subStat: "DEX", type: "melee" },
  "활": { mult: 3.4, mainStat: "DEX", subStat: "STR", type: "ranged" },
  "석궁": { mult: 3.6, mainStat: "DEX", subStat: "STR", type: "ranged" },
  "단검": { mult: 3.6, mainStat: "LUK", subStat: "STR+DEX", type: "melee" },
  "아대/클로": { mult: 3.6, mainStat: "LUK", subStat: "STR+DEX", type: "melee" },
  "너클": { mult: 4.8, mainStat: "STR", subStat: "DEX", type: "melee" },
  "건": { mult: 3.6, mainStat: "DEX", subStat: "STR", type: "ranged" },
};

// 직업별 무기
const JOB_WEAPONS: Record<string, string[]> = {
  "전사": ["한손검", "두손검", "한손도끼/둔기", "두손도끼/둔기", "창", "폴암"],
  "마법사": [],
  "궁수": ["활", "석궁"],
  "도적": ["단검", "아대/클로"],
  "해적": ["너클", "건"],
};

// ─── 몬스터 데이터 ───
interface Monster {
  name: string;
  level: number;
  hp: number;
  wdef: number;
  mdef: number;
  exp: number;
  map: string;
}

const HUNTING_GROUNDS: Monster[] = [
  // Level 10-30
  { name: "슬라임", level: 6, hp: 50, wdef: 5, mdef: 10, exp: 10, map: "엘리니아 숲" },
  { name: "주황버섯", level: 8, hp: 80, wdef: 0, mdef: 10, exp: 15, map: "헤네시스 사냥터" },
  { name: "리본돼지", level: 10, hp: 120, wdef: 10, mdef: 30, exp: 20, map: "남쪽 숲" },
  // Level 30-50
  { name: "주니어셀리온", level: 33, hp: 1100, wdef: 60, mdef: 80, exp: 65, map: "엘리니아" },
  { name: "주니어페페", level: 35, hp: 1400, wdef: 110, mdef: 100, exp: 75, map: "엘나스" },
  { name: "네펜데스", level: 42, hp: 2100, wdef: 120, mdef: 120, exp: 99, map: "빅토리아" },
  { name: "코퍼드레이크", level: 45, hp: 2700, wdef: 100, mdef: 100, exp: 105, map: "슬리피우드" },
  { name: "드레이크", level: 50, hp: 3200, wdef: 110, mdef: 150, exp: 135, map: "슬리피우드 깊은곳" },
  // Level 50-70
  { name: "주니어예티", level: 50, hp: 3700, wdef: 170, mdef: 180, exp: 135, map: "엘나스 산간" },
  { name: "헥터", level: 55, hp: 4600, wdef: 120, mdef: 120, exp: 170, map: "오르비스" },
  { name: "화이트팽", level: 58, hp: 5800, wdef: 200, mdef: 220, exp: 220, map: "엘나스" },
  { name: "레드드레이크", level: 60, hp: 6000, wdef: 190, mdef: 220, exp: 220, map: "용의 둥지 입구" },
  { name: "버피", level: 61, hp: 7400, wdef: 213, mdef: 213, exp: 230, map: "시계탑" },
  { name: "아이스드레이크", level: 64, hp: 7700, wdef: 200, mdef: 230, exp: 250, map: "엘나스" },
  // Level 70-90
  { name: "예티", level: 65, hp: 11000, wdef: 170, mdef: 245, exp: 346, map: "엘나스" },
  { name: "다크예티", level: 68, hp: 13000, wdef: 190, mdef: 270, exp: 409, map: "엘나스" },
  { name: "타우로마시스", level: 70, hp: 15000, wdef: 250, mdef: 250, exp: 472, map: "미나르숲" },
  { name: "클라크", level: 70, hp: 15000, wdef: 250, mdef: 250, exp: 270, map: "시계탑 최하층" },
  { name: "버푼", level: 74, hp: 16000, wdef: 340, mdef: 340, exp: 340, map: "시계탑" },
  { name: "타우로스피어", level: 75, hp: 18000, wdef: 550, mdef: 400, exp: 567, map: "미나르숲" },
  { name: "다크클라크", level: 76, hp: 18000, wdef: 380, mdef: 380, exp: 370, map: "시계탑" },
  { name: "라이칸스로프", level: 80, hp: 27000, wdef: 650, mdef: 520, exp: 850, map: "엘나스" },
  // Level 90-120
  { name: "해적", level: 83, hp: 30000, wdef: 710, mdef: 710, exp: 1100, map: "시계탑 최하층" },
  { name: "듀얼해적", level: 87, hp: 35000, wdef: 775, mdef: 775, exp: 1500, map: "시계탑 최하층" },
  { name: "블루켄타", level: 88, hp: 37000, wdef: 600, mdef: 600, exp: 1600, map: "리프레" },
  { name: "파이어독", level: 90, hp: 45000, wdef: 835, mdef: 505, exp: 1800, map: "엘나스" },
  { name: "레드드래곤터틀", level: 93, hp: 49000, wdef: 700, mdef: 700, exp: 2100, map: "미나르숲" },
  { name: "레드와이번", level: 97, hp: 53000, wdef: 750, mdef: 750, exp: 2500, map: "리프레" },
  { name: "블루와이번", level: 101, hp: 57000, wdef: 800, mdef: 800, exp: 3050, map: "리프레" },
  { name: "다크와이번", level: 103, hp: 60000, wdef: 850, mdef: 850, exp: 3150, map: "리프레" },
  { name: "스켈레곤", level: 110, hp: 80000, wdef: 900, mdef: 900, exp: 4500, map: "리프레" },
  { name: "스켈로스", level: 113, hp: 85000, wdef: 950, mdef: 950, exp: 4750, map: "리프레" },
];

// ─── 데미지 계산 ───
interface DamageResult {
  maxDmg: number;
  minDmg: number;
  avgDmg: number;
}

function calcPhysicalDamage(
  mainStat: number,
  subStat: number,
  atk: number,
  weaponMult: number,
  mastery: number,
  skillPct: number,
  charLevel: number,
  monLevel: number,
  wdef: number
): DamageResult {
  const D = Math.max(monLevel - charLevel, 0);
  const levelPenalty = 1 - 0.01 * D;
  const maxDmg =
    Math.max(
      ((mainStat * weaponMult + subStat) * (atk / 100) * levelPenalty - wdef * 0.5) *
        (skillPct / 100),
      1
    );
  const minDmg =
    Math.max(
      ((mainStat * weaponMult * 0.9 * mastery + subStat) * (atk / 100) * levelPenalty -
        wdef * 0.6) *
        (skillPct / 100),
      1
    );
  return { maxDmg, minDmg, avgDmg: (maxDmg + minDmg) / 2 };
}

function calcMagicDamage(
  ma: number,
  int_: number,
  mastery: number,
  skillPct: number,
  charLevel: number,
  monLevel: number,
  mdef: number
): DamageResult {
  const D = Math.max(monLevel - charLevel, 0);
  const defMult = 1 + 0.01 * D;
  const maxMagic = ((ma * ma) / 1000 + ma) / 30 + int_ / 200;
  const minMagic = ((ma * ma) / 1000 + ma * 0.9 * mastery) / 30 + int_ / 200;
  const maxDmg = Math.max((maxMagic - mdef * 0.5 * defMult) * (skillPct / 100), 1);
  const minDmg = Math.max((minMagic - mdef * 0.6 * defMult) * (skillPct / 100), 1);
  return { maxDmg, minDmg, avgDmg: (maxDmg + minDmg) / 2 };
}

function calcNHit(hp: number, dmg: DamageResult): { nHitMax: number; nHitAvg: number } {
  const nHitMax = Math.ceil(hp / dmg.maxDmg);
  const nHitAvg = Math.ceil(hp / dmg.avgDmg);
  return { nHitMax, nHitAvg };
}

// 원킬컷 역산: physical ATK
function calcOneKillAtk(
  hp: number,
  mainStat: number,
  subStat: number,
  weaponMult: number,
  skillPct: number,
  charLevel: number,
  monLevel: number,
  wdef: number
): number {
  const D = Math.max(monLevel - charLevel, 0);
  const levelPenalty = 1 - 0.01 * D;
  // hp = ((mainStat * mult + subStat) * atk/100 * levelPenalty - wdef*0.5) * skillPct/100
  // Solve for atk:
  const targetDmg = hp / (skillPct / 100) + wdef * 0.5;
  const baseAtk = targetDmg / (levelPenalty * ((mainStat * weaponMult + subStat) / 100));
  return Math.ceil(baseAtk);
}

// 원킬컷 역산: magic MA
function calcOneKillMa(
  hp: number,
  int_: number,
  skillPct: number,
  charLevel: number,
  monLevel: number,
  mdef: number
): number {
  // max dmg = ((ma^2/1000 + ma)/30 + int/200 - mdef*0.5*defMult) * skillPct/100 >= hp
  const D = Math.max(monLevel - charLevel, 0);
  const defMult = 1 + 0.01 * D;
  const targetBase = hp / (skillPct / 100) + mdef * 0.5 * defMult - int_ / 200;
  // (ma^2/1000 + ma)/30 = targetBase => ma^2/1000 + ma = targetBase*30
  // ma^2/1000 + ma - targetBase*30 = 0
  const a = 1 / 1000;
  const b = 1;
  const c = -(targetBase * 30);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return 0;
  return Math.ceil((-b + Math.sqrt(disc)) / (2 * a));
}

type Tab = "calc" | "hunt";

// ─── 메인 컴포넌트 ───
export default function NHitPage() {
  const [activeTab, setActiveTab] = useState<Tab>("calc");

  // Shared calculator state (lifted so hunt tab can read it)
  const [job, setJob] = useState("전사");
  const [weaponKey, setWeaponKey] = useState("한손검");
  const [isMagic, setIsMagic] = useState(false);

  // Physical inputs
  const [mainStat, setMainStat] = useState(120);
  const [subStat, setSubStat] = useState(50);
  const [atk, setAtk] = useState(80);
  const [mastery, setMastery] = useState(60);

  // Magic inputs
  const [ma, setMa] = useState(200);
  const [int_, setInt] = useState(300);
  const [magicMastery, setMagicMastery] = useState(60);

  // Common
  const [charLevel, setCharLevel] = useState(70);
  const [skillPct, setSkillPct] = useState(100);

  // Monster selection
  const [usePreset, setUsePreset] = useState(true);
  const [selectedMonster, setSelectedMonster] = useState(0);
  const [manualName, setManualName] = useState("커스텀 몬스터");
  const [manualLevel, setManualLevel] = useState(70);
  const [manualHp, setManualHp] = useState(15000);
  const [manualWdef, setManualWdef] = useState(250);
  const [manualMdef, setManualMdef] = useState(250);

  // Derived monster values
  const monster: Monster = usePreset
    ? HUNTING_GROUNDS[selectedMonster]
    : {
        name: manualName,
        level: manualLevel,
        hp: manualHp,
        wdef: manualWdef,
        mdef: manualMdef,
        exp: 0,
        map: "-",
      };

  // Weapon info
  const weaponInfo = WEAPON_MULTIPLIERS[weaponKey];

  // Damage result
  const dmgResult = useMemo<DamageResult>(() => {
    if (isMagic) {
      return calcMagicDamage(
        ma,
        int_,
        magicMastery / 100,
        skillPct,
        charLevel,
        monster.level,
        monster.mdef
      );
    }
    return calcPhysicalDamage(
      mainStat,
      subStat,
      atk,
      weaponInfo?.mult ?? 4.0,
      mastery / 100,
      skillPct,
      charLevel,
      monster.level,
      monster.wdef
    );
  }, [
    isMagic, ma, int_, magicMastery, skillPct, charLevel,
    mainStat, subStat, atk, weaponInfo, mastery, monster,
  ]);

  const { nHitMax, nHitAvg } = calcNHit(monster.hp, dmgResult);

  // Reverse calc
  const oneKillAtk = isMagic
    ? calcOneKillMa(monster.hp, int_, skillPct, charLevel, monster.level, monster.mdef)
    : calcOneKillAtk(
        monster.hp,
        mainStat,
        subStat,
        weaponInfo?.mult ?? 4.0,
        skillPct,
        charLevel,
        monster.level,
        monster.wdef
      );

  const handleJobChange = (newJob: string) => {
    setJob(newJob);
    if (newJob === "마법사") {
      setIsMagic(true);
    } else {
      setIsMagic(false);
      const weapons = JOB_WEAPONS[newJob];
      if (weapons && weapons.length > 0) {
        setWeaponKey(weapons[0]);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">엔방컷 계산기</h1>
      <p className="text-sm text-gray-500 mb-6">
        데미지를 계산하고 몬스터 N방컷을 확인하세요
      </p>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {(
          [
            { key: "calc" as Tab, label: "엔방컷 계산기" },
            { key: "hunt" as Tab, label: "사냥터 추천" },
          ] as const
        ).map((t) => (
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

      {activeTab === "calc" && (
        <CalcTab
          job={job}
          setJob={handleJobChange}
          weaponKey={weaponKey}
          setWeaponKey={setWeaponKey}
          isMagic={isMagic}
          setIsMagic={setIsMagic}
          mainStat={mainStat}
          setMainStat={setMainStat}
          subStat={subStat}
          setSubStat={setSubStat}
          atk={atk}
          setAtk={setAtk}
          mastery={mastery}
          setMastery={setMastery}
          ma={ma}
          setMa={setMa}
          int_={int_}
          setInt={setInt}
          magicMastery={magicMastery}
          setMagicMastery={setMagicMastery}
          charLevel={charLevel}
          setCharLevel={setCharLevel}
          skillPct={skillPct}
          setSkillPct={setSkillPct}
          usePreset={usePreset}
          setUsePreset={setUsePreset}
          selectedMonster={selectedMonster}
          setSelectedMonster={setSelectedMonster}
          manualName={manualName}
          setManualName={setManualName}
          manualLevel={manualLevel}
          setManualLevel={setManualLevel}
          manualHp={manualHp}
          setManualHp={setManualHp}
          manualWdef={manualWdef}
          setManualWdef={setManualWdef}
          manualMdef={manualMdef}
          setManualMdef={setManualMdef}
          monster={monster}
          dmgResult={dmgResult}
          nHitMax={nHitMax}
          nHitAvg={nHitAvg}
          oneKillAtk={oneKillAtk}
        />
      )}
      {activeTab === "hunt" && (
        <HuntTab
          charLevel={charLevel}
          isMagic={isMagic}
          dmgResult={dmgResult}
        />
      )}
    </div>
  );
}

// ─── 계산기 탭 ───
interface CalcTabProps {
  job: string;
  setJob: (v: string) => void;
  weaponKey: string;
  setWeaponKey: (v: string) => void;
  isMagic: boolean;
  setIsMagic: (v: boolean) => void;
  mainStat: number;
  setMainStat: (v: number) => void;
  subStat: number;
  setSubStat: (v: number) => void;
  atk: number;
  setAtk: (v: number) => void;
  mastery: number;
  setMastery: (v: number) => void;
  ma: number;
  setMa: (v: number) => void;
  int_: number;
  setInt: (v: number) => void;
  magicMastery: number;
  setMagicMastery: (v: number) => void;
  charLevel: number;
  setCharLevel: (v: number) => void;
  skillPct: number;
  setSkillPct: (v: number) => void;
  usePreset: boolean;
  setUsePreset: (v: boolean) => void;
  selectedMonster: number;
  setSelectedMonster: (v: number) => void;
  manualName: string;
  setManualName: (v: string) => void;
  manualLevel: number;
  setManualLevel: (v: number) => void;
  manualHp: number;
  setManualHp: (v: number) => void;
  manualWdef: number;
  setManualWdef: (v: number) => void;
  manualMdef: number;
  setManualMdef: (v: number) => void;
  monster: Monster;
  dmgResult: DamageResult;
  nHitMax: number;
  nHitAvg: number;
  oneKillAtk: number;
}

function CalcTab({
  job, setJob, weaponKey, setWeaponKey, isMagic, setIsMagic,
  mainStat, setMainStat, subStat, setSubStat, atk, setAtk,
  mastery, setMastery, ma, setMa, int_, setInt, magicMastery, setMagicMastery,
  charLevel, setCharLevel, skillPct, setSkillPct,
  usePreset, setUsePreset, selectedMonster, setSelectedMonster,
  manualName, setManualName, manualLevel, setManualLevel,
  manualHp, setManualHp, manualWdef, setManualWdef, manualMdef, setManualMdef,
  monster, dmgResult, nHitMax, nHitAvg, oneKillAtk,
}: CalcTabProps) {
  const availableWeapons = JOB_WEAPONS[job] ?? [];

  const nHitColor = (n: number) => {
    if (n === 1) return "text-green-600";
    if (n === 2) return "text-blue-600";
    if (n === 3) return "text-orange-500";
    return "text-red-500";
  };

  const nHitBg = (n: number) => {
    if (n === 1) return "bg-green-50 border-green-200";
    if (n === 2) return "bg-blue-50 border-blue-200";
    if (n === 3) return "bg-orange-50 border-orange-200";
    return "bg-red-50 border-red-200";
  };

  return (
    <div className="space-y-5">
      {/* 캐릭터 설정 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-lg mb-4">캐릭터 설정</h2>

        {/* 직업/무기 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">직업</label>
            <div className="flex gap-1 flex-wrap">
              {["전사", "마법사", "궁수", "도적", "해적"].map((j) => (
                <button
                  key={j}
                  onClick={() => setJob(j)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    job === j
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {j}
                </button>
              ))}
            </div>
          </div>

          {!isMagic && availableWeapons.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">무기 종류</label>
              <select
                value={weaponKey}
                onChange={(e) => setWeaponKey(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              >
                {availableWeapons.map((w) => (
                  <option key={w} value={w}>
                    {w} (배율 {WEAPON_MULTIPLIERS[w].mult})
                  </option>
                ))}
              </select>
            </div>
          )}

          {isMagic && (
            <div className="flex items-end">
              <span className="text-sm text-gray-500 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                마법 데미지 공식 적용 중
              </span>
            </div>
          )}
        </div>

        {/* 스탯 입력 */}
        {!isMagic ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <NumberInput
              label={`주스탯 (${WEAPON_MULTIPLIERS[weaponKey]?.mainStat ?? "STR"})`}
              value={mainStat}
              onChange={setMainStat}
              min={1}
            />
            <NumberInput
              label={`부스탯 (${WEAPON_MULTIPLIERS[weaponKey]?.subStat ?? "DEX"})`}
              value={subStat}
              onChange={setSubStat}
              min={0}
            />
            <NumberInput label="공격력 (ATK)" value={atk} onChange={setAtk} min={1} />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                마스터리 ({mastery}%)
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={mastery}
                onChange={(e) => setMastery(Number(e.target.value))}
                className="w-full accent-orange-500"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <NumberInput label="마력 (MA)" value={ma} onChange={setMa} min={1} />
            <NumberInput label="INT" value={int_} onChange={setInt} min={1} />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                마스터리 ({magicMastery}%)
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={magicMastery}
                onChange={(e) => setMagicMastery(Number(e.target.value))}
                className="w-full accent-orange-500"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
            <div />
          </div>
        )}

        {/* 캐릭터 레벨 & 스킬 % */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <NumberInput label="캐릭터 레벨" value={charLevel} onChange={setCharLevel} min={1} max={200} />
          <NumberInput label="스킬 데미지 (%)" value={skillPct} onChange={setSkillPct} min={1} max={1000} />
        </div>
      </div>

      {/* 몬스터 선택 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">대상 몬스터</h2>
          <div className="flex gap-1">
            <button
              onClick={() => setUsePreset(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                usePreset ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              목록 선택
            </button>
            <button
              onClick={() => setUsePreset(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                !usePreset ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              직접 입력
            </button>
          </div>
        </div>

        {usePreset ? (
          <select
            value={selectedMonster}
            onChange={(e) => setSelectedMonster(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
          >
            {HUNTING_GROUNDS.map((m, i) => (
              <option key={i} value={i}>
                {m.name} (Lv.{m.level} / HP {m.hp.toLocaleString()} / 방어 {m.wdef}/{m.mdef}) — {m.map}
              </option>
            ))}
          </select>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">몬스터 이름</label>
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
            <NumberInput label="레벨" value={manualLevel} onChange={setManualLevel} min={1} max={200} />
            <NumberInput label="HP" value={manualHp} onChange={setManualHp} min={1} />
            <NumberInput label="물리방어 (WDEF)" value={manualWdef} onChange={setManualWdef} min={0} />
            <NumberInput label="마법방어 (MDEF)" value={manualMdef} onChange={setManualMdef} min={0} />
          </div>
        )}

        {/* 선택된 몬스터 정보 */}
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-600">
          <span className="bg-gray-50 rounded-lg px-3 py-1.5">
            <span className="text-gray-400 text-xs mr-1">몬스터</span>
            <span className="font-medium">{monster.name}</span>
          </span>
          <span className="bg-gray-50 rounded-lg px-3 py-1.5">
            <span className="text-gray-400 text-xs mr-1">레벨</span>
            <span className="font-medium">Lv.{monster.level}</span>
          </span>
          <span className="bg-gray-50 rounded-lg px-3 py-1.5">
            <span className="text-gray-400 text-xs mr-1">HP</span>
            <span className="font-medium">{monster.hp.toLocaleString()}</span>
          </span>
          <span className="bg-gray-50 rounded-lg px-3 py-1.5">
            <span className="text-gray-400 text-xs mr-1">물방/마방</span>
            <span className="font-medium">{monster.wdef}/{monster.mdef}</span>
          </span>
          {monster.exp > 0 && (
            <span className="bg-gray-50 rounded-lg px-3 py-1.5">
              <span className="text-gray-400 text-xs mr-1">경험치</span>
              <span className="font-medium">{monster.exp.toLocaleString()}</span>
            </span>
          )}
        </div>
      </div>

      {/* 결과 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-lg mb-4">계산 결과</h2>

        {/* 데미지 */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <ResultCard label="최대 데미지" value={Math.floor(dmgResult.maxDmg).toLocaleString()} />
          <ResultCard label="평균 데미지" value={Math.floor(dmgResult.avgDmg).toLocaleString()} />
          <ResultCard label="최소 데미지" value={Math.floor(dmgResult.minDmg).toLocaleString()} />
        </div>

        {/* N방컷 */}
        <div className={`rounded-xl border p-4 mb-4 ${nHitBg(nHitAvg)}`}>
          <p className="text-sm text-gray-500 mb-1">{monster.name} N방컷</p>
          <p className={`text-3xl font-bold ${nHitColor(nHitAvg)}`}>
            평균 {nHitAvg}방컷
          </p>
          <p className="text-sm text-gray-500 mt-1">
            최대 데미지 기준: {nHitMax}방컷 &nbsp;|&nbsp; 평균 데미지 기준: {nHitAvg}방컷
          </p>
        </div>

        {/* 역산 */}
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">원킬컷 {isMagic ? "마력 (MA)" : "공격력 (ATK)"}</p>
          <p className="text-2xl font-bold text-orange-600">
            {oneKillAtk > 0 ? oneKillAtk.toLocaleString() : "계산 불가"}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {monster.name}을 1방에 잡으려면 필요한 {isMagic ? "마력" : "공격력"}
          </p>
        </div>
      </div>

      {/* 공식 설명 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold mb-3 text-gray-700">데미지 공식 참고</h2>
        {!isMagic ? (
          <div className="text-xs text-gray-500 space-y-1 font-mono bg-gray-50 rounded-lg p-3">
            <p>최대 = (주스탯 × 배율 + 부스탯) × ATK/100 × (1 - 0.01×D) - 물방×0.5) × 스킬%</p>
            <p>최소 = (주스탯 × 배율 × 0.9 × 마스터리 + 부스탯) × ATK/100 × (1 - 0.01×D) - 물방×0.6) × 스킬%</p>
            <p className="text-gray-400">D = max(몬스터레벨 - 캐릭터레벨, 0)</p>
          </div>
        ) : (
          <div className="text-xs text-gray-500 space-y-1 font-mono bg-gray-50 rounded-lg p-3">
            <p>최대마법 = (MA² / 1000 + MA) / 30 + INT / 200</p>
            <p>최소마법 = (MA² / 1000 + MA × 0.9 × 마스터리) / 30 + INT / 200</p>
            <p>실제최대 = (최대마법 - 마방 × 0.5 × (1 + 0.01×D)) × 스킬%</p>
            <p>실제최소 = (최소마법 - 마방 × 0.6 × (1 + 0.01×D)) × 스킬%</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 사냥터 추천 탭 ───
interface HuntTabProps {
  charLevel: number;
  isMagic: boolean;
  dmgResult: DamageResult;
}

interface HuntRow {
  monster: Monster;
  nHitMax: number;
  nHitAvg: number;
  hpExp: number;
  efficiency: number;
}

function HuntTab({ charLevel, isMagic, dmgResult }: HuntTabProps) {
  const [levelRange, setLevelRange] = useState(20);
  const [sortBy, setSortBy] = useState<"efficiency" | "level" | "nhit">("efficiency");

  const rows = useMemo<HuntRow[]>(() => {
    return HUNTING_GROUNDS.filter(
      (m) =>
        m.level >= charLevel - levelRange && m.level <= charLevel + levelRange
    ).map((m) => {
      const def = isMagic ? m.mdef : m.wdef;
      // Recompute with this monster's specific defense
      const adjusted = applyDefense(dmgResult, def, isMagic, m.level, charLevel);
      const { nHitMax, nHitAvg } = calcNHit(m.hp, adjusted);
      const hpExp = m.exp > 0 ? Math.round(m.hp / m.exp) : 9999;
      const efficiency = m.exp > 0 ? Math.round(m.exp / nHitAvg) : 0;
      return { monster: m, nHitMax, nHitAvg, hpExp, efficiency };
    });
  }, [charLevel, levelRange, dmgResult, isMagic]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (sortBy === "efficiency") return copy.sort((a, b) => b.efficiency - a.efficiency);
    if (sortBy === "level") return copy.sort((a, b) => a.monster.level - b.monster.level);
    return copy.sort((a, b) => a.nHitAvg - b.nHitAvg);
  }, [rows, sortBy]);

  const nHitColor = (n: number) => {
    if (n === 1) return "text-green-600 font-bold";
    if (n === 2) return "text-blue-600 font-bold";
    if (n === 3) return "text-orange-500 font-bold";
    return "text-red-500";
  };

  const nHitBadge = (n: number) => {
    if (n === 1) return "bg-green-100 text-green-700";
    if (n === 2) return "bg-blue-100 text-blue-700";
    if (n === 3) return "bg-orange-100 text-orange-700";
    return "bg-red-100 text-red-600";
  };

  return (
    <div className="space-y-5">
      {/* 설정 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-lg mb-4">추천 설정</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              레벨 범위 (캐릭터 레벨 ± {levelRange})
            </label>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={levelRange}
              onChange={(e) => setLevelRange(Number(e.target.value))}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>±5</span>
              <span>±50</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">정렬 기준</label>
            <div className="flex gap-1 flex-wrap">
              {(
                [
                  { key: "efficiency" as const, label: "경험치 효율" },
                  { key: "nhit" as const, label: "N방컷 순" },
                  { key: "level" as const, label: "레벨순" },
                ] as const
              ).map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSortBy(s.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    sortBy === s.key
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          캐릭터 레벨 {charLevel} 기준 · {isMagic ? "마법 데미지" : "물리 데미지"} 적용 ·
          레벨 범위 {charLevel - levelRange}~{charLevel + levelRange}
        </p>
      </div>

      {/* 결과 없음 */}
      {sorted.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">
          해당 레벨 범위에 몬스터가 없습니다. 레벨 범위를 넓혀보세요.
        </div>
      )}

      {/* 추천 하이라이트 */}
      {sorted.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {sorted
              .filter((r) => r.nHitAvg <= 3)
              .slice(0, 3)
              .map((r) => (
                <div
                  key={r.monster.name}
                  className="bg-orange-50 border border-orange-200 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-bold text-gray-800">{r.monster.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${nHitBadge(r.nHitAvg)}`}
                    >
                      {r.nHitAvg}방컷
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">Lv.{r.monster.level} · {r.monster.map}</p>
                  <p className="text-xs text-gray-500">
                    경험치 효율 {r.efficiency.toLocaleString()} exp/타
                  </p>
                </div>
              ))}
          </div>

          {/* 전체 테이블 */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-bold">전체 사냥터 목록</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="text-left px-4 py-2.5 font-medium">몬스터</th>
                    <th className="text-center px-3 py-2.5 font-medium">레벨</th>
                    <th className="text-right px-3 py-2.5 font-medium">HP</th>
                    <th className="text-right px-3 py-2.5 font-medium">방어력</th>
                    <th className="text-right px-3 py-2.5 font-medium">경험치</th>
                    <th className="text-right px-3 py-2.5 font-medium">체경비</th>
                    <th className="text-center px-3 py-2.5 font-medium">N방컷</th>
                    <th className="text-right px-3 py-2.5 font-medium">효율(exp/타)</th>
                    <th className="text-left px-4 py-2.5 font-medium">사냥터</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr
                      key={r.monster.name}
                      className={`border-t border-gray-50 ${
                        r.nHitAvg <= 2 ? "bg-green-50/30" : r.nHitAvg === 3 ? "bg-orange-50/30" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5 font-medium">{r.monster.name}</td>
                      <td className="px-3 py-2.5 text-center text-gray-500">
                        {r.monster.level}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs">
                        {r.monster.hp.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-gray-500">
                        {isMagic ? r.monster.mdef : r.monster.wdef}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs">
                        {r.monster.exp.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-gray-500">
                        {r.hpExp.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-6 rounded text-xs ${nHitBadge(r.nHitAvg)}`}
                        >
                          {r.nHitAvg}방
                        </span>
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono text-xs ${nHitColor(r.nHitAvg)}`}>
                        {r.efficiency.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{r.monster.map}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 범례 */}
          <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-green-400 inline-block" />
              1방컷
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-400 inline-block" />
              2방컷
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-orange-400 inline-block" />
              3방컷
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-red-400 inline-block" />
              4방컷+
            </span>
            <span className="ml-4 text-gray-400">
              체경비 = HP ÷ 경험치 (낮을수록 좋음) · 효율 = 경험치 ÷ N방컷
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// 사냥터 탭에서 각 몬스터별 방어 적용 데미지 재계산 helper
function applyDefense(
  baseDmg: DamageResult,
  def: number,
  isMagic: boolean,
  monLevel: number,
  charLevel: number
): DamageResult {
  // We scale based on defense difference relative to base calculation
  // Since we don't know original def, we just adjust using a simplified approach:
  // Apply defense reduction to the raw (pre-defense) estimated damage.
  // Estimate raw damage by working backward:
  // For the hunt tab we re-derive from base inputs.
  // Instead, use a proportional approach with defense factored in linearly.
  const D = Math.max(monLevel - charLevel, 0);
  if (isMagic) {
    const defMult = 1 + 0.01 * D;
    // Reduce max/min by def difference
    const maxDmg = Math.max(baseDmg.maxDmg - def * 0.5 * defMult, 1);
    const minDmg = Math.max(baseDmg.minDmg - def * 0.6 * defMult, 1);
    return { maxDmg, minDmg, avgDmg: (maxDmg + minDmg) / 2 };
  } else {
    const maxDmg = Math.max(baseDmg.maxDmg - def * 0.5, 1);
    const minDmg = Math.max(baseDmg.minDmg - def * 0.6, 1);
    return { maxDmg, minDmg, avgDmg: (maxDmg + minDmg) / 2 };
  }
}

// ─── 공통 컴포넌트 ───
function NumberInput({
  label,
  value,
  onChange,
  min = 0,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!isNaN(v)) onChange(min !== undefined ? Math.max(min, v) : v);
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
      />
    </div>
  );
}

function ResultCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-lg font-bold text-gray-800">{value}</p>
    </div>
  );
}
