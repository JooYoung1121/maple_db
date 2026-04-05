"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";

// ─── 레벨별 필요 경험치 (1~200) ───
// 출처: maplekibun.tistory.com/101 (옛날메이플/메이플랜드 기준)
const EXP_TABLE: number[] = [
  0, // index 0 (unused)
  15, 34, 57, 92, 135, 372, 560, 840, 1242, 1716, // 1-10
  2360, 3216, 4200, 5460, 7050, 8840, 11040, 13716, 16680, 20216, // 11-20
  24402, 28980, 34320, 40512, 47216, 54900, 63666, 73080, 83720, 95700, // 21-30
  108480, 122760, 138666, 155540, 174216, 194832, 216600, 240500, 266682, 294216, // 31-40
  324240, 356916, 391160, 428280, 468450, 510420, 555680, 604416, 655200, 709716, // 41-50
  748608, 789631, 832902, 878545, 926689, 977471, 1031036, 1087536, 1147132, 1209994, // 51-60
  1276301, 1346242, 1420016, 1497832, 1579913, 1666492, 1757815, 1854143, 1955750, 2062925, // 61-70
  2175973, 2295216, 2420993, 2553663, 2693603, 2841212, 2996910, 3161140, 3334370, 3517093, // 71-80
  3709829, 3913127, 4127566, 4353756, 4592341, 4844001, 5109452, 5389449, 5684790, 5996316, // 81-90
  6324914, 6671519, 7037118, 7422752, 7829518, 8258575, 8711144, 9188514, 9692044, 10223168, // 91-100
  10783397, 11374327, 11997640, 12655110, 13348610, 14080113, 14851703, 15665576, 16524049, 17429566, // 101-110
  18384706, 19392187, 20454878, 21575805, 22758159, 24005306, 25320796, 26708375, 28171993, 29715818, // 111-120
  31344244, 33061908, 34873700, 36784778, 38800583, 40926854, 43169645, 45535341, 48030677, 50662758, // 121-130
  53439077, 56367538, 59456479, 62714694, 66151459, 69776558, 73600313, 77633610, 81887931, 86375389, // 131-140
  91108760, 96101520, 101367883, 106922842, 112782213, 118962678, 125481832, 132358236, 139611467, 147262175, // 141-150
  155332142, 163844343, 172823012, 182293713, 192283408, 202820538, 213935103, 225658746, 238024845, 251068606, // 151-160
  264827165, 279339693, 294647508, 310794191, 327825712, 345790561, 364739883, 384727628, 405810702, 428049128, // 161-170
  451506220, 476248760, 502347192, 529875818, 558913012, 589541445, 621848316, 655925603, 691870326, 729784819, // 171-180
  769777027, 811960808, 856456260, 903390063, 952895838, 1005114529, 1060194805, 1118293480, 1179575962, 1244216724, // 181-190
  1312399800, 1384319309, 1460180007, 1540197871, 1624600714, 1713628833, 1807535693, 1906588648, 2011069705, 2121276324, // 191-200
];

// 누적 경험치 계산
function getCumulativeExp(level: number): number {
  let total = 0;
  for (let i = 1; i < level && i < EXP_TABLE.length; i++) {
    total += EXP_TABLE[i];
  }
  return total;
}

function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

function formatExpShort(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}억`;
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}천만`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return formatNumber(n);
}

type Tab = "table" | "hunt" | "goal";

