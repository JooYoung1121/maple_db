"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getBossRuns, createBossRun, deleteBossRun,
  getBossRecruits, createBossRecruit, joinBossRecruit, leaveBossRecruit, deleteBossRecruit,
  type BossRun, type BossRecruitment,
} from "@/lib/api";

// ── 보스 상수 ──
// cooldownType:
//   "shared"      → 1트 시작 기준으로 모든 트라이 쿨이 돌아감 (자쿰, 파풀라투스)
//   "independent"  → 각 트라이별로 쿨이 따로 돌아감 (크림슨파퀘)
//   "simple"      → 1트만 가능, 단순 쿨 (혼테일, 피아누스)
type CooldownType = "shared" | "independent" | "simple";

interface BossInfo {
  name: string;
  cooldownHours: number;
  maxTry: number;
  cooldownType: CooldownType;
  note: string;
  timeLabel: string; // 폼에서 시각 입력 라벨
}

const BOSSES: BossInfo[] = [
  { name: "자쿰", cooldownHours: 24, maxTry: 2, cooldownType: "shared", note: "1트 시작 기준 24시간 쿨 (2트 포함)", timeLabel: "1트 시작 시각" },
  { name: "혼테일", cooldownHours: 24, maxTry: 1, cooldownType: "simple", note: "1트만 가능, 24시간 쿨", timeLabel: "클리어 시각" },
  { name: "피아누스", cooldownHours: 168, maxTry: 1, cooldownType: "simple", note: "비늘 수령 시점 기준 7일 쿨 (비늘 소모 후 퀘 재활성화)", timeLabel: "비늘 수령 시각" },
  { name: "파풀라투스", cooldownHours: 24, maxTry: 2, cooldownType: "shared", note: "1트 시작 기준 24시간 쿨 (2트 포함)", timeLabel: "1트 시작 시각" },
  { name: "크림슨파퀘", cooldownHours: 168, maxTry: 2, cooldownType: "independent", note: "1트·2트 각각 개별 1주일 쿨", timeLabel: "입장 시각" },
];

const BOSS_NAMES = BOSSES.map((b) => b.name);

function getBossInfo(name: string): BossInfo {
  return BOSSES.find((b) => b.name === name) ?? BOSSES[0];
}

type Tab = "cooldown" | "recruit" | "drops";

// ── 쿨타임 표시용 가공 ──
interface CooldownEntry {
  ids: number[];           // 소속 run id들 (삭제용)
  bossName: string;
  characterName: string;
  cooldownType: CooldownType;
  // shared: 1트 시간 기준, independent: 해당 트라이 시간, simple: 클리어 시간
  referenceTime: string;
  cooldownHours: number;
  tryLabel: string;        // "1트+2트", "1트", "2트" 등
  note: string;
}

