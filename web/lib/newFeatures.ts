// 새 기능 NEW 배지 — 기능 출시일 기준 14일간 네비/홈에 표시.
// 새 페이지를 출시하면 여기에 한 줄 추가하면 된다 (릴리즈 절차: version.ts + changelog.ts + 필요시 이 파일).
export const NEW_FEATURES: Record<string, string> = {
  "/medals": "2026-07-22",
  "/quest-roadmap": "2026-07-22",
  "/worldcup": "2026-07-22",
  "/codi": "2026-07-22",
  "/versus": "2026-07-24",
};

const NEW_WINDOW_DAYS = 14;

export function isNewFeature(href: string): boolean {
  const added = NEW_FEATURES[href];
  if (!added) return false;
  const diff = Date.now() - new Date(`${added}T00:00:00+09:00`).getTime();
  return diff >= 0 && diff < NEW_WINDOW_DAYS * 24 * 3600 * 1000;
}
