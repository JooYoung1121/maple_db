"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getQuestChain } from "@/lib/api";
import type { QuestChainNode } from "@/lib/types";

interface Props {
  questId: number;
  active?: boolean;
}

export default function QuestChain({ questId, active = true }: Props) {
  const [chain, setChain] = useState<QuestChainNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!active || fetched) return;
    setLoading(true);
    getQuestChain(questId)
      .then((d) => setChain(d.chain))
      .catch(() => setChain([]))
      .finally(() => { setLoading(false); setFetched(true); });
  }, [questId, active, fetched]);

  if (loading) return <div className="text-sm text-gray-400 py-4">체인 로딩 중...</div>;
  if (chain.length <= 1) return <div className="text-sm text-gray-400 py-4">퀘스트 체인 정보가 없습니다.</div>;

  return (
    <div className="space-y-0">
      {chain.map((node, i) => {
        const isCurrent = node.id === questId;
        return (
          <div key={node.id} className="flex items-stretch">
            {/* Timeline connector */}
            <div className="flex flex-col items-center w-8 flex-shrink-0">
              <div className={`w-0.5 flex-1 ${i === 0 ? "bg-transparent" : "bg-gray-300 dark:bg-gray-600"}`} />
              <div
                className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                  isCurrent
                    ? "bg-orange-500 border-orange-500"
                    : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                }`}
              />
              <div className={`w-0.5 flex-1 ${i === chain.length - 1 ? "bg-transparent" : "bg-gray-300 dark:bg-gray-600"}`} />
            </div>

            {/* Quest info */}
            <div className={`flex-1 py-2 pl-3 ${isCurrent ? "" : ""}`}>
              {isCurrent ? (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-2">
                  <span className="font-semibold text-orange-700 dark:text-orange-400 text-sm">{node.name}</span>
                  <span className="text-xs text-orange-500 ml-2">(현재)</span>
                  {node.level_req > 0 && (
                    <span className="text-xs text-orange-400 ml-2">Lv.{node.level_req}</span>
                  )}
                </div>
              ) : (
                <Link
                  href={`/quests/${node.id}`}
                  className="block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 hover:border-orange-400/50 transition-colors"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300 hover:text-orange-500 transition-colors">{node.name}</span>
                  {node.level_req > 0 && (
                    <span className="text-xs text-gray-400 ml-2">Lv.{node.level_req}</span>
                  )}
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