function buildCooldownEntries(runs: BossRun[]): CooldownEntry[] {
  const entries: CooldownEntry[] = [];

  // 캐릭터+보스별로 그룹핑
  const grouped = new Map<string, BossRun[]>();
  for (const r of runs) {
    const key = `${r.character_name}|${r.boss_name}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  for (const [, group] of grouped) {
    const boss = getBossInfo(group[0].boss_name);

    if (boss.cooldownType === "shared") {
      // 자쿰, 파풀: 1트 시간 기준으로 전체 쿨
      const sorted = [...group].sort((a, b) => a.try_number - b.try_number);
      const firstTry = sorted[0];
      const tries = sorted.map((r) => `${r.try_number}트`).join("+");
      entries.push({
        ids: sorted.map((r) => r.id),
        bossName: boss.name,
        characterName: firstTry.character_name,
        cooldownType: boss.cooldownType,
        referenceTime: firstTry.cleared_at, // 1트 시간 기준
        cooldownHours: boss.cooldownHours,
        tryLabel: tries,
        note: boss.note,
      });
    } else if (boss.cooldownType === "independent") {
      // 크림슨파퀘: 각 트라이별 개별 쿨
      for (const r of group) {
        entries.push({
          ids: [r.id],
          bossName: boss.name,
          characterName: r.character_name,
          cooldownType: boss.cooldownType,
          referenceTime: r.cleared_at,
          cooldownHours: boss.cooldownHours,
          tryLabel: `${r.try_number}트`,
          note: boss.note,
        });
      }
    } else {
      // simple (혼테일, 피아누스): 1트만
      for (const r of group) {
        entries.push({
          ids: [r.id],
          bossName: boss.name,
          characterName: r.character_name,
          cooldownType: boss.cooldownType,
          referenceTime: r.cleared_at,
          cooldownHours: boss.cooldownHours,
          tryLabel: `${r.try_number}트`,
          note: boss.note,
        });
      }
    }
  }

  return entries;
}

function getRemainingMs(referenceTime: string, cooldownHours: number): number {
  const ref = new Date(referenceTime).getTime();
  const cooldownMs = cooldownHours * 3600 * 1000;
  return ref + cooldownMs - Date.now();
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "입장 가능";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (d > 0) return `${d}일 ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} 남음`;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} 남음`;
}

