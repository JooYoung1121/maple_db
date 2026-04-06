"use client";

import type { Quest } from "@/lib/types";

function LevelBadge({ level }: { level: number }) {
  if (level === 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-500 dark:bg-gray-600/60 dark:text-gray-300">
        Lv.-
      </span>
    );
  }
  let color = "bg-gray-100 text-gray-600 dark:bg-gray-600/60 dark:text-gray-300";
  if (level <= 30) color = "bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-400";
  else if (level <= 70) color = "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-400";
  else if (level <= 120) color = "bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-400";
  else color = "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-400";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${color}`}>
      Lv.{level}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    "일반": "bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300",
    "자동시작": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-400",
    "반복": "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400",
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
  favorited?: boolean;
  onToggleFavorite?: () => void;
}

export default function QuestCard({ quest, onClick, checked, onToggleCheck, favorited, onToggleFavorite }: Props) {
  const expReward = quest.exp_reward || 0;
  const mesoReward = quest.meso_reward || 0;
  const level = quest.level_req || quest.start_level || 0;
  const displayName = quest.name_kr || quest.name;
  const subName = quest.name_kr && quest.name_kr !== quest.name ? quest.name : null;

  const requiredMobs = quest.required_mobs && Array.isArray(quest.required_mobs) ? quest.required_mobs : [];
  const completionItems = quest.completion_items && Array.isArray(quest.completion_items) ? quest.completion_items : [];
  const rewardItems = quest.reward_items && Array.isArray(quest.reward_items) ? quest.reward_items : [];
  const hasConditions = requiredMobs.length > 0 || completionItems.length > 0;
  const hasRewards = expReward > 0 || mesoReward > 0 || rewardItems.length > 0;

  return (
    <div
      className={`relative bg-slate-800/80 border rounded-lg transition-all duration-150 hover:border-orange-500/60 hover:bg-slate-800 ${
        checked
          ? "border-green-700/50 opacity-50"
          : "border-slate-700/80"
      }`}
    >
      {/* Top row: star, level, name, complete checkbox */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Favorite star */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(); }}
          className={`flex-shrink-0 text-lg leading-none transition-colors ${
            favorited ? "text-yellow-400" : "text-slate-600 hover:text-yellow-500"
          }`}
          title={favorited ? "즐겨찾기 해제" : "즐겨찾기"}
        >
          {favorited ? "\u2605" : "\u2606"}
        </button>

        {/* Level badge */}
        <LevelBadge level={level} />

        {/* Quest name - clickable */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } }}
        >
          <span className={`font-semibold text-sm text-gray-100 hover:text-orange-400 transition-colors ${checked ? "line-through opacity-60" : ""}`}>
            {displayName}
          </span>
          {subName && (
            <span className="text-xs text-gray-500 ml-1.5">({subName})</span>
          )}
        </div>

        {/* Quest type badge */}
        {quest.quest_type && <TypeBadge type={quest.quest_type} />}

        {/* Complete checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCheck?.(); }}
          className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            checked
              ? "bg-green-600 border-green-600 text-white"
              : "border-slate-500 hover:border-orange-400"
          }`}
          title={checked ? "완료 취소" : "완료"}
        >
          {checked && (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Tip link */}
        <button
          onClick={onClick}
          className="flex-shrink-0 text-xs text-orange-400/70 hover:text-orange-400 transition-colors px-1"
          title="상세 보기"
        >
          Tip
        </button>
      </div>

      {/* Bottom row: area, NPC, conditions, rewards */}
      <div className="px-3 pb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
        {/* Area */}
        {quest.area && (
          <span>
            <span className="text-gray-500">지역</span>{" "}
            <span className="text-gray-300">{quest.area}</span>
          </span>
        )}

        {/* NPC */}
        {quest.npc_start && (
          <span>
            <span className="text-gray-500">NPC</span>{" "}
            <span className="text-gray-300">{quest.npc_start}</span>
          </span>
        )}

        {/* Conditions */}
        {hasConditions && (
          <span className="flex items-center gap-1.5 flex-wrap">
            <span className="text-gray-500">조건</span>
            {requiredMobs.map((mob, i) => (
              <span key={`mob-${i}`} className="inline-flex items-center gap-0.5 bg-red-900/30 text-red-300 px-1.5 py-0.5 rounded">
                {mob.name || `몹#${mob.id}`} x{mob.count}
              </span>
            ))}
            {completionItems.map((item, i) => (
              <span key={`item-${i}`} className="inline-flex items-center gap-0.5 bg-amber-900/30 text-amber-300 px-1.5 py-0.5 rounded">
                {item.name || `아이템#${item.id}`} x{item.count}
              </span>
            ))}
          </span>
        )}

        {/* Rewards */}
        {hasRewards && (
          <span className="flex items-center gap-1.5 flex-wrap">
            <span className="text-gray-500">보상</span>
            {expReward > 0 && (
              <span className="inline-flex items-center gap-0.5 bg-blue-900/30 text-blue-300 px-1.5 py-0.5 rounded">
                EXP {expReward.toLocaleString()}
              </span>
            )}
            {mesoReward > 0 && (
              <span className="inline-flex items-center gap-0.5 bg-yellow-900/30 text-yellow-300 px-1.5 py-0.5 rounded">
                메소 {mesoReward.toLocaleString()}
              </span>
            )}
            {rewardItems.map((item, i) => (
              <span key={`reward-${i}`} className="inline-flex items-center gap-0.5 bg-green-900/30 text-green-300 px-1.5 py-0.5 rounded">
                {item.name || `아이템#${item.id}`} x{item.count}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

export { LevelBadge, TypeBadge };
