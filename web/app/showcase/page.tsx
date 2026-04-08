"use client";

import { useState, useEffect, useCallback } from "react";

/* ── 타입 ── */
interface ShowcaseImage {
  id: string;
  url: string;
  author: string;
  message: string | null;
  posted_at: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export default function ShowcasePage() {
  const [images, setImages] = useState<ShowcaseImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<ShowcaseImage | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 12;

  // 데이터 로드
  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/showcase?page=${page}&per_page=${perPage}`)
      .then((r) => r.json())
      .then((d) => {
        setImages(d.images || []);
        setTotal(d.total || 0);
      })
      .catch(() => setImages([]))
      .finally(() => setLoading(false));
  }, [page]);

  // 모달 닫기 (ESC)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedImage(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 이전/다음 이미지 (모달)
  const navigate = useCallback(
    (dir: -1 | 1) => {
      if (!selectedImage) return;
      const idx = images.findIndex((i) => i.id === selectedImage.id);
      const next = images[idx + dir];
      if (next) setSelectedImage(next);
    },
    [selectedImage, images]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!selectedImage) return;
      if (e.key === "ArrowLeft") navigate(-1);
      if (e.key === "ArrowRight") navigate(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedImage, navigate]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">캐릭터 자랑</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-6">
        길드원들의 개성 넘치는 코디와 스크린샷 갤러리
      </p>

      {/* Discord 안내 */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💬</span>
          <div>
            <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
              디스코드 #코디자랑 채널에 이미지를 올리면 자동으로 여기에 표시됩니다!
            </p>
            <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
              이미지와 함께 한 줄 설명을 남겨보세요
            </p>
          </div>
        </div>
      </div>

      {/* 갤러리 */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">
          <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          갤러리 로딩 중...
        </div>
      ) : images.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-4">📸</div>
          <p className="text-lg mb-2">아직 등록된 이미지가 없습니다</p>
          <p className="text-sm">디스코드 #코디자랑 채널에 첫 스크린샷을 올려보세요!</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((img) => (
              <button
                key={img.id}
                onClick={() => setSelectedImage(img)}
                className="group relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-orange-400 transition"
              >
                <img
                  src={img.url}
                  alt={img.message || "캐릭터 스크린샷"}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
                {/* 오버레이 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition">
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <div className="text-white text-sm font-medium truncate">{img.author}</div>
                    {img.message && (
                      <div className="text-white/80 text-xs truncate">{img.message}</div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-30 hover:border-orange-400 transition"
              >
                이전
              </button>
              <span className="px-4 py-2 text-sm text-gray-400">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-30 hover:border-orange-400 transition"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}

      {/* 이미지 모달 */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 닫기 */}
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white text-sm"
            >
              ESC로 닫기
            </button>

            {/* 이미지 */}
            <img
              src={selectedImage.url}
              alt={selectedImage.message || ""}
              className="w-full max-h-[80vh] object-contain rounded-xl"
            />

            {/* 정보 */}
            <div className="mt-3 text-center">
              <span className="text-white font-medium">{selectedImage.author}</span>
              {selectedImage.message && (
                <p className="text-white/70 text-sm mt-1">{selectedImage.message}</p>
              )}
              <p className="text-white/40 text-xs mt-1">
                {new Date(selectedImage.posted_at).toLocaleDateString("ko-KR")}
              </p>
            </div>

            {/* 좌우 이동 */}
            <button
              onClick={() => navigate(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition"
            >
              ‹
            </button>
            <button
              onClick={() => navigate(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
