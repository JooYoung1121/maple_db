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

export interface NHitMobPreset {
  id: number;
  name: string;
  name_kr?: string | null;
  level: number;
  hp: number;
  wdef: number;
  mdef: number;
  exp: number;
  is_boss: number;
  is_undead?: number;
  speed?: number;
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
  name_kr?: string | null;
  street_name?: string | null;
  area?: string | null;
  spawn_count?: number | null;
}

export interface MapMobSpawn {
  mob_id: number;
  mob_name: string;
  mob_name_kr?: string | null;
  level: number;
  spawn_count?: number | null;
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
  area: string;
  start_location?: string | null;
  quest_conditions?: string[] | null;
  exp_reward?: number;
  meso_reward?: number;
  item_reward?: string | null;
  extra_reward?: string | null;
  note?: string | null;
  tip?: string | null;
  difficulty?: string | null;
  is_chain?: number;
  chain_parent?: string | null;
  quest_type?: string | null;
  is_mapleland?: number;
  // Detail page extras
  chain_quests?: { id: number; name: string; level_req: number }[];
}

export interface QuestChainNode {
  id: number;
  name: string;
  level_req: number;
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
  name_kr: string | null;
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
  source?: "main" | "tespia" | string;
  board: string;
  category: string | null;
  title: string;
  content: string | null;
  content_html: string | null;
  url: string | null;
  published_at: string | null;
  created_at: string;
  updated_at?: string | null;
  summary: string | null;
}

export interface TespiaPatchSummary {
  post_id: string;
  title: string;
  category: string | null;
  published_at: string | null;
  version: string | null;
  url: string | null;
  summary_lines: string[];
}

/* ── 메이커(Maker) ─────────────────────────────────────── */
export interface MakerMaterial {
  name: string;
  qty: number;
  note?: string;
}
export interface MakerSkillQuest {
  skill_level: number;
  name: string;
  req_level: number;
  cost_meso: number;
  npc?: string;
  location?: string;
  flow?: string[];
  materials: MakerMaterial[];
  reward_exp: number;
  note?: string;
}
export interface MakerGem {
  name: string;
  kind: string;
  stat: string;
  values: Record<string, number>;
  weapon_only: boolean;
}
export interface MakerMonsterCrystal {
  grade: string;
  sub: string;
  level_min: number;
  level_max: number;
  loot_qty: number;
}
export interface MakerScroll {
  name: string;
  effect: string;
  fee: number;
  req_quest?: string;
  materials: MakerMaterial[];
}
export interface MakerEquipGrade {
  stats: Record<string, number>;
  fee: number;
  materials: MakerMaterial[];
}
export interface MakerEquipment {
  name: string;
  slot: string;
  job: string;
  reverse?: MakerEquipGrade;
  timeless?: MakerEquipGrade;
}
export interface MakerData {
  meta: { source: string; note: string; updated: string; sources: string[]; tespia_functions?: string[] };
  skill_quests: MakerSkillQuest[];
  gem_process: { fee: number; input: MakerMaterial; grades: Record<string, number>; note: string };
  gem_refine: { from: string; to: string; input_qty: number; fee: number; fail_loss: number; note: string }[];
  gems: MakerGem[];
  monster_crystals: MakerMonsterCrystal[];
  scrolls: MakerScroll[];
  equipment: MakerEquipment[];
  material_sources: { name: string; how: string }[];
}
export interface MakerMobSource {
  id: number;
  name: string;
  name_kr: string;
  level: number;
  is_boss: number;
}
