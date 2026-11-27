export interface NeoTokyoData {
  updated_at: string; patch_revision: string; source: string; official_image: string;
  min_level: number; summary: string; entry: string[]; locked_areas: string[];
  areas: { name: string; maps: { name: string; id: number | null }[] }[];
  monsters: { id: number; name: string; level: number | null; boss: boolean; source: string;
    reference_stats: Record<string, number> | null;
    reference_drops: { item_id: number; name: string }[]; reference_drop_source: string | null }[];
  items: { name: string; id: number | null; method: string; status: string; note: string }[];
  quest_steps: { title: string; description: string; status: string; source?: string }[];
  crystal_ilbi: { manual_npc: string; manual_location: string; manual_currency: string; manual_cost: number; manual_source: string; note: string };
  other_changes: string[]; notes: string[];
}
