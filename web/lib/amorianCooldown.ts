export const AMORIAN_COOLDOWN_KEY = "maple-amorian-entry-v1";
export const AMORIAN_COOLDOWN_EVENT = "maple-amorian-entry-change";
export const SIX_HOURS = 6 * 60 * 60 * 1000;

export function parseEntry(raw: string | null, now = Date.now()): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 && value <= now ? value : null;
}

export function formatKst(time: number): string {
  return new Date(time).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul", month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}
