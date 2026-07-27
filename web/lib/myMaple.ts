export interface MyMapleProfile {
  nickname: string;
  job: string;
  level: number;
  goal: "leveling" | "boss" | "quest" | "meso" | "play";
  favorites: string[];
}

export interface RecentFeature {
  href: string;
  label: string;
  visitedAt: string;
}

export const MY_MAPLE_PROFILE_KEY = "my_maple_profile_v1";
export const MY_MAPLE_RECENT_KEY = "my_maple_recent_v1";
export const MY_MAPLE_UPDATED_EVENT = "my-maple-updated";

export const DEFAULT_MY_MAPLE_PROFILE: MyMapleProfile = {
  nickname: "",
  job: "",
  level: 1,
  goal: "leveling",
  favorites: ["/exp", "/hunt", "/weekly"],
};

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function readMyMapleProfile(): MyMapleProfile {
  return readJSON(MY_MAPLE_PROFILE_KEY, DEFAULT_MY_MAPLE_PROFILE);
}

export function saveMyMapleProfile(profile: MyMapleProfile) {
  window.localStorage.setItem(MY_MAPLE_PROFILE_KEY, JSON.stringify(profile));
  window.dispatchEvent(new Event(MY_MAPLE_UPDATED_EVENT));
}

export function readRecentFeatures(): RecentFeature[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MY_MAPLE_RECENT_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function recordRecentFeature(feature: Omit<RecentFeature, "visitedAt">) {
  const next = [
    { ...feature, visitedAt: new Date().toISOString() },
    ...readRecentFeatures().filter((item) => item.href !== feature.href),
  ].slice(0, 8);
  window.localStorage.setItem(MY_MAPLE_RECENT_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(MY_MAPLE_UPDATED_EVENT));
}

export const GOAL_LABELS: Record<MyMapleProfile["goal"], string> = {
  leveling: "레벨업",
  boss: "보스 준비",
  quest: "퀘스트 정리",
  meso: "메소·장비",
  play: "가볍게 놀기",
};
