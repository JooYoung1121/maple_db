export const VITALS_ENABLED = "maple-local-vitals-enabled";
export const VITALS_KEY = "maple-local-vitals-v1";
export const VITALS_EVENT = "maple-local-vitals-change";
export interface LocalVital { id: string; name: string; value: number; screen: "mobile" | "desktop"; }

export function readVitals(): LocalVital[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(VITALS_KEY) || "[]");
    return Array.isArray(data) ? data.filter(v => v && typeof v.id === 'string' && ['INP', 'LCP', 'CLS'].includes(v.name) && Number.isFinite(v.value) && ['mobile', 'desktop'].includes(v.screen)).slice(-200) : [];
  } catch { return []; }
}

export function percentile75(values: number[]): number | null {
  if (!values.length) return null;
  return [...values].sort((a, b) => a - b)[Math.ceil(values.length * .75) - 1];
}
