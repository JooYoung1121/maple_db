"use client";
import { useCallback } from "react";
import { useReportWebVitals } from "next/web-vitals";
import { readVitals, VITALS_ENABLED, VITALS_EVENT, VITALS_KEY } from "@/lib/localVitals";

export default function LocalVitalsReporter() {
  useReportWebVitals(useCallback((metric: {id: string; name: string; value: number}) => {
    try {
      if (localStorage.getItem(VITALS_ENABLED) !== '1' || !['INP', 'LCP', 'CLS'].includes(metric.name)) return;
      const rows = readVitals().filter(v => v.id !== metric.id || v.name !== metric.name);
      rows.push({id: metric.id, name: metric.name, value: metric.value, screen: window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop'});
      localStorage.setItem(VITALS_KEY, JSON.stringify(rows.slice(-200)));
      window.dispatchEvent(new Event(VITALS_EVENT));
    } catch { /* Optional diagnostics must not interrupt normal use. */ }
  }, []));
  return null;
}
