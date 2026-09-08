export function eventPeriodLabel(value: string | null | undefined, fallback = "?"): string {
  if (!value) return fallback;
  if (!value.includes('T') || !Number.isFinite(Date.parse(value))) return value;
  return new Date(value).toLocaleString('ko-KR', {timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false}) + ' KST';
}
