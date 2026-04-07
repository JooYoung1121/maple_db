"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getQuest } from "@/lib/api";
import type { Quest } from "@/lib/types";
import QuestTabs from "@/components/QuestTabs";
import QuestChain from "@/components/QuestChain";
import { LevelBadge, DifficultyBadge, TypeBadge } from "@/components/QuestCard";

/* -- 정보 행 -- */
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="w-24 flex-shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider pt-0.5">
        {label}
      </span>
      <div className="flex-1 text-sm text-gray-700 dark:text-gray-300">
        {value}
      </div>
    </div>
  );
}

/* -- 사이드바 요약 -- */
function QuestSidebar({ quest }: { quest: Quest }) {
  const expReward = quest.exp_reward || 0;
  const mesoReward = quest.meso_reward || 0;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-3">
      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">빠른 정보</h3>
      <div className="space-y-2.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">레벨</span>
          <LevelBadge level={quest.level_req || 0} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">유형</span>
          {quest.quest_type ? <TypeBadge type={quest.quest_type} /> : <span className="text-gray-400">-</span>}
        </div>
        {quest.difficulty && (
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">난이도</span>
            <DifficultyBadge difficulty={quest.difficulty} />
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">지역</span>
          <span className="text-sm">{quest.area || "-"}</span>
        </div>
        {quest.start_location && (
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">시작 장소</span>
            <span className="text-sm text-right max-w-[140px]">{quest.start_location}</span>
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
          {quest.item_reward && (
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-500 dark:text-gray-400">아이템</span>
              <span className="text-sm text-green-600 dark:text-green-400 text-right max-w-[140px]">{quest.item_reward}</span>
            </div>
          )}
          {!expReward && !mesoReward && !quest.item_reward && (
            <span className="text-xs text-gray-400">보상 정보 없음</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* -- 메인 페이지 -- */
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

  const hasConditions = quest.quest_conditions && quest.quest_conditions.length > 0;
  const hasChain = quest.chain_quests && quest.chain_quests.length > 0;

  /* -- 개요 탭 -- */
  const overviewTab = (
    <div className="space-y-4">
      {/* 기본 정보 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">기본 정보</h3>
        <InfoRow label="ID" value={String(quest.id)} />
        <InfoRow label="레벨" value={String(quest.level_req || 0)} />
        <InfoRow label="지역" value={quest.area || "-"} />
        <InfoRow label="시작 장소" value={quest.start_location || "-"} />
        <InfoRow label="유형" value={quest.quest_type || "일반"} />
        {quest.difficulty && <InfoRow label="난이도" value={quest.difficulty} />}
        {quest.is_chain === 1 && quest.chain_parent && (
          <InfoRow label="체인 부모" value={quest.chain_parent} />
        )}
      </div>

      {/* TIP */}
      {quest.tip && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-2">TIP</h3>
          <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed whitespace-pre-line">
            {quest.tip}
          </p>
        </div>
      )}

      {/* 비고 */}
      {quest.note && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">비고</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
            {quest.note}
          </p>
        </div>
      )}
    </div>
  );

  /* -- 조건/보상 탭 -- */
  const conditionsTab = (
    <div className="space-y-4">
      {/* 퀘스트 조건 */}
      {hasConditions && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">퀘스트 조건</h3>
          <div className="space-y-1.5">
            {quest.quest_conditions!.map((cond, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <span className="text-xs text-gray-400 font-mono w-5 text-right">{i + 1}.</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">{cond}</span>
              </div>
            ))}
          </div>
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
          {quest.item_reward && (
            <div className="px-3 py-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <span className="text-xs text-green-500 font-semibold block mb-1">아이템 보상</span>
              <span className="text-sm text-green-700 dark:text-green-300">{quest.item_reward}</span>
            </div>
          )}
          {quest.extra_reward && (
            <div className="px-3 py-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <span className="text-xs text-purple-500 font-semibold block mb-1">추가 보상</span>
              <span className="text-sm text-purple-700 dark:text-purple-300">{quest.extra_reward}</span>
            </div>
          )}
          {!(quest.exp_reward || 0) && !(quest.meso_reward || 0) && !quest.item_reward && !quest.extra_reward && (
            <p className="text-sm text-gray-400">보상 정보가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );

  /* -- 퀘스트 체인 탭 -- */
  const chainTab = (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-4">퀘스트 체인</h3>
      <QuestChain questId={quest.id} active={chainActive} />
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
          <LevelBadge level={quest.level_req || 0} />
          {quest.quest_type && <TypeBadge type={quest.quest_type} />}
          {quest.difficulty && <DifficultyBadge difficulty={quest.difficulty} />}
          {quest.area && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              {quest.area}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold">
          {quest.name}
        </h1>
        {quest.is_chain === 1 && quest.chain_parent && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">체인: {quest.chain_parent}</p>
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
