"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getQuest } from "@/lib/api";
import type { Quest } from "@/lib/types";

export default function QuestDetailPage() {
  const { id } = useParams();
  const [quest, setQuest] = useState<Quest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getQuest(Number(id))
      .then((d) => setQuest(d.quest))
      .catch(() => setQuest(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-12 text-gray-400">로딩 중...</div>;
  if (!quest) return <div className="text-center py-12 text-gray-400">퀘스트를 찾을 수 없습니다</div>;

  const rewardsDetail = quest.rewards_detail ?? null;

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/quests" className="text-sm text-orange-500 hover:underline">&larr; 퀘스트 목록</Link>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mt-3">
        <h1 className="text-2xl font-bold">
          {(() => {
            const kr = quest.names_en?.find(n => n.source === "kms");
            return kr ? (
              <>{kr.name_en} <span className="text-lg font-normal text-gray-500 dark:text-gray-400">({quest.name})</span></>
            ) : quest.name;
          })()}
        </h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
          <div><span className="text-sm text-gray-500 dark:text-gray-400">레벨 요구</span><p className="font-medium">{quest.level_req || "-"}</p></div>
          <div><span className="text-sm text-gray-500 dark:text-gray-400">시작 NPC</span><p className="font-medium">{quest.npc_start || "-"}</p></div>
          <div><span className="text-sm text-gray-500 dark:text-gray-400">종료 NPC</span><p className="font-medium">{quest.npc_end || "-"}</p></div>
        </div>
        {quest.description && (
          <div className="mt-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">설명</span>
            <p className="mt-1">{quest.description}</p>
          </div>
        )}
        {rewardsDetail && Object.keys(rewardsDetail).length > 0 ? (
          <div className="mt-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">보상</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {Object.entries(rewardsDetail).map(([k, v]) => (
                <span key={k} className="px-2 py-1 bg-green-50 text-green-700 rounded text-sm font-medium">
                  {k}: {String(v)}
                </span>
              ))}
            </div>
          </div>
        ) : quest.rewards ? (
          <div className="mt-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">보상</span>
            <p className="mt-1 bg-green-50 text-green-700 px-3 py-2 rounded-lg">{quest.rewards}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
