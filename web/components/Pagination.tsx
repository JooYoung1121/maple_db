"use client";

interface Props {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null;

  const pages: (number | string)[] = [];
  const range = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - range && i <= page + range)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-30 hover:bg-gray-100"
      >
        이전
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`dots-${i}`} className="px-2 text-gray-400">...</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p as number)}
            className={`px-3 py-2 rounded-lg text-sm font-medium ${page === p ? "bg-orange-500 text-white" : "hover:bg-gray-100 text-gray-700"}`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-30 hover:bg-gray-100"
      >
        다음
      </button>
    </div>
  );
}
