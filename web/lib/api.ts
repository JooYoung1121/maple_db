const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  return sp.toString();
}

export async function searchAll(q: string, type?: string, page = 1, perPage = 20) {
  return fetchJSON<{ results: import("./types").SearchResult[]; total: number; page: number; per_page: number }>(
    `/api/search?${qs({ q, type, page, per_page: perPage })}`
  );
}

export async function searchSuggest(q: string, limit = 10) {
  return fetchJSON<{ suggestions: import("./types").SearchSuggestion[] }>(
    `/api/search/suggest?${qs({ q, limit })}`
  );
}

export async function getItems(params: { page?: number; per_page?: number; category?: string; level_min?: number; level_max?: number; job?: string; q?: string; sort?: string } = {}) {
  return fetchJSON<{ items: import("./types").Item[]; total: number; page: number; per_page: number }>(
    `/api/items?${qs(params as Record<string, string | number>)}`
  );
}

export async function getItem(id: number) {
  return fetchJSON<{ item: import("./types").Item; dropped_by: { mob_id: number; mob_name: string; drop_rate: number | null }[] }>(
    `/api/items/${id}`
  );
}

export async function getMobs(params: { page?: number; per_page?: number; level_min?: number; level_max?: number; is_boss?: number; q?: string; sort?: string } = {}) {
  return fetchJSON<{ mobs: import("./types").Mob[]; total: number; page: number; per_page: number }>(
    `/api/mobs?${qs(params as Record<string, string | number>)}`
  );
}

export async function getMob(id: number) {
  return fetchJSON<{ mob: import("./types").Mob; drops: import("./types").MobDrop[]; spawn_maps: import("./types").MobSpawn[] }>(
    `/api/mobs/${id}`
  );
}

export async function getMaps(params: { page?: number; per_page?: number; area?: string; q?: string } = {}) {
  return fetchJSON<{ maps: import("./types").MapData[]; total: number; page: number; per_page: number }>(
    `/api/maps?${qs(params as Record<string, string | number>)}`
  );
}

export async function getMap(id: number) {
  return fetchJSON<{ map: import("./types").MapData; monsters: { mob_id: number; mob_name: string; level: number }[]; npcs: import("./types").Npc[] }>(
    `/api/maps/${id}`
  );
}

export async function getNpcs(params: { page?: number; per_page?: number; q?: string } = {}) {
  return fetchJSON<{ npcs: import("./types").Npc[]; total: number; page: number; per_page: number }>(
    `/api/npcs?${qs(params as Record<string, string | number>)}`
  );
}

export async function getNpc(id: number) {
  return fetchJSON<{ npc: import("./types").Npc }>(`/api/npcs/${id}`);
}

export async function getQuests(params: { page?: number; per_page?: number; level_min?: number; level_max?: number; q?: string } = {}) {
  return fetchJSON<{ quests: import("./types").Quest[]; total: number; page: number; per_page: number }>(
    `/api/quests?${qs(params as Record<string, string | number>)}`
  );
}

export async function getQuest(id: number) {
  return fetchJSON<{ quest: import("./types").Quest }>(`/api/quests/${id}`);
}

export async function getBosses(params: { page?: number; per_page?: number; level_min?: number; level_max?: number; q?: string } = {}) {
  return fetchJSON<{ bosses: import("./types").Boss[]; total: number; page: number; per_page: number }>(
    `/api/bosses?${qs(params as Record<string, string | number>)}`
  );
}

export async function getSkills(params: { page?: number; per_page?: number; job_class?: string; job_branch?: string; skill_type?: string; q?: string } = {}) {
  return fetchJSON<{ skills: import("./types").Skill[]; total: number; page: number; per_page: number }>(
    `/api/skills?${qs(params as Record<string, string | number>)}`
  );
}

export async function getSkill(id: number) {
  return fetchJSON<{ skill: import("./types").Skill }>(`/api/skills/${id}`);
}

export async function getSkillFilters() {
  return fetchJSON<{ job_classes: string[]; job_branches: string[]; skill_types: string[] }>(`/api/skills/filters`);
}

export async function getMobFilters() {
  return fetchJSON<{ level_ranges: { min: number; max: number; count: number }[]; boss_count: number }>(`/api/mobs/filters`);
}

export async function getMapFilters() {
  return fetchJSON<{ areas: string[]; street_names: string[]; town_count: number }>(`/api/maps/filters`);
}

export async function getItemFilters() {
  return fetchJSON<{ categories: string[]; subcategories: string[]; jobs: string[] }>(`/api/items/filters`);
}

export function getExportUrl(type: string) {
  return `${API_BASE}/api/export?type=${type}&format=xlsx`;
}

export async function getAdminStats() {
  return fetchJSON<{
    total_mobs: number;
    hidden_count: number;
    visible_count: number;
    boss_count: number;
    drop_count: number;
    spawn_count: number;
    no_kr_name: number;
  }>(`/api/admin/stats`);
}

export async function getAdminMobs(params: {
  page?: number;
  per_page?: number;
  q?: string;
  is_hidden?: string;
  is_boss?: string;
} = {}) {
  return fetchJSON<{ mobs: import("./types").AdminMob[]; total: number; page: number; per_page: number }>(
    `/api/admin/mobs?${qs(params as Record<string, string | number>)}`
  );
}

export async function patchAdminMob(id: number, body: { is_hidden?: number; is_boss?: number; name_kr?: string }) {
  const res = await fetch(`${API_BASE}/api/admin/mobs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function deleteAdminMob(id: number) {
  const res = await fetch(`${API_BASE}/api/admin/mobs/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getNews(params: {
  board?: string;
  category?: string;
  q?: string;
  page?: number;
  per_page?: number;
} = {}) {
  return fetchJSON<{ posts: import("./types").MapleLandPost[]; total: number; page: number; per_page: number }>(
    `/api/news?${qs(params as Record<string, string | number>)}`
  );
}

export async function getNewsPost(postId: string) {
  return fetchJSON<{ post: import("./types").MapleLandPost }>(`/api/news/${postId}`);
}

export interface GuildMember {
  id: number;
  nickname: string;
  job: string;
  level: number;
  rank: string;
  alias: string | null;
  note: string | null;
  updated_at: string;
}

export async function getGuildMembers(params: { rank?: string; sort?: string; page?: number; per_page?: number } = {}) {
  return fetchJSON<{ members: GuildMember[]; total: number; page: number; per_page: number }>(
    `/api/guild/members?${qs(params as Record<string, string | number>)}`
  );
}

export async function createGuildMember(
  data: { nickname: string; job: string; level: number; rank: string; note?: string },
  password: string
) {
  const res = await fetch(`${API_BASE}/api/guild/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Password": password },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json() as Promise<GuildMember>;
}

export async function updateGuildMember(
  id: number,
  data: Partial<{ nickname: string; job: string; level: number; rank: string; note: string }>,
  password: string
) {
  const res = await fetch(`${API_BASE}/api/guild/members/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Admin-Password": password },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json() as Promise<GuildMember>;
}

export async function updateGuildMemberAlias(id: number, alias: string) {
  const res = await fetch(`${API_BASE}/api/guild/members/${id}/alias`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alias }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json() as Promise<GuildMember>;
}

export async function deleteGuildMember(id: number, password: string) {
  const res = await fetch(`${API_BASE}/api/guild/members/${id}`, {
    method: "DELETE",
    headers: { "X-Admin-Password": password },
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json();
}

export async function getNewsRecentCount(since?: string) {
  return fetchJSON<{ count: number }>(
    `/api/news/recent-count${since ? `?since=${encodeURIComponent(since)}` : ""}`
  );
}