export default function BossPage() {
  const [activeTab, setActiveTab] = useState<Tab>("cooldown");

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">보스 관리</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">쿨타이머 · 구인 · 드롭 기록</p>

      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl w-fit">
        {([
          { key: "cooldown" as Tab, label: "쿨타이머" },
          { key: "recruit" as Tab, label: "구인" },
          { key: "drops" as Tab, label: "드롭 기록" },
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

      {activeTab === "cooldown" && <CooldownTab />}
      {activeTab === "recruit" && <RecruitTab />}
      {activeTab === "drops" && <DropsTab />}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  쿨타이머 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function CooldownTab() {
  const [runs, setRuns] = useState<BossRun[]>([]);
  const [filter, setFilter] = useState<string>("전체");
  const [showForm, setShowForm] = useState(false);
  const [, setTick] = useState(0);

  // form
  const [charName, setCharName] = useState("");
  const [bossName, setBossName] = useState(BOSS_NAMES[0]);
  const [tryNum, setTryNum] = useState(1);
  const [clearedAt, setClearedAt] = useState("");

  const selectedBoss = getBossInfo(bossName);

  const load = useCallback(async () => {
    try {
      const params: { boss_name?: string; per_page: number } = { per_page: 100 };
      if (filter !== "전체") params.boss_name = filter;
      const data = await getBossRuns(params);
      setRuns(data.items);
    } catch {}
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // tick every second for countdown
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // 보스 선택 시 트라이 번호 리셋
  useEffect(() => {
    setTryNum(1);
  }, [bossName]);

  const handleAdd = async () => {
    if (!charName.trim() || !clearedAt) return;
    try {
      await createBossRun({ boss_name: bossName, character_name: charName.trim(), try_number: tryNum, cleared_at: clearedAt });
      setCharName(""); setClearedAt(""); setShowForm(false);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "등록 실패");
    }
  };

  const handleDelete = async (ids: number[]) => {
    const pw = prompt("관리자 비밀번호");
    if (!pw) return;
    try {
      for (const id of ids) await deleteBossRun(id, pw);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  // 쿨타임 엔트리 가공
  const entries = buildCooldownEntries(runs);
  const active = entries.filter((e) => getRemainingMs(e.referenceTime, e.cooldownHours) > 0);
  const expired = entries.filter((e) => getRemainingMs(e.referenceTime, e.cooldownHours) <= 0);

  return (
    <div className="space-y-4">
      {/* 보스별 쿨 규칙 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-1">
        <p className="text-xs font-semibold text-blue-700 mb-1">보스별 쿨타임 규칙</p>
        {BOSSES.map((b) => (
          <p key={b.name} className="text-xs text-blue-600">
            <span className="font-medium">{b.name}</span>: {b.note}
          </p>
        ))}
      </div>

      {/* Boss filter */}
      <div className="flex gap-1 flex-wrap">
        {["전체", ...BOSS_NAMES].map((b) => (
          <button
            key={b}
            onClick={() => setFilter(b)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === b ? "bg-orange-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {/* Add button */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
      >
        {showForm ? "취소" : "쿨 등록"}
      </button>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">캐릭터명</label>
              <input
                type="text"
                value={charName}
                onChange={(e) => setCharName(e.target.value)}
                placeholder="캐릭터명"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">보스</label>
              <select
                value={bossName}
                onChange={(e) => setBossName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              >
                {BOSS_NAMES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            {selectedBoss.maxTry > 1 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">트라이</label>
                <select
                  value={tryNum}
                  onChange={(e) => setTryNum(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                >
                  {Array.from({ length: selectedBoss.maxTry }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}트</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{selectedBoss.timeLabel}</label>
              <input
                type="datetime-local"
                value={clearedAt}
                onChange={(e) => setClearedAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
          </div>
          {/* 보스별 안내 메시지 */}
          <p className="text-xs text-gray-400">{selectedBoss.note}</p>
          <button
            onClick={handleAdd}
            disabled={!charName.trim() || !clearedAt}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            등록
          </button>
        </div>
      )}

      {/* Active cooldowns */}
      {active.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                  <th className="text-left px-4 py-2.5 font-medium">캐릭터</th>
                  <th className="text-left px-4 py-2.5 font-medium">보스</th>
                  <th className="text-center px-4 py-2.5 font-medium">트라이</th>
                  <th className="text-left px-4 py-2.5 font-medium">기준 시각</th>
                  <th className="text-center px-4 py-2.5 font-medium">상태</th>
                  <th className="px-2 py-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {active.map((e, i) => {
                  const remaining = getRemainingMs(e.referenceTime, e.cooldownHours);
                  return (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="px-4 py-2 font-medium">{e.characterName}</td>
                      <td className="px-4 py-2">{e.bossName}</td>
                      <td className="px-4 py-2 text-center">{e.tryLabel}</td>
                      <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">{e.referenceTime}</td>
                      <td className="px-4 py-2 text-center">
                        <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 border border-red-200">
                          {formatCountdown(remaining)}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <button onClick={() => handleDelete(e.ids)} className="text-gray-300 hover:text-red-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expired */}
      {expired.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden opacity-60">
          <div className="px-4 py-2 border-b border-gray-100 text-xs font-medium text-gray-400">만료된 쿨타임</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {expired.map((e, i) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="px-4 py-2 font-medium">{e.characterName}</td>
                    <td className="px-4 py-2">{e.bossName}</td>
                    <td className="px-4 py-2 text-center">{e.tryLabel}</td>
                    <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">{e.referenceTime}</td>
                    <td className="px-4 py-2 text-center">
                      <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 border border-green-200">
                        입장 가능
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <button onClick={() => handleDelete(e.ids)} className="text-gray-300 hover:text-red-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <div className="text-center py-12 text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
          등록된 쿨타임이 없습니다
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  구인 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function RecruitTab() {
  const [recruits, setRecruits] = useState<BossRecruitment[]>([]);
  const [showForm, setShowForm] = useState(false);

  // form
  const [boss, setBoss] = useState(BOSS_NAMES[0]);
  const [author, setAuthor] = useState("");
  const [message, setMessage] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [maxMembers, setMaxMembers] = useState(6);

  const load = useCallback(async () => {
    try {
      const data = await getBossRecruits({ per_page: 50 });
      setRecruits(data.items);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!author.trim()) return;
    try {
      await createBossRecruit({
        boss_name: boss, author: author.trim(), message: message || undefined,
        scheduled_at: scheduledAt || undefined, max_members: maxMembers,
      });
      setAuthor(""); setMessage(""); setScheduledAt(""); setShowForm(false);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "작성 실패");
    }
  };

  const handleJoin = async (id: number) => {
    const nick = prompt("참가할 닉네임을 입력하세요");
    if (!nick) return;
    try {
      await joinBossRecruit(id, nick);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "참가 실패");
    }
  };

  const handleLeave = async (id: number) => {
    const nick = prompt("취소할 닉네임을 입력하세요");
    if (!nick) return;
    try {
      await leaveBossRecruit(id, nick);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "취소 실패");
    }
  };

  const handleDelete = async (id: number) => {
    const pw = prompt("관리자 비밀번호");
    if (!pw) return;
    try {
      await deleteBossRecruit(id, pw);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowForm(!showForm)}
        className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
      >
        {showForm ? "취소" : "구인 작성"}
      </button>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">보스</label>
              <select
                value={boss}
                onChange={(e) => setBoss(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              >
                {BOSS_NAMES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">작성자 닉네임</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="닉네임"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">예정 시각</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">최대 인원 (2~6)</label>
              <input
                type="number"
                min={2}
                max={6}
                value={maxMembers}
                onChange={(e) => setMaxMembers(Math.max(2, Math.min(6, Number(e.target.value))))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">메시지</label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="예: 비숍 1명 구합니다"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={!author.trim()}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            작성
          </button>
        </div>
      )}

      {/* Recruit cards */}
      <div className="space-y-3">
        {recruits.map((r) => {
          const participants: string[] = JSON.parse(r.participants_json || "[]");
          const isClosed = r.status === "closed";
          return (
            <div key={r.id} className={`bg-white dark:bg-gray-800 border rounded-xl p-5 ${isClosed ? "border-gray-300 dark:border-gray-600 opacity-70" : "border-gray-200 dark:border-gray-700"}`}>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-bold text-lg">{r.boss_name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isClosed ? "bg-red-100 text-red-700 border border-red-200" : "bg-green-100 text-green-700 border border-green-200"
                }`}>
                  {isClosed ? "마감" : "모집중"}
                </span>
                {r.scheduled_at && (
                  <span className="text-xs text-gray-400 ml-auto">{r.scheduled_at}</span>
                )}
              </div>
              {r.message && <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{r.message}</p>}
              <p className="text-xs text-gray-400 mb-3">작성자: {r.author}</p>

              {/* Participant slots */}
              <div className="flex gap-2 flex-wrap mb-3">
                {Array.from({ length: r.max_members }).map((_, i) => (
                  <div
                    key={i}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                      participants[i]
                        ? "bg-orange-100 text-orange-700 border border-orange-200"
                        : "bg-gray-50 dark:bg-gray-900 text-gray-300 border border-dashed border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    {participants[i] || "빈 슬롯"}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mb-3">{participants.length}/{r.max_members}명</p>

              <div className="flex gap-2">
                {!isClosed && (
                  <button
                    onClick={() => handleJoin(r.id)}
                    className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors"
                  >
                    참가
                  </button>
                )}
                <button
                  onClick={() => handleLeave(r.id)}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                >
                  참가 취소
                </button>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-red-500 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors ml-auto"
                >
                  삭제
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {recruits.length === 0 && (
        <div className="text-center py-12 text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
          구인글이 없습니다
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  드롭 기록 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function DropsTab() {
  const [runs, setRuns] = useState<BossRun[]>([]);
  const [filter, setFilter] = useState<string>("전체");
  const [showForm, setShowForm] = useState(false);

  // form
  const [charName, setCharName] = useState("");
  const [bossName, setBossName] = useState(BOSS_NAMES[0]);
  const [tryNum, setTryNum] = useState(1);
  const [clearedAt, setClearedAt] = useState("");
  const [drops, setDrops] = useState("");
  const [note, setNote] = useState("");

  const selectedBoss = getBossInfo(bossName);

  const load = useCallback(async () => {
    try {
      const params: { boss_name?: string; per_page: number } = { per_page: 100 };
      if (filter !== "전체") params.boss_name = filter;
      const data = await getBossRuns(params);
      // show only runs that have drops
      setRuns(data.items.filter((r) => r.drops && r.drops !== "[]" && r.drops !== ""));
    } catch {}
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!charName.trim() || !clearedAt) return;
    const dropsJson = drops.trim()
      ? JSON.stringify(drops.split(",").map((d) => d.trim()).filter(Boolean))
      : undefined;
    try {
      await createBossRun({
        boss_name: bossName, character_name: charName.trim(), try_number: tryNum,
        cleared_at: clearedAt, drops: dropsJson, note: note || undefined,
      });
      setCharName(""); setClearedAt(""); setDrops(""); setNote(""); setShowForm(false);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "등록 실패");
    }
  };

  const handleDelete = async (id: number) => {
    const pw = prompt("관리자 비밀번호");
    if (!pw) return;
    try {
      await deleteBossRun(id, pw);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  function parseDrops(d: string | null): string[] {
    if (!d) return [];
    try { return JSON.parse(d); } catch { return []; }
  }

  return (
    <div className="space-y-4">
      {/* Boss filter */}
      <div className="flex gap-1 flex-wrap">
        {["전체", ...BOSS_NAMES].map((b) => (
          <button
            key={b}
            onClick={() => setFilter(b)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === b ? "bg-orange-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      <button
        onClick={() => setShowForm(!showForm)}
        className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
      >
        {showForm ? "취소" : "기록 추가"}
      </button>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">보스</label>
              <select
                value={bossName}
                onChange={(e) => setBossName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              >
                {BOSS_NAMES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">캐릭터명</label>
              <input
                type="text"
                value={charName}
                onChange={(e) => setCharName(e.target.value)}
                placeholder="캐릭터명"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
            {selectedBoss.maxTry > 1 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">트라이</label>
                <select
                  value={tryNum}
                  onChange={(e) => setTryNum(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                >
                  {Array.from({ length: selectedBoss.maxTry }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}트</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">날짜/시각</label>
              <input
                type="datetime-local"
                value={clearedAt}
                onChange={(e) => setClearedAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">드롭 아이템 (콤마 구분)</label>
            <input
              type="text"
              value={drops}
              onChange={(e) => setDrops(e.target.value)}
              placeholder="예: 자쿰 투구, 혼수 목걸이"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">메모</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="메모 (선택)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={!charName.trim() || !clearedAt}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            추가
          </button>
        </div>
      )}

      {/* Drops table */}
      {runs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                  <th className="text-left px-4 py-2.5 font-medium">날짜</th>
                  <th className="text-left px-4 py-2.5 font-medium">보스</th>
                  <th className="text-left px-4 py-2.5 font-medium">캐릭터</th>
                  <th className="text-center px-4 py-2.5 font-medium">트라이</th>
                  <th className="text-left px-4 py-2.5 font-medium">드롭</th>
                  <th className="text-left px-4 py-2.5 font-medium">메모</th>
                  <th className="px-2 py-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-gray-50">
                    <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">{r.cleared_at?.slice(0, 10)}</td>
                    <td className="px-4 py-2">{r.boss_name}</td>
                    <td className="px-4 py-2 font-medium">{r.character_name}</td>
                    <td className="px-4 py-2 text-center">{r.try_number}트</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1 flex-wrap">
                        {parseDrops(r.drops).map((d, i) => (
                          <span key={i} className="inline-block text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                            {d}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">{r.note || "-"}</td>
                    <td className="px-2 py-2">
                      <button onClick={() => handleDelete(r.id)} className="text-gray-300 hover:text-red-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {runs.length === 0 && (
        <div className="text-center py-12 text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
          드롭 기록이 없습니다
        </div>
      )}
    </div>
  );
}
