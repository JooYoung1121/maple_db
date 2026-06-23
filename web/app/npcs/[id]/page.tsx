"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getNpc } from "@/lib/api";
import type { Npc } from "@/lib/types";

export default function NpcDetailPage() {
  const { id } = useParams();
  const [npc, setNpc] = useState<Npc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getNpc(Number(id))
      .then((d) => setNpc(d.npc))
      .catch(() => setNpc(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-12 text-dim">로딩 중...</div>;
  if (!npc) return <div className="text-center py-12 text-dim">NPC를 찾을 수 없습니다</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/npcs" className="text-sm text-maple hover:underline">&larr; NPC 목록</Link>
      <div className="pixel-panel p-6 mt-3">
        <div className="flex items-start gap-4">
          {npc.icon_url && <img src={npc.icon_url} alt={npc.name} className="w-16 h-16 object-contain" />}
          <div>
            <h1 className="font-pixel text-2xl font-bold">
              {(() => {
                const kr = npc.names_en?.find(n => n.source === "kms");
                return kr ? (
                  <>{kr.name_en} <span className="text-lg font-normal text-dim">({npc.name})</span></>
                ) : npc.name;
              })()}
            </h1>
            {npc.is_shop === 1 && <span className="pixel-badge text-xs bg-yellow-100 text-yellow-700 mt-1 inline-block">상점</span>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div>
            <span className="text-sm text-dim">위치</span>
            <p className="font-medium">
              {npc.map_name ? (
                <Link href={`/maps/${npc.map_id}`} className="text-maple hover:underline">{npc.map_name}</Link>
              ) : "-"}
            </p>
          </div>
          {npc.found_at && (
            <div>
              <span className="text-sm text-dim">발견 위치</span>
              <p className="font-medium">{npc.found_at}</p>
            </div>
          )}
        </div>
        {npc.description && (
          <div className="mt-4">
            <span className="text-sm text-dim">설명</span>
            <p className="mt-1">{npc.description}</p>
          </div>
        )}
        {npc.dialogue && (
          <div className="mt-4">
            <span className="text-sm text-dim">대화</span>
            <p className="mt-1 bg-surface2 border-2 border-edge px-3 py-2 text-sm text-ink whitespace-pre-line">{npc.dialogue}</p>
          </div>
        )}
      </div>

      {npc.related_quests_detail && npc.related_quests_detail.length > 0 && (
        <div className="mt-6">
          <h2 className="font-pixel text-lg font-semibold mb-3">관련 퀘스트</h2>
          <div className="pixel-panel divide-y divide-edge/40">
            {npc.related_quests_detail.map((q) => (
              <Link key={q.id} href={`/quests/${q.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]">
                <span className="font-medium">{q.name}</span>
                {q.level_req > 0 && <span className="text-sm text-dim">Lv. {q.level_req}</span>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
