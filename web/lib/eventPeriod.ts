const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function eventPeriodLabel(value: string | null | undefined, fallback = "?"): string {
  if (!value) return fallback;
  if (!value.includes('T') || !Number.isFinite(Date.parse(value))) return value;
  return new Date(value).toLocaleString('ko-KR', {timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false}) + ' KST';
}

/**
 * 종료 시각 → 실제 마감 Date. 백엔드 effective_event 와 같은 규칙:
 * ISO(시각 포함)는 그 시각, 날짜만 있으면 그날 하루를 포함해 다음날 0시 KST.
 * 공식 공지의 "10월 30일 0시까지"는 날짜만으로 쓰면 하루 늦어지므로 ISO 로 저장해야 한다.
 */
export function eventDeadline(value: string | null | undefined): Date | null {
  if (!value) return null;
  if (value.includes("T")) {
    const t = Date.parse(value);
    return Number.isFinite(t) ? new Date(t) : null;
  }
  const t = Date.parse(`${value}T00:00:00+09:00`);
  return Number.isFinite(t) ? new Date(t + DAY_MS) : null;
}

/** KST 기준 날짜 번호 — 날짜 차이 계산용. */
function kstDayIndex(ms: number): number {
  return Math.floor((ms + KST_OFFSET_MS) / DAY_MS);
}

function kstParts(ms: number) {
  const d = new Date(ms + KST_OFFSET_MS);
  return { m: d.getUTCMonth() + 1, d: d.getUTCDate(), w: WEEKDAYS[d.getUTCDay()], h: d.getUTCHours(), min: d.getUTCMinutes() };
}

/**
 * 마감 표기 — "11/14(토) 0시 (11/13까지)"처럼 공지 표기와 실제 마지막 날을 함께 보여준다.
 * 0시 마감은 전날이 마지막 날이라 헷갈리기 쉬워서 마지막 날을 덧붙인다.
 */
export function deadlineLabel(value: string | null | undefined): string | null {
  const deadline = eventDeadline(value);
  if (!deadline) return value ?? null;
  const p = kstParts(deadline.getTime());
  const time = p.min ? `${p.h}:${String(p.min).padStart(2, "0")}` : `${p.h}시`;
  const base = `${p.m}/${p.d}(${p.w}) ${time}`;
  if (p.h === 0 && p.min === 0) {
    const last = kstParts(deadline.getTime() - 1);
    return `${base} (${last.m}/${last.d}까지)`;
  }
  return base;
}

/** 남은 기간 배지 — 마감이 지났으면 null. 마지막 날 기준 D-n, 24시간 이내면 시간 단위. */
export function dDayLabel(value: string | null | undefined, now: number = Date.now()): string | null {
  const deadline = eventDeadline(value);
  if (!deadline) return null;
  const end = deadline.getTime();
  if (end <= now) return null;
  const hours = (end - now) / (60 * 60 * 1000);
  if (hours < 24) return hours < 1 ? "1시간 내 마감" : `${Math.floor(hours)}시간 남음`;
  const days = kstDayIndex(end - 1) - kstDayIndex(now);
  return days <= 0 ? "D-DAY" : `D-${days}`;
}
