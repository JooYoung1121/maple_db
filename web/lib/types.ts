export interface Item {
  id: number;
  name: string;
  category: string | null;
  subcategory: string | null;
  level_req: number;
  job_req: string | null;
  stats: string | null;
  description: string | null;
  icon_url: string | null;
  source_url: string | null;
  attack_speed?: string | null;
  price?: number;
  upgrade_slots?: number;
  overall_category?: string | null;
  names_en?: NameEn[];
  name_kr?: string | null;
}

export interface Mob {
  id: number;
  name: string;
  level: number;
  hp: number;
  mp: number;
  exp: number;
  defense: number;
  accuracy: number;
  evasion: number;
  is_boss: number;
  physical_damage?: number;
  magic_damage?: number;
  magic_defense?: number;
  speed?: number;
  is_undead?: number;
  spawn_time?: string | null;
  icon_url: string | null;
  source_url: string | null;
  names_en?: NameEn[];
  name_kr?: string | null;
}

export interface MobDrop {
  id: number;
  name: string;
  name_kr?: string | null;
  category?: string | null;
  drop_rate: number | null;
}

export interface MobSpawn {
  id: number;
  name: string;
  street_name?: string | null;
  area?: string | null;
}

export interface MapData {
  id: number;
  name: string;
  street_name: string | null;
  area: string | null;
  return_map_id: number | null;
  source_url: string | null;
  is_town?: number;
  mob_rate?: number | null;
  portals?: Portal[];
  names_en?: NameEn[];
  name_kr?: string | null;
}

export interface Portal {
  portalName?: string;
  toMap?: number;
  toName?: string;
  type?: number;
}

export interface Npc {
  id: number;
  name: string;
  map_id: number | null;
  map_name: string | null;
  description: string | null;
  icon_url: string | null;
  source_url: string | null;
  is_shop?: number;
  dialogue?: string | null;
  found_at?: string | null;
  related_quests_detail?: { id: number; name: string; level_req: number }[];
  names_en?: NameEn[];
  name_kr?: string | null;
}

export interface Quest {
  id: number;
  name: string;
  level_req: number;
  npc_start: string | null;
  npc_end: string | null;
  rewards: string | null;
  rewards_detail?: Record<string, unknown> | null;
  description: string | null;
  source_url: string | null;
  names_en?: NameEn[];
  name_kr?: string | null;
}

export interface Skill {
  id: number;
  job_class: string;
  job_branch: string | null;
  skill_name: string;
  master_level: number | null;
  skill_type: string | null;
  description: string | null;
  level_data: string | null;
  level_data_parsed?: { level: number; effect: string }[] | null;
  source_post_url: string | null;
}

export interface Boss extends Mob {
  drop_count?: number;
  spawn_map?: string | null;
}

export interface NameEn {
  name_en: string;
  source: string;
}

export interface SearchResult {
  entity_type: string;
  entity_id: number;
  name: string;
  snippet: string;
}

export interface SearchSuggestion {
  entity_type: string;
  entity_id: number;
  name: string;
  name_kr: string | null;
  icon_url: string | null;
}

export interface AdminMob extends Mob {
  is_hidden: number;
  drop_count: number;
  spawn_count: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface MapleLandPost {
  id: number;
  post_id: string;
  board: string;
  category: string | null;
  title: string;
  content: string | null;
  content_html: string | null;
  url: string | null;
  published_at: string | null;
  created_at: string;
}
