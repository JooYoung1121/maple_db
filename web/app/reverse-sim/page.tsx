"use client";

/* 리버스 시뮬레이터 — /maker 에 탭으로 있던 '리버스 기대값'·'보석 시뮬'을 v4.13.0에서 분리.
 * 수치·확률 가정은 각 컴포넌트에 그대로 (ReverseCraftSimulator: 공개 실측 가정, MakerGemSim: MakerData). */

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMakerData } from "@/lib/api";
import type { MakerData } from "@/lib/types";
import ReverseCraftSimulator from "./ReverseCraftSimulator";
import MakerGemSim from "./MakerGemSim";

type Tab = "reverse" | "gem";

export default function ReverseSimPage() {
  const [tab, setTab] = useState<Tab>("reverse");
  const [data, setData] = useState<MakerData | null>(null);
  const [loading, setLoading] = useState(false);

  // 보석 시뮬 탭을 열 때만 메이커 데이터를 가져온다
  useEffect(() => {
    if (tab !== "gem" || data || loading) return;
    setLoading(true);
    getMakerData()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [tab, data, loading]);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="font-pixel text-xl font-bold text-ink">🔁 리버스 시뮬레이터</h1>
        <p className="text-sm text-dim mt-1">
          리버스 무기 한 자루를 만들 때 촉매 파괴·레벨업 옵션·주문서까지 굴려 기대값과 분포를 보고, 메이커 보석 가공도 시뮬레이션합니다.
          제작 재료·수수료·재료 획득처는 <Link href="/maker" className="text-maple underline">메이커</Link>에서.
        </p>
      </div>

      <div className="flex overflow-x-auto border-2 border-edge">
        {([["reverse", "리버스 기대값"], ["gem", "보석 가공 · 장비 제작 시뮬"]] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 shrink-0 min-w-[6.5rem] py-2.5 text-sm font-bold transition-colors ${
              tab === t ? "pixel-btn font-pixel" : "font-pixel bg-surface text-dim hover:text-maple"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "reverse" && <ReverseCraftSimulator />}
      {tab === "gem" && (
        loading ? (
          <div className="py-10 text-center text-dim">불러오는 중...</div>
        ) : data && data.meta && Array.isArray(data.equipment) && data.equipment.length > 0 ? (
          <>
            <div className="text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300 rounded-lg px-3 py-2">
              ⚠️ {data.meta.note}
            </div>
            <MakerGemSim data={data} />
          </>
        ) : (
          <div className="py-10 text-center text-dim">메이커 데이터를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.</div>
        )
      )}
    </div>
  );
}
