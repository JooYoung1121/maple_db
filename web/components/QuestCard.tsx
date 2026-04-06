"use client";

import type { Quest } from "@/lib/types";

function LevelBadge({ level }: { level: number }) {
  let color = "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
  if (level > 0 && level <= 30) color = "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400";
  else if (level <= 70) color = "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400";
  else if (level <= 120) color = "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400";
  else if (level > 120) color = "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${color}`}>
      Lv.{level || "?"}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    "일반": "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
    "자동시작": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400",
    "반복": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[type] || colors["일반"]}`}>
      {type}
    </span>
  );
}

interface Props {
  quest: Quest;
  onClick?: () => void;
  checked?: boolean;
  onToggleCheck?: () => void;
}

export default function QuestCard({ quest, onClick, checked, onToggleCheck }: Props) {
  const expReward = quest.exp_reward || 0;
  const mesoReward = quest.meso_reward || 0;
  const hasRewards = expReward > 0 || mesoReward > 0 || (quest.reward_items && quest.reward_items.length > 0);
  const hasPrereq = quest.prerequisite_quests && quest.prerequisite_quests.length > 0;

  return (
    <div
      className={`group relative bg-white dark:bg-gray-800 border rounded-xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-orange-500/5 hover:border-orange-400/50 dark:hover:border-orange-500/40 ${
        checked
          ? "border-green-300 dark:border-green-700 opacity-60"
          : "border-gray-200 dark:border-gray-700"
      }`}
    >
      {/* Checkbox */}
      <div className="absolute top-3 right-3">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCheck?.(); }}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            checked
              ? "bg-green-500 border-green-500 text-white"
              : "border-gray-300 dark:border-gray-600 hover:border-orange-400"
          }`}
          title={checked ? "완료 취소" : "완료 표시"}
        >
          {checked && (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      </div>

      <div
        className="cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } }}
      >
        {/* Header */}
        <div className="flex items-start gap-2 pr-8">
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-sm truncate group-hover:text-orange-500 transition-colors ${checked ? "line-through" : ""}`}>
              {quest.name}
            </h3>
            {quest.name_kr && quest.name_kr !== quest.name && (
              <p className="text-xs text-gray-400 truncate mt-0.5">{quest.name_kr}</p>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          <LevelBadge level={quest.level_req || quest.start_level || 0} />
          {quest.quest_type && <TypeBadge type={quest.quest_type} />}
          {quest.area && quest.area !== "기타" && quest.area !== "기타 지역" && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              {quest.area}
            </span>
          )}
          {hasPrereq && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
              선행퀘 {quest.prerequisite_quests!.length}개
            </span>
          )}
        </div>

        {/* NPC */}
        {(quest.npc_start || quest.npc_end) && (
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
            {quest.npc_start && (
              <span>시작: <span className="text-gray-700 dark:text-gray-300">{quest.npc_start}</span></span>
            )}
            {quest.npc_end && (
              <span>완료: <span className="text-gray-700 dark:text-gray-300">{quest.npc_end}</span></span>
            )}
          </div>
        )}

        {/* Rewards */}
        {hasRewards && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {expReward > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                EXP {expReward.toLocaleString()}
              </span>
            )}
            {mesoReward > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                메소 {mesoReward.toLocaleString()}
              </span>
            )}
            {quest.reward_items && quest.reward_items.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                아이템 {quest.reward_items.length}종
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { LevelBadge, TypeBadge };
