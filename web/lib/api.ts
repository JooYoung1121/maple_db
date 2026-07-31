const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function fetchJSON<T>(path: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, headers ? { headers } : undefined);
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

export async function searchSuggest(q: string, limit = 10, type?: string) {
  return fetchJSON<{ suggestions: import("./types").SearchSuggestion[] }>(
    `/api/search/suggest?${qs({ q, limit, type })}`
  );
}

export async function getItems(params: { page?: number; per_page?: number; category?: string; subcategory?: string; level_min?: number; level_max?: number; job?: string; q?: string; sort?: string } = {}) {
  return fetchJSON<{ items: import("./types").Item[]; total: number; page: number; per_page: number }>(
    `/api/items?${qs(params as Record<string, string | number>)}`
  );
}

export async function getItem(id: number) {
  return fetchJSON<{ item: import("./types").Item; dropped_by: {
    mob_id: number;
    mob_name: string;
    mob_name_kr?: string | null;
    drop_rate: number | null;
    spawn_maps?: { map_id: number; map_name: string; map_name_kr?: string | null; spawn_name?: string | null }[];
  }[] }>(
    `/api/items/${id}`
  );
}

export async function getMobs(params: { page?: number; per_page?: number; level_min?: number; level_max?: number; is_boss?: number; q?: string; sort?: string } = {}) {
  return fetchJSON<{ mobs: import("./types").Mob[]; total: number; page: number; per_page: number }>(
    `/api/mobs?${qs(params as Record<string, string | number>)}`
  );
}

