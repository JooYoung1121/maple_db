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

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors: Record<string, string> = {
    "필수": "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400",
    "추천": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400",
    "비추천": "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400",
    "일일": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-400",
    "월드이동": "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400",
    "히든": "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400",
    "체인": "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[difficulty] || "bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300"}`}>
      {difficulty}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    "일반": "bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300",
    "반복": "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400",
    "히든": "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400",
    "월드이동": "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400",
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
  const level = quest.level_req || 0;
  const hasRewards = expReward > 0 || mesoReward > 0 || !!quest.item_reward;

  return (
    <div
      className={`relative bg-slate-800/80 border rounded-lg transition-all duration-150 hover:border-orange-500/60 hover:bg-slate-800 ${
        checked
          ? "border-green-700/50 opacity-50"
          : "border-slate-700/80"
      }`}
    >
      {/* Top row: star, level, name, badges, checkbox */}
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
            {quest.name}
          </span>
          {quest.is_chain === 1 && quest.chain_parent && (
            <span className="text-xs text-gray-500 ml-1.5">(체인)</span>
          )}
        </div>

        {/* Difficulty badge */}
        {quest.difficulty && <DifficultyBadge difficulty={quest.difficulty} />}

        {/* Quest type badge (only for non-일반) */}
        {quest.quest_type && quest.quest_type !== "일반" && <TypeBadge type={quest.quest_type} />}

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

        {/* Detail link */}
        <button
          onClick={onClick}
          className="flex-shrink-0 text-xs text-orange-400/70 hover:text-orange-400 transition-colors px-1"
          title="상세 보기"
        >
          Tip
        </button>
      </div>

      {/* Bottom row: area, start location, rewards */}
      <div className="px-3 pb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
        {/* Area */}
        {quest.area && (
          <span>
            <span className="text-gray-500">지역</span>{" "}
            <span className="text-gray-300">{quest.area}</span>
          </span>
        )}

        {/* Start location */}
        {quest.start_location && (
          <span>
            <span className="text-gray-500">시작</span>{" "}
            <span className="text-gray-300">{quest.start_location}</span>
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
                {mesoReward.toLocaleString()} 메소
              </span>
            )}
            {quest.item_reward && (
              <span className="inline-flex items-center gap-0.5 bg-green-900/30 text-green-300 px-1.5 py-0.5 rounded">
                {quest.item_reward}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

export { LevelBadge, DifficultyBadge, TypeBadge };