export default function ExpPage() {
  const [activeTab, setActiveTab] = useState<Tab>("hunt");

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">경험치 계산기</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        레벨별 경험치 표, 한타임 사냥 계산기, 목표 레벨 계산
      </p>

      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl w-fit">
        {([
          { key: "hunt" as Tab, label: "한타임 사냥" },
          { key: "goal" as Tab, label: "목표 레벨" },
          { key: "table" as Tab, label: "경험치 표" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.key
                ? "bg-white dark:bg-gray-800 text-orange-600 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "hunt" && <HuntTab />}
      {activeTab === "goal" && <GoalTab />}
      {activeTab === "table" && <TableTab />}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  한타임 사냥 계산기
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface HuntRecord {
  id: string;
  startTime: string;
  endTime: string;
  duration: number; // minutes
  startLevel: number;
  startExpPct: number;
  endLevel: number;
  endExpPct: number;
  expGained: number;
  startMeso: number;
  endMeso: number;
  mesoGained: number;
  startPotionMeso: number;
  endPotionMeso: number;
  potionUsed: number;
  netMeso: number;
}

function HuntTab() {
  // 타이머
  const [timerMinutes, setTimerMinutes] = useState(60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerLeft, setTimerLeft] = useState(0);
  const [timerDone, setTimerDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  // 사냥 전
  const [startLevel, setStartLevel] = useState("");
  const [startExpPct, setStartExpPct] = useState("");
  const [startMeso, setStartMeso] = useState("");
  const [startPotionMeso, setStartPotionMeso] = useState("");

  // 사냥 후
  const [endLevel, setEndLevel] = useState("");
  const [endExpPct, setEndExpPct] = useState("");
  const [endMeso, setEndMeso] = useState("");
  const [endPotionMeso, setEndPotionMeso] = useState("");

  // 기록
  const [records, setRecords] = useState<HuntRecord[]>([]);
  const [showResult, setShowResult] = useState(false);

  // 타이머 로직
  const startTimer = useCallback(() => {
    setTimerLeft(timerMinutes * 60);
    setTimerRunning(true);
    setTimerDone(false);
  }, [timerMinutes]);

  const stopTimer = useCallback(() => {
    setTimerRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (!timerRunning) return;
    timerRef.current = setInterval(() => {
      setTimerLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          setTimerDone(true);
          // 알람 소리
          try {
            const ctx = audioRef.current || new AudioContext();
            audioRef.current = ctx;
            const playBeep = (freq: number, delay: number) => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.value = freq;
              gain.gain.value = 0.3;
              osc.start(ctx.currentTime + delay);
              osc.stop(ctx.currentTime + delay + 0.2);
            };
            playBeep(880, 0);
            playBeep(880, 0.3);
            playBeep(1100, 0.6);
          } catch {
            // silent fallback
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // 경험치 계산
  const calcExpGained = useCallback(() => {
    const sLv = Number(startLevel) || 0;
    const sP = Number(startExpPct) || 0;
    const eLv = Number(endLevel) || 0;
    const eP = Number(endExpPct) || 0;

    if (sLv < 1 || sLv > 200 || eLv < 1 || eLv > 200) return 0;

    // 시작 시점의 절대 경험치
    const startAbsExp = getCumulativeExp(sLv) + Math.floor((EXP_TABLE[sLv] || 0) * sP / 100);
    const endAbsExp = getCumulativeExp(eLv) + Math.floor((EXP_TABLE[eLv] || 0) * eP / 100);

    return endAbsExp - startAbsExp;
  }, [startLevel, startExpPct, endLevel, endExpPct]);

  // 결과 계산
  const calculate = useCallback(() => {
    const expGained = calcExpGained();
    const sMeso = Number(startMeso.replace(/[^0-9]/g, "")) || 0;
    const eMeso = Number(endMeso.replace(/[^0-9]/g, "")) || 0;
    const sPot = Number(startPotionMeso.replace(/[^0-9]/g, "")) || 0;
    const ePot = Number(endPotionMeso.replace(/[^0-9]/g, "")) || 0;

    const mesoGained = eMeso - sMeso;
    const potionUsed = sPot - ePot;
    const netMeso = mesoGained - potionUsed;

    const now = new Date();
    const duration = timerMinutes;

    const record: HuntRecord = {
      id: Date.now().toString(),
      startTime: new Date(now.getTime() - duration * 60000).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      endTime: now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
      duration,
      startLevel: Number(startLevel) || 0,
      startExpPct: Number(startExpPct) || 0,
      endLevel: Number(endLevel) || 0,
      endExpPct: Number(endExpPct) || 0,
      expGained,
      startMeso: sMeso,
      endMeso: eMeso,
      mesoGained,
      startPotionMeso: sPot,
      endPotionMeso: ePot,
      potionUsed,
      netMeso,
    };

    setRecords((prev) => [record, ...prev]);
    setShowResult(true);
  }, [calcExpGained, startMeso, endMeso, startPotionMeso, endPotionMeso, startLevel, startExpPct, endLevel, endExpPct, timerMinutes]);

  const resetForm = () => {
    // 사냥 후 데이터를 사냥 전으로 이동
    setStartLevel(endLevel);
    setStartExpPct(endExpPct);
    setStartMeso(endMeso);
    setStartPotionMeso(endPotionMeso);
    setEndLevel("");
    setEndExpPct("");
    setEndMeso("");
    setEndPotionMeso("");
    setShowResult(false);
    setTimerDone(false);
  };

  const lastRecord = records[0];

  return (
    <div className="space-y-6">
      {/* 타이머 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">사냥 타이머</h2>
          {!timerRunning && !timerDone && (
            <div className="flex items-center gap-2">
              <select
                value={timerMinutes}
                onChange={(e) => setTimerMinutes(Number(e.target.value))}
                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
              >
                <option value={30}>30분</option>
                <option value={60}>1시간</option>
                <option value={90}>1시간 30분</option>
                <option value={120}>2시간</option>
              </select>
            </div>
          )}
        </div>

        <div className="text-center">
          <p
            className={`text-5xl font-mono font-bold mb-4 ${
              timerDone
                ? "text-red-500 animate-pulse"
                : timerRunning
                ? "text-orange-500"
                : "text-gray-300"
            }`}
          >
            {timerRunning || timerDone ? formatTime(timerLeft) : formatTime(timerMinutes * 60)}
          </p>

          {timerDone && (
            <p className="text-red-500 font-medium mb-4 animate-bounce">
              타이머 종료! 사냥 결과를 입력해주세요
            </p>
          )}

          <div className="flex gap-3 justify-center">
            {!timerRunning && !timerDone && (
              <button
                onClick={startTimer}
                className="px-6 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
              >
                시작
              </button>
            )}
            {timerRunning && (
              <button
                onClick={stopTimer}
                className="px-6 py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
              >
                중지
              </button>
            )}
            {timerDone && (
              <button
                onClick={() => setTimerDone(false)}
                className="px-6 py-2.5 bg-gray-200 text-gray-600 dark:text-gray-400 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
              >
                알람 끄기
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 사냥 전/후 입력 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 사냥 전 */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <h3 className="font-bold text-sm text-blue-600 mb-3">사냥 전</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">레벨</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={startLevel}
                  onChange={(e) => setStartLevel(e.target.value)}
                  placeholder="레벨"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">경험치 %</label>
                <input
                  type="number"
                  min={0}
                  max={99.99}
                  step={0.01}
                  value={startExpPct}
                  onChange={(e) => setStartExpPct(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">보유 메소</label>
              <input
                type="text"
                value={startMeso}
                onChange={(e) => setStartMeso(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="메소"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">물약 보유 메소 (약값)</label>
              <input
                type="text"
                value={startPotionMeso}
                onChange={(e) => setStartPotionMeso(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="물약 메소"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
          </div>
        </div>

        {/* 사냥 후 */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <h3 className="font-bold text-sm text-orange-600 mb-3">사냥 후</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">레벨</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={endLevel}
                  onChange={(e) => setEndLevel(e.target.value)}
                  placeholder="레벨"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">경험치 %</label>
                <input
                  type="number"
                  min={0}
                  max={99.99}
                  step={0.01}
                  value={endExpPct}
                  onChange={(e) => setEndExpPct(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">보유 메소</label>
              <input
                type="text"
                value={endMeso}
                onChange={(e) => setEndMeso(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="메소"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">물약 보유 메소 (약값)</label>
              <input
                type="text"
                value={endPotionMeso}
                onChange={(e) => setEndPotionMeso(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="물약 메소"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 계산 버튼 */}
      <div className="flex gap-3 justify-center">
        <button
          onClick={calculate}
          disabled={!startLevel || !endLevel}
          className="px-8 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
        >
          결과 계산
        </button>
        {showResult && (
          <button
            onClick={resetForm}
            className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            다음 타임 준비
          </button>
        )}
      </div>

      {/* 결과 */}
      {showResult && lastRecord && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <h3 className="font-bold text-lg mb-4">사냥 결과</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatCard
              label="획득 경험치"
              value={formatExpShort(lastRecord.expGained)}
              detail={formatNumber(lastRecord.expGained)}
              color="blue"
            />
            <StatCard
              label="획득 메소"
              value={`${formatNumber(lastRecord.mesoGained)}`}
              color="green"
            />
            <StatCard
              label="물약 소비"
              value={`-${formatNumber(lastRecord.potionUsed)}`}
              color="red"
            />
            <StatCard
              label="순수익"
              value={`${formatNumber(lastRecord.netMeso)}`}
              color={lastRecord.netMeso >= 0 ? "orange" : "red"}
              highlight
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">레벨 변화</p>
              <p className="font-bold">
                Lv.{lastRecord.startLevel} ({lastRecord.startExpPct}%) → Lv.{lastRecord.endLevel} ({lastRecord.endExpPct}%)
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">시간당 경험치</p>
              <p className="font-bold">
                {formatExpShort(Math.floor(lastRecord.expGained / (lastRecord.duration / 60)))} /시간
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">시간당 순수익</p>
              <p className="font-bold">
                {formatNumber(Math.floor(lastRecord.netMeso / (lastRecord.duration / 60)))} 메소/시간
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 사냥 기록 */}
      {records.length > 1 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold">사냥 기록</h3>
            <button
              onClick={() => setRecords([])}
              className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-400"
            >
              기록 초기화
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                  <th className="text-left px-4 py-2 font-medium">시간</th>
                  <th className="text-left px-4 py-2 font-medium">레벨</th>
                  <th className="text-right px-4 py-2 font-medium">획득 경험치</th>
                  <th className="text-right px-4 py-2 font-medium">순수익</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-t border-gray-50">
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                      {r.startTime}~{r.endTime}
                    </td>
                    <td className="px-4 py-2">
                      {r.startLevel}→{r.endLevel}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{formatExpShort(r.expGained)}</td>
                    <td
                      className={`px-4 py-2 text-right font-mono ${
                        r.netMeso >= 0 ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      {formatNumber(r.netMeso)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {records.length >= 2 && (
            <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                총 {records.length}타임 · 총 경험치{" "}
                <span className="font-bold text-gray-700 dark:text-gray-300">
                  {formatExpShort(records.reduce((a, r) => a + r.expGained, 0))}
                </span>{" "}
                · 총 순수익{" "}
                <span className="font-bold text-gray-700 dark:text-gray-300">
                  {formatNumber(records.reduce((a, r) => a + r.netMeso, 0))} 메소
                </span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  color,
  highlight,
}: {
  label: string;
  value: string;
  detail?: string;
  color: string;
  highlight?: boolean;
}) {
  const colorMap: Record<string, string> = {
    blue: highlight ? "bg-blue-50 border-blue-200 text-blue-600" : "text-blue-600",
    green: highlight ? "bg-green-50 border-green-200 text-green-600" : "text-green-600",
    red: highlight ? "bg-red-50 border-red-200 text-red-500" : "text-red-500",
    orange: highlight ? "bg-orange-50 border-orange-200 text-orange-600" : "text-orange-600",
  };
  return (
    <div
      className={`rounded-xl p-4 ${
        highlight ? `border ${colorMap[color]}` : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
      }`}
    >
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-lg font-bold font-mono ${colorMap[color]?.split(" ").pop()}`}>
        {value}
      </p>
      {detail && <p className="text-xs text-gray-400 mt-0.5">{detail}</p>}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  목표 레벨 계산기
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function GoalTab() {
  const [currentLevel, setCurrentLevel] = useState("");
  const [currentPct, setCurrentPct] = useState("");
  const [targetLevel, setTargetLevel] = useState("");
  const [expPerHour, setExpPerHour] = useState("");

  const result = useMemo(() => {
    const cLv = Number(currentLevel) || 0;
    const cP = Number(currentPct) || 0;
    const tLv = Number(targetLevel) || 0;
    const eph = Number(expPerHour.replace(/[^0-9]/g, "")) || 0;

    if (cLv < 1 || cLv > 200 || tLv < 1 || tLv > 200 || tLv <= cLv) return null;

    const currentAbs = getCumulativeExp(cLv) + Math.floor((EXP_TABLE[cLv] || 0) * cP / 100);
    const targetAbs = getCumulativeExp(tLv);
    const remaining = targetAbs - currentAbs;
    const hours = eph > 0 ? remaining / eph : 0;

    return { remaining, hours };
  }, [currentLevel, currentPct, targetLevel, expPerHour]);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h2 className="font-bold text-lg mb-4">목표 레벨까지 남은 경험치</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">현재 레벨</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                max={199}
                value={currentLevel}
                onChange={(e) => setCurrentLevel(e.target.value)}
                placeholder="레벨"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
              <input
                type="number"
                min={0}
                max={99.99}
                step={0.01}
                value={currentPct}
                onChange={(e) => setCurrentPct(e.target.value)}
                placeholder="경험치 %"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">목표 레벨</label>
            <input
              type="number"
              min={2}
              max={200}
              value={targetLevel}
              onChange={(e) => setTargetLevel(e.target.value)}
              placeholder="목표 레벨"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              시간당 경험치 (선택 - 예상 소요시간 계산용)
            </label>
            <input
              type="text"
              value={expPerHour}
              onChange={(e) => setExpPerHour(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="한타임 사냥 결과를 참고하세요"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
          </div>
        </div>
      </div>

      {result && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
            <p className="text-xs text-orange-600 mb-1">남은 경험치</p>
            <p className="text-2xl font-bold text-orange-600 font-mono">
              {formatExpShort(result.remaining)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatNumber(result.remaining)} EXP</p>
          </div>
          {result.hours > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <p className="text-xs text-blue-600 mb-1">예상 소요시간</p>
              <p className="text-2xl font-bold text-blue-600 font-mono">
                {result.hours >= 24
                  ? `${Math.floor(result.hours / 24)}일 ${Math.floor(result.hours % 24)}시간`
                  : `${Math.floor(result.hours)}시간 ${Math.floor((result.hours % 1) * 60)}분`}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                약 {Math.ceil(result.hours)}타임 (1시간 기준)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  경험치 표 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function TableTab() {
  const [rangeStart, setRangeStart] = useState(1);
  const [search, setSearch] = useState("");

  const ranges = [
    { start: 1, label: "1~30" },
    { start: 31, label: "31~60" },
    { start: 61, label: "61~90" },
    { start: 91, label: "91~120" },
    { start: 121, label: "121~150" },
    { start: 151, label: "151~180" },
    { start: 181, label: "181~200" },
  ];

  const filteredLevels = useMemo(() => {
    if (search) {
      const s = Number(search);
      if (s >= 1 && s <= 200) return [s];
      return [];
    }
    const end = rangeStart === 181 ? 200 : rangeStart + 29;
    const levels = [];
    for (let i = rangeStart; i <= end && i <= 200; i++) levels.push(i);
    return levels;
  }, [rangeStart, search]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center flex-wrap">
        <input
          type="number"
          min={1}
          max={200}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="레벨 검색"
          className="w-24 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
        />
        {ranges.map((r) => (
          <button
            key={r.start}
            onClick={() => {
              setRangeStart(r.start);
              setSearch("");
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              rangeStart === r.start && !search
                ? "bg-orange-500 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                <th className="text-left px-5 py-2.5 font-medium">레벨</th>
                <th className="text-right px-5 py-2.5 font-medium">필요 경험치</th>
                <th className="text-right px-5 py-2.5 font-medium">누적 경험치</th>
              </tr>
            </thead>
            <tbody>
              {filteredLevels.map((lv) => (
                <tr
                  key={lv}
                  className={`border-t border-gray-50 ${
                    lv % 10 === 0 ? "bg-orange-50/50" : ""
                  }`}
                >
                  <td className="px-5 py-2 font-medium">
                    Lv.{lv}
                    {lv % 30 === 0 && (
                      <span className="text-xs text-orange-500 ml-1">*</span>
                    )}
                  </td>
                  <td className="px-5 py-2 text-right font-mono">
                    {formatNumber(EXP_TABLE[lv] || 0)}
                  </td>
                  <td className="px-5 py-2 text-right font-mono text-gray-500 dark:text-gray-400">
                    {formatNumber(getCumulativeExp(lv))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        출처: maplekibun.tistory.com · 시그너스는 레벨업 시 경험치 10%가 채워집니다
      </p>
    </div>
  );
}