export async function getNhitMobPresets(params: { q?: string; include_boss?: number; mapleland_only?: number; require_korean_name?: number; level_min?: number; level_max?: number; limit?: number } = {}) {
  return fetchJSON<{ mobs: import("./types").NHitMobPreset[]; total: number }>(
    `/api/mobs/nhit-presets?${qs(params as Record<string, string | number>)}`
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
  return fetchJSON<{
    map: import("./types").MapData;
    monsters: import("./types").MapMobSpawn[];
    npcs: import("./types").Npc[];
    detail: import("./types").MapDetailData | null;
    drops: import("./types").MapDrop[];
  }>(`/api/maps/${id}`);
}

export async function getNpcs(params: { page?: number; per_page?: number; q?: string } = {}) {
  return fetchJSON<{ npcs: import("./types").Npc[]; total: number; page: number; per_page: number }>(
    `/api/npcs?${qs(params as Record<string, string | number>)}`
  );
}

export async function getNpc(id: number) {
  return fetchJSON<{ npc: import("./types").Npc }>(`/api/npcs/${id}`);
}

export async function getQuests(params: {
  page?: number; per_page?: number; level_min?: number; level_max?: number;
  q?: string; area?: string; quest_type?: string; difficulty?: string;
  has_rewards?: number; sort?: string;
} = {}) {
  return fetchJSON<{ quests: import("./types").Quest[]; total: number; page: number; per_page: number }>(
    `/api/quests?${qs(params as Record<string, string | number>)}`
  );
}

export async function getQuest(id: number) {
  return fetchJSON<{ quest: import("./types").Quest }>(`/api/quests/${id}`);
}

export async function getQuestCategories() {
  return fetchJSON<{ areas: string[]; quest_types: string[]; difficulties: string[] }>(`/api/quests/categories`);
}

export async function getQuestChain(id: number) {
  return fetchJSON<{ chain: import("./types").QuestChainNode[]; quest_id: number }>(`/api/quests/${id}/chain`);
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

export interface RoadmapQuest {
  quest_id: number;
  name: string;
  repeatable: number;
  min_level: number;
  max_level: number | null;
  req_meso: number;
  jobs: string | null;
  start_npc: string | null;
  end_npc: string | null;
  exp: number;
  meso: number;
  fame: number;
  prereq: [number | null, string][];
  next: [number | null, string][];
  requirements: { type: string | null; id: number | null; name: string; raw: string }[];
  rewards: { type: string | null; id: number | null; name: string; raw: string }[];
  cur_tip: string | null;
  cur_category: string | null;
  cur_area: string | null;
  cur_difficulty: string | null;
  has_skillbook: boolean;
}

export async function getQuestRoadmap() {
  return fetchJSON<{ quests: RoadmapQuest[] }>(`/api/quests/roadmap/all`);
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

export async function getAdminStats(pw: string) {
  return fetchJSON<{
    total_mobs: number;
    hidden_count: number;
    visible_count: number;
    boss_count: number;
    drop_count: number;
    spawn_count: number;
    no_kr_name: number;
  }>(`/api/admin/stats`, { "X-Admin-Password": pw });
}

export async function getAdminMobs(pw: string, params: {
  page?: number;
  per_page?: number;
  q?: string;
  is_hidden?: string;
  is_boss?: string;
} = {}) {
  return fetchJSON<{ mobs: import("./types").AdminMob[]; total: number; page: number; per_page: number }>(
    `/api/admin/mobs?${qs(params as Record<string, string | number>)}`,
    { "X-Admin-Password": pw }
  );
}

export async function patchAdminMob(pw: string, id: number, body: { is_hidden?: number; is_boss?: number; name_kr?: string }) {
  const res = await fetch(`${API_BASE}/api/admin/mobs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Password": pw },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function deleteAdminMob(pw: string, id: number) {
  const res = await fetch(`${API_BASE}/api/admin/mobs/${id}`, {
    method: "DELETE",
    headers: { "X-Admin-Password": pw },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getNews(params: {
  source?: string;
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

export async function getTespiaPatchSummary(limit = 12) {
  return fetchJSON<{ source: string; total: number; patches: import("./types").TespiaPatchSummary[] }>(
    `/api/news/tespia-summary?${qs({ limit })}`
  );
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

export async function updateGuildMemberLevel(id: number, level: number) {
  const res = await fetch(`${API_BASE}/api/guild/members/${id}/level`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ level }),
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

// ── 보스 클리어 기록 ──

export interface BossRun {
  id: number;
  boss_name: string;
  character_name: string;
  try_number: number;
  cleared_at: string;
  drops: string | null;
  note: string | null;
  created_at: string;
}

export async function getBossRuns(params: { boss_name?: string; page?: number; per_page?: number } = {}) {
  return fetchJSON<{ items: BossRun[]; total: number; page: number; per_page: number }>(
    `/api/guild/boss/runs?${qs(params as Record<string, string | number>)}`
  );
}

export async function createBossRun(data: {
  boss_name: string; character_name: string; try_number: number; cleared_at: string; drops?: string; note?: string;
}) {
  const res = await fetch(`${API_BASE}/api/guild/boss/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json() as Promise<BossRun>;
}

export async function deleteBossRun(id: number, password: string) {
  const res = await fetch(`${API_BASE}/api/guild/boss/runs/${id}`, {
    method: "DELETE",
    headers: { "X-Admin-Password": password },
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json();
}

// ── 보스 구인 ──

export interface BossRecruitment {
  id: number;
  boss_name: string;
  author: string;
  message: string | null;
  scheduled_at: string | null;
  max_members: number;
  participants_json: string;
  status: string;
  created_at: string;
}

export async function getBossRecruits(params: { boss_name?: string; status?: string; page?: number; per_page?: number } = {}) {
  return fetchJSON<{ items: BossRecruitment[]; total: number; page: number; per_page: number }>(
    `/api/guild/boss/recruit?${qs(params as Record<string, string | number>)}`
  );
}

export async function createBossRecruit(data: {
  boss_name: string; author: string; message?: string; scheduled_at?: string; max_members: number;
}) {
  const res = await fetch(`${API_BASE}/api/guild/boss/recruit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json() as Promise<BossRecruitment>;
}

export async function joinBossRecruit(id: number, nickname: string) {
  const res = await fetch(`${API_BASE}/api/guild/boss/recruit/${id}/join`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json() as Promise<BossRecruitment>;
}

export async function leaveBossRecruit(id: number, nickname: string) {
  const res = await fetch(`${API_BASE}/api/guild/boss/recruit/${id}/leave`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json() as Promise<BossRecruitment>;
}

export async function deleteBossRecruit(id: number, password: string) {
  const res = await fetch(`${API_BASE}/api/guild/boss/recruit/${id}`, {
    method: "DELETE",
    headers: { "X-Admin-Password": password },
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json();
}

// ── 수수료 기록 ──

export interface FeeRecord {
  id: number;
  calc_type: string;
  input_json: string;
  result_json: string;
  note: string | null;
  created_at: string;
}

export async function getFeeRecords(params: { calc_type?: string; page?: number; per_page?: number } = {}) {
  return fetchJSON<{ items: FeeRecord[]; total: number; page: number; per_page: number }>(
    `/api/fee/records?${qs(params as Record<string, string | number>)}`
  );
}

export async function createFeeRecord(data: {
  calc_type: string; input_json: string; result_json: string; note?: string;
}) {
  const res = await fetch(`${API_BASE}/api/fee/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json() as Promise<FeeRecord>;
}

export async function deleteFeeRecord(id: number, password: string) {
  const res = await fetch(`${API_BASE}/api/fee/records/${id}`, {
    method: "DELETE",
    headers: { "X-Admin-Password": password },
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json();
}

// ── 디스코드 봇 ──

export async function getDiscordStatus() {
  return fetchJSON<{
    online: boolean;
    user: string | null;
    channel_id?: string | null;
    channel_name?: string;
    channel_ok?: boolean;
    channel_error?: string;
    channel_help?: string;
    chat_enabled?: boolean;
    chat_channel_id?: string | null;
    chat_channel_name?: string;
    chat_channel_ok?: boolean;
    chat_channel_error?: string;
    chat_channel_help?: string;
  }>(`/api/discord/status`);
}

export async function getDiscordSettings(pw: string) {
  const res = await fetch(`${API_BASE}/api/discord/settings`, {
    headers: { "X-Admin-Password": pw },
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json() as Promise<Record<string, string>>;
}

export async function updateDiscordSettings(settings: Record<string, string>, pw: string) {
  const res = await fetch(`${API_BASE}/api/discord/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Password": pw },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json();
}

export async function sendDiscordNotify(message: string, pw: string) {
  const res = await fetch(`${API_BASE}/api/discord/notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Password": pw },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json();
}

export async function sendDiscordGuildPost(postId: number, pw: string) {
  const res = await fetch(`${API_BASE}/api/discord/notify/guild-post/${postId}`, {
    method: "POST",
    headers: { "X-Admin-Password": pw },
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json();
}

/* ── 메이커(Maker) ─────────────────────────────────────── */
export async function getMakerData() {
  return fetchJSON<import("./types").MakerData>(`/api/maker/data`);
}

export async function getMakerMaterialSources(params: { level_min: number; level_max: number; limit?: number }) {
  return fetchJSON<{ mobs: import("./types").MakerMobSource[]; level_min: number; level_max: number; count: number }>(
    `/api/maker/material-sources?${qs(params as Record<string, number>)}`
  );
}

/* ── 메이플 퀴즈 ─────────────────────────────────────── */
export interface QuizScore {
  id: number;
  nickname: string;
  score: number;
  total: number;
  best_streak: number;
  category: string;
  created_at: string;
}

export async function getQuizScores(params: { total?: number; category?: string; limit?: number } = {}) {
  return fetchJSON<{ scores: QuizScore[] }>(`/api/quiz/scores?${qs(params as Record<string, string | number>)}`);
}

export async function submitQuizScore(payload: { nickname: string; score: number; total: number; best_streak: number; category: string }) {
  const res = await fetch(`${API_BASE}/api/quiz/scores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json() as Promise<{ id: number; ok: boolean }>;
}

export interface QuizPoolEntry { id: number; name: string; name_kr: string | null }

export async function getQuizPool() {
  return fetchJSON<{ mobs: QuizPoolEntry[]; npcs: QuizPoolEntry[] }>(`/api/quiz/pool`);
}

/* ── 커뮤니티 채널 가이드 ─────────────────────────── */
export interface ChannelEntry {
  id: number;
  category: string;
  name: string;
  platform: string | null;
  url: string;
  channel_key: string | null;
  description: string | null;
  tags: string | null;
  sort_order: number;
  is_active: number;
}

export interface ChannelVideo {
  channel_id: number;
  video_id: string;
  title: string | null;
  url: string | null;
  thumbnail: string | null;
  published_at: string | null;
}

export interface CommunityHotPost {
  title: string;
  url: string;
  author: string | null;
  views: number | null;
  recommends: number | null;
  comment_count: number | null;
  is_recommended: number;
  published_at: string | null;
}

export async function getChannels() {
  return fetchJSON<{ channels: ChannelEntry[]; videos: Record<string, ChannelVideo[]> }>(`/api/channels`);
}

export async function getChannelsLive() {
  return fetchJSON<{ live: Record<string, boolean | null> }>(`/api/channels/live`);
}

export async function getCommunityHot(days = 7, limit = 8) {
  return fetchJSON<{ posts: CommunityHotPost[] }>(`/api/channels/community-hot?${qs({ days, limit })}`);
}

export async function getChannelsAdmin(pw: string) {
  return fetchJSON<{ channels: ChannelEntry[] }>(`/api/channels/all`, { "X-Admin-Password": pw });
}

export type ChannelPayload = Omit<ChannelEntry, "id">;

export async function createChannel(data: ChannelPayload, pw: string) {
  const res = await fetch(`${API_BASE}/api/channels`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Password": pw },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json() as Promise<{ id: number; ok: boolean }>;
}

export async function updateChannel(id: number, data: ChannelPayload, pw: string) {
  const res = await fetch(`${API_BASE}/api/channels/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Admin-Password": pw },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json();
}

export async function deleteChannel(id: number, pw: string) {
  const res = await fetch(`${API_BASE}/api/channels/${id}`, {
    method: "DELETE",
    headers: { "X-Admin-Password": pw },
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json();
}

export async function refreshChannelVideos(pw: string) {
  const res = await fetch(`${API_BASE}/api/channels/refresh-videos`, {
    method: "POST",
    headers: { "X-Admin-Password": pw },
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json() as Promise<{ ok: boolean; updated_channels: number }>;
}

/* ── 스킬 시뮬레이터 ─────────────────────────────── */
export interface SimJob {
  id: number;
  name_ko: string;
  name_en: string | null;
  job_class: string;
  faction: string;
  branch: number;
  parent_id: number | null;
}

export interface SimSkill {
  id: number;
  job_id: number;
  name: string;
  description: string | null;
  detail_template: string | null;
  master_level: number;
  weapons: string[];
  required_skills: Record<string, number>;
  level_properties: Record<string, string | number>[];
  icon_path: string | null;
}

export async function getSkillSimData(jobClass: string, faction = "adventurer") {
  return fetchJSON<{ jobs: SimJob[]; skills: SimSkill[] }>(
    `/api/skill-sim/data?${qs({ job_class: jobClass, faction })}`
  );
}

/* ── 이세계 도감 ──────────────────────────────────── */
export interface MuseumEntry {
  id: number;
  name_kr: string;
  name: string;
  level?: number;
  hp?: number;
  exp?: number;
  is_boss?: number;
  category?: string;
  subcategory?: string;
  level_req?: number;
}

export async function getMuseum(params: { type: "mob" | "item"; q?: string; page?: number; per_page?: number }) {
  return fetchJSON<{ entries: MuseumEntry[]; total: number; page: number; per_page: number }>(
    `/api/museum?${qs(params as Record<string, string | number>)}`
  );
}

/* ── 이벤트 정리 아카이브 ─────────────────────────── */
export interface EventGuideSummary {
  id: number;
  slug: string;
  title: string;
  world: string | null;
  status: "active" | "ended";
  period_start: string | null;
  period_end: string | null;
  updated_at: string;
}

export interface EventGuideSection {
  heading: string;
  body?: string;
  table?: { headers: string[]; rows: string[][] };
  note?: string;
}

export interface EventGuideContent {
  tldr: string[];
  sections: EventGuideSection[];
  links: { label: string; url: string }[];
}

export interface EventGuide extends EventGuideSummary {
  source_post_id: string | null;
  content: EventGuideContent;
  created_at: string;
}

export async function getEvents() {
  return fetchJSON<{ events: EventGuideSummary[] }>(`/api/events`);
}

export async function getEvent(slug: string) {
  return fetchJSON<{ event: EventGuide }>(`/api/events/${encodeURIComponent(slug)}`);
}

export interface EventGuidePayload {
  slug: string;
  title: string;
  world: string | null;
  status: string;
  period_start: string | null;
  period_end: string | null;
  source_post_id: string | null;
  content_json: string;
}

export async function updateEvent(slug: string, data: EventGuidePayload, pw: string) {
  const res = await fetch(`${API_BASE}/api/events/${encodeURIComponent(slug)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Admin-Password": pw },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json();
}

export async function createEvent(data: EventGuidePayload, pw: string) {
  const res = await fetch(`${API_BASE}/api/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Password": pw },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json();
}

/* ── 오늘의 몬스터 ─────────────────────────────────── */
export interface DailyMobMeta {
  date: string;
  puzzle_no: number;
  pool: { id: number; name: string }[];
  stats: { solvers: number; avg_attempts: number | null };
  ranking: { nickname: string; attempts: number; solved_at: string }[];
}

export interface DailyMobNumFeedback {
  dir: "match" | "up" | "down";
  close: boolean;
}

export interface DailyMobGuessResult {
  date: string;
  correct: boolean;
  guess: {
    id: number;
    name: string;
    icon_url: string;
    level: number;
    hp: number;
    exp: number;
    is_boss: number;
    is_undead: number;
    region: string;
  };
  feedback: {
    level: DailyMobNumFeedback;
    hp: DailyMobNumFeedback;
    exp: DailyMobNumFeedback;
    is_boss: boolean;
    is_undead: boolean;
    region: "match" | "partial" | "none";
  };
  answer?: { id: number; name: string; icon_url: string };
}

export async function getDailyMob() {
  return fetchJSON<DailyMobMeta>(`/api/daily-mob`);
}

export async function guessDailyMob(name: string) {
  const res = await fetch(`${API_BASE}/api/daily-mob/guess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json() as Promise<DailyMobGuessResult>;
}

export async function solveDailyMob(attempts: number, nickname = "") {
  const res = await fetch(`${API_BASE}/api/daily-mob/solve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attempts, nickname }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json();
}

/* ── 추억틀 (단어 유사도 추리) ────────────────────── */
export interface MapletleMeta {
  date: string;
  puzzle_no: number;
  round: number;
  label: string;
  enabled: boolean;
  secret_len: number;
  stats: { solvers: number; avg_attempts: number | null };
  ranking: { nickname: string; attempts: number; solved_at: string }[];
}

export interface MapletleGuess {
  date: string;
  round: number;
  word: string;
  correct: boolean;
  similarity: number | null;
  band: string;
  answer?: string;
}

export async function newMapletleRound(pw: string) {
  const res = await fetch(`${API_BASE}/api/mapletle/new-round`, {
    method: "POST",
    headers: { "X-Admin-Password": pw },
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json() as Promise<{ ok: boolean; round: number; secret_len: number }>;
}

export async function getMapletle() {
  return fetchJSON<MapletleMeta>(`/api/mapletle`);
}

export async function guessMapletle(word: string) {
  const res = await fetch(`${API_BASE}/api/mapletle/guess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json() as Promise<MapletleGuess>;
}

export async function solveMapletle(attempts: number, nickname = "") {
  const res = await fetch(`${API_BASE}/api/mapletle/solve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attempts, nickname }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json();
}

/* ── 주간 메랜 (주간 뉴스) ─────────────────────────── */
export async function getWeeklyIssues(params: { page?: number; per_page?: number } = {}) {
  return fetchJSON<{ issues: import("./types").WeeklyIssueSummary[]; total: number; page: number; per_page: number }>(
    `/api/weekly-news?${qs(params as Record<string, string | number>)}`
  );
}

export async function getWeeklyIssueLatest() {
  return fetchJSON<{ issue: import("./types").WeeklyIssue }>(`/api/weekly-news/latest`);
}

export async function getWeeklyIssue(issueNo: number) {
  return fetchJSON<{ issue: import("./types").WeeklyIssue }>(`/api/weekly-news/${issueNo}`);
}

export async function resolveWeeklySprites(refs: import("./types").SpriteRef[]) {
  if (!refs.length) return { sprites: [] as import("./types").ResolvedSprite[] };
  const param = refs.map((r) => `${r.type}:${r.id}`).join(",");
  return fetchJSON<{ sprites: import("./types").ResolvedSprite[] }>(
    `/api/weekly-news/sprites?refs=${encodeURIComponent(param)}`
  );
}

/* ── 공유 보스 타이머 (혼테일) ────────────────────── */
export interface BossTimerRoomResponse {
  changed: boolean;
  version: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state?: any[];
  log?: { at: number; text: string }[];
  server_now: number;
  members: number;
  code?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createBossTimerRoom(state: any[], nickname: string, clientId: string) {
  const res = await fetch(`${API_BASE}/api/boss-timer/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state, nickname, client_id: clientId }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json() as Promise<BossTimerRoomResponse>;
}

export async function pollBossTimerRoom(code: string, since: number, clientId: string, nickname: string) {
  const res = await fetch(
    `${API_BASE}/api/boss-timer/rooms/${encodeURIComponent(code)}?since=${since}&client_id=${encodeURIComponent(clientId)}&nickname=${encodeURIComponent(nickname)}`
  );
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json() as Promise<BossTimerRoomResponse>;
}

export async function bossTimerAction(
  code: string,
  action: { type: string; section_id: string; timer_id?: string; label?: string; duration?: number },
  clientId: string,
  nickname: string
) {
  const res = await fetch(`${API_BASE}/api/boss-timer/rooms/${encodeURIComponent(code)}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...action, client_id: clientId, nickname }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json() as Promise<BossTimerRoomResponse>;
}

/* ── 길드 출석부 ────────────────────── */
export async function checkInAttendance(nickname: string) {
  const res = await fetch(`${API_BASE}/api/guild/attendance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `API error: ${res.status}`);
  return res.json() as Promise<{ ok: boolean; date: string; nickname: string }>;
}

export async function getAttendanceToday() {
  return fetchJSON<{ date: string; checked_in: { nickname: string; created_at: string }[] }>(
    `/api/guild/attendance/today`
  );
}

export async function getAttendanceStats(month?: string, nickname?: string) {
  return fetchJSON<{
    month: string;
    ranking: { nickname: string; days: number }[];
    my_days: string[];
    streak: number;
  }>(`/api/guild/attendance/stats?${qs({ month: month ?? "", nickname: nickname ?? "" })}`);
}

/* ── 보스 참여 통계 ── */
export async function getBossParticipation() {
  return fetchJSON<{ members: { nickname: string; runs: number; recruits: number; total: number }[] }>(
    `/api/guild/boss/participation`
  );
}

/* ── 초성퀴즈 검색기 ── */
export async function searchChosung(q: string, type?: string, mode: "exact" | "prefix" = "exact") {
  return fetchJSON<{
    q: string;
    mode: string;
    total: number;
    results: { type: string; type_label: string; id: number; name: string }[];
  }>(`/api/chosung?${qs({ q, type: type ?? "", mode })}`);
}
