"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getQuest } from "@/lib/api";
import type { Quest } from "@/lib/types";
import QuestTabs from "@/components/QuestTabs";
import QuestChain from "@/components/QuestChain";
import { LevelBadge, TypeBadge } from "@/components/QuestCard";

/* ── 보상 아이템 목록 ── */
function RewardItemList({ items }: { items: { id: number; count: number; name?: string | null }[] }) {
  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <Link
          key={i}
          href={`/items/${item.id}`}
          className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {item.name || `아이템 #${item.id}`}
          </span>
          {item.count > 1 && (
            <span className="text-xs text-gray-500">x{item.count}</span>
          )}
        </Link>
      ))}
    </div>
  );
}

/* ── 필요 몬스터 목록 ── */
function RequiredMobList({ mobs }: { mobs: { id: number; count: number; name?: string | null }[] }) {
  return (
    <div className="space-y-1">
      {mobs.map((mob, i) => (
        <Link
          key={i}
          href={`/mobs/${mob.id}`}
          className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {mob.name || `몬스터 #${mob.id}`}
          </span>
          <span className="text-xs text-red-500 font-semibold">{mob.count}마리</span>
        </Link>
      ))}
    </div>
  );
}

/* ── 정보 행 ── */
function InfoRow({ label, value, link }: { label: string; value: React.ReactNode; link?: string }) {
  return (
    <div className="flex items-start py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="w-24 flex-shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider pt-0.5">
        {label}
      </span>
      <div className="flex-1 text-sm text-gray-700 dark:text-gray-300">
        {link ? (
          <Link href={link} className="text-orange-500 hover:underline">
            {value}
          </Link>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

/* ── 사이드바 요약 ── */
function QuestSidebar({ quest }: { quest: Quest }) {
  const expReward = quest.exp_reward || 0;
  const mesoReward = quest.meso_reward || 0;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-3">
      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">빠른 정보</h3>
      <div className="space-y-2.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">레벨</span>
          <LevelBadge level={quest.level_req || quest.start_level || 0} />
        </div>
        {quest.end_level ? (
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">최대 레벨</span>
            <span className="text-sm font-medium">{quest.end_level}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">유형</span>
          {quest.quest_type ? <TypeBadge type={quest.quest_type} /> : <span className="text-gray-400">-</span>}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">지역</span>
          <span className="text-sm">{quest.area || "-"}</span>
        </div>
        {quest.npc_start && (
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">시작 NPC</span>
            {quest.npc_start_id ? (
              <Link href={`/npcs/${quest.npc_start_id}`} className="text-sm text-orange-500 hover:underline">{quest.npc_start}</Link>
            ) : (
              <span className="text-sm">{quest.npc_start}</span>
            )}
          </div>
        )}
        {quest.npc_end && (
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">완료 NPC</span>
            {quest.npc_end_id ? (
              <Link href={`/npcs/${quest.npc_end_id}`} className="text-sm text-orange-500 hover:underline">{quest.npc_end}</Link>
            ) : (
              <span className="text-sm">{quest.npc_end}</span>
            )}
          </div>
        )}
        <div className="border-t border-gray-100 dark:border-gray-700 pt-2.5">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-2">보상</span>
          {expReward > 0 && (
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-500 dark:text-gray-400">EXP</span>
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{expReward.toLocaleString()}</span>
            </div>
          )}
          {mesoReward > 0 && (
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-500 dark:text-gray-400">메소</span>
              <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">{mesoReward.toLocaleString()}</span>
            </div>
          )}
          {!expReward && !mesoReward && (
            <span className="text-xs text-gray-400">보상 정보 없음</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 메인 페이지 ── */
export default function QuestDetailPage() {
  const { id } = useParams();
  const [quest, setQuest] = useState<Quest | null>(null);
  const [loading, setLoading] = useState(true);
  const [chainActive, setChainActive] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getQuest(Number(id))
      .then((d) => setQuest(d.quest))
      .catch(() => setQuest(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-orange-500 rounded-full animate-spin mb-3" />
        <p>로딩 중...</p>
      </div>
    );
  }

  if (!quest) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 text-lg">퀘스트를 찾을 수 없습니다</p>
        <Link href="/quests" className="text-orange-500 hover:underline text-sm mt-2 inline-block">
          퀘스트 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const hasRequiredMobs = quest.required_mobs && quest.required_mobs.length > 0;
  const hasCompletionItems = quest.completion_items && quest.completion_items.length > 0;
  const hasRewardItems = quest.reward_items && quest.reward_items.length > 0;
  const hasPrereqs = quest.prerequisite_quests && quest.prerequisite_quests.length > 0;
  const hasFollowing = quest.following_quests && quest.following_quests.length > 0;

  /* ── 개요 탭 ── */
  const overviewTab = (
    <div className="space-y-4">
      {/* 설명 */}
      {quest.description && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">설명</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
            {quest.description}
          </p>
        </div>
      )}

      {/* 기본 정보 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">기본 정보</h3>
        <InfoRow label="ID" value={String(quest.id)} />
        <InfoRow label="레벨" value={`${quest.level_req || quest.start_level || 0}${quest.end_level ? ` ~ ${quest.end_level}` : ""}`} />
        <InfoRow label="지역" value={quest.area || "-"} />
        <InfoRow label="카테고리" value={quest.category || "-"} />
        <InfoRow label="유형" value={quest.quest_type || "일반"} />
        {quest.npc_start && (
          <InfoRow
            label="시작 NPC"
            value={quest.npc_start}
            link={quest.npc_start_id ? `/npcs/${quest.npc_start_id}` : undefined}
          />
        )}
        {quest.npc_end && (
          <InfoRow
            label="완료 NPC"
            value={quest.npc_end}
            link={quest.npc_end_id ? `/npcs/${quest.npc_end_id}` : undefined}
          />
        )}
        {quest.auto_start ? (
          <InfoRow label="자동시작" value="예" />
        ) : null}
      </div>
    </div>
  );

  /* ── 조건/보상 탭 ── */
  const conditionsTab = (
    <div className="space-y-4">
      {/* 시작 조건 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">시작 조건</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-20">레벨</span>
            <span className="text-sm">{quest.level_req || quest.start_level || 0} 이상</span>
          </div>

          {hasPrereqs && (
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1.5">선행 퀘스트</span>
              <div className="space-y-1">
                {quest.prerequisite_quests!.map((pq, i) => (
                  <Link
                    key={i}
                    href={`/quests/${pq.id}`}
                    className="flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                  >
                    <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-sm text-yellow-800 dark:text-yellow-300">
                      {pq.name || `퀘스트 #${pq.id}`}
                    </span>
                    {pq.level_req ? (
                      <span className="text-xs text-yellow-600 dark:text-yellow-500">Lv.{pq.level_req}</span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {quest.required_items && quest.required_items.length > 0 && (
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1.5">필요 아이템</span>
              <RewardItemList items={quest.required_items} />
            </div>
          )}
        </div>
      </div>

      {/* 완료 조건 */}
      {(hasRequiredMobs || hasCompletionItems) && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">완료 조건</h3>
          {hasRequiredMobs && (
            <div className="mb-3">
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1.5">처치 필요 몬스터</span>
              <RequiredMobList mobs={quest.required_mobs!} />
            </div>
          )}
          {hasCompletionItems && (
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1.5">수집 필요 아이템</span>
              <RewardItemList items={quest.completion_items!} />
            </div>
          )}
        </div>
      )}

      {/* 보상 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">보상</h3>
        <div className="space-y-3">
          {(quest.exp_reward || 0) > 0 && (
            <div className="flex items-center gap-3 px-3 py-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <span className="text-blue-500 font-bold text-lg">EXP</span>
              <span className="text-blue-700 dark:text-blue-300 font-semibold">
                {(quest.exp_reward || 0).toLocaleString()}
              </span>
            </div>
          )}
          {(quest.meso_reward || 0) > 0 && (
            <div className="flex items-center gap-3 px-3 py-2.5 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <span className="text-yellow-500 font-bold text-lg">메소</span>
              <span className="text-yellow-700 dark:text-yellow-300 font-semibold">
                {(quest.meso_reward || 0).toLocaleString()}
              </span>
            </div>
          )}
          {hasRewardItems && (
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1.5">보상 아이템</span>
              <RewardItemList items={quest.reward_items!} />
            </div>
          )}
          {!(quest.exp_reward || 0) && !(quest.meso_reward || 0) && !hasRewardItems && (
            <p className="text-sm text-gray-400">보상 정보가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );

  /* ── 퀘스트 체인 탭 ── */
  const chainTab = (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-4">퀘스트 체인</h3>
      <QuestChain questId={quest.id} active={chainActive} />

      {/* Following quests */}
      {hasFollowing && (
        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">후행 퀘스트</h4>
          <div className="space-y-1">
            {quest.following_quests!.map((fq) => (
              <Link
                key={fq.id}
                href={`/quests/${fq.id}`}
                className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <span className="text-sm">{fq.name}</span>
                {fq.level_req > 0 && <span className="text-xs text-gray-400">Lv.{fq.level_req}</span>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const tabs = [
    { key: "overview", label: "개요", content: overviewTab },
    { key: "conditions", label: "조건/보상", content: conditionsTab },
    { key: "chain", label: "퀘스트 체인", content: chainTab },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <Link href="/quests" className="inline-flex items-center gap-1 text-sm text-orange-500 hover:underline mb-4">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        퀘스트 목록
      </Link>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <LevelBadge level={quest.level_req || quest.start_level || 0} />
          {quest.quest_type && <TypeBadge type={quest.quest_type} />}
          {quest.area && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              {quest.area}
            </span>
          )}
          {quest.category && quest.category !== quest.area && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {quest.category}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold">
          {quest.name}
        </h1>
        {quest.name_kr && quest.name_kr !== quest.name && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{quest.name_kr}</p>
        )}
        {quest.names_en && quest.names_en.length > 0 && (
          <p className="text-sm text-gray-400 mt-0.5">
            {quest.names_en.map((n) => n.name_en).join(" / ")}
          </p>
        )}
      </div>

      {/* Main layout: tabs + sidebar */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tabs - main content */}
        <div className="flex-1 min-w-0">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <QuestTabs tabs={tabs} onTabChange={(key) => { if (key === "chain") setChainActive(true); }} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-72 flex-shrink-0">
          <div className="sticky top-20">
            <QuestSidebar quest={quest} />
          </div>
        </div>
      </div>
    </div>
  );
}
