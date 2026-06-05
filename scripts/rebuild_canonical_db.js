#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const ROOT = path.join(__dirname, "..");
const SOURCE_DB = process.env.SOURCE_DB || path.join(ROOT, "data", "maple.db");
const DEFAULT_OUT = path.join(ROOT, "data", "maple_canonical.db");
const OUT_PATH = valueArg("--output") || DEFAULT_OUT;
const BASE = valueArg("--base") || "wz83";
const WZ_DIR = BASE === "wz62" ? path.join(ROOT, "wz_data_v62") : path.join(ROOT, "wz_data");
const QUEST_WZ_DIR = path.join(ROOT, "wz_data_v62");
const OVERRIDES_PATH = path.join(ROOT, "data", "mapleland_overrides.json");
const REPORT_PATH = path.join(ROOT, "data", "canonical_rebuild_report.json");

function valueArg(name) {
  const arg = process.argv.find((v) => v.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
}

function loadJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function json(value) {
  return JSON.stringify(value ?? null);
}

function flagList(flags) {
  return json([...new Set(flags.filter(Boolean))]);
}

function normalizeId(id) {
  const value = Number(id);
  return Number.isFinite(value) ? value : null;
}

function indexedValues(obj) {
  if (!obj || typeof obj !== "object") return [];
  return Object.values(obj).filter((v) => v && typeof v === "object");
}

function collectNamedLeaves(obj, out = new Map()) {
  if (!obj || typeof obj !== "object") return out;
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === "object" && typeof value.name === "string") {
      const id = normalizeId(key);
      if (id != null) out.set(id, { name: value.name, desc: value.desc ?? null });
      continue;
    }
    collectNamedLeaves(value, out);
  }
  return out;
}

function readAllRows(db, table) {
  try {
    return db.prepare(`SELECT * FROM ${table}`).all();
  } catch {
    return [];
  }
}

function scalar(db, sql, params = []) {
  try {
    return db.prepare(sql).get(params);
  } catch {
    return undefined;
  }
}

function tableColumns(db, table) {
  try {
    return db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
  } catch {
    return [];
  }
}

function tableExists(db, table) {
  return !!scalar(db, "SELECT name FROM sqlite_master WHERE type='table' AND name=?", [table]);
}

function loadLegacyState() {
  if (!fs.existsSync(SOURCE_DB)) {
    return {
      names: new Map(),
      items: new Map(),
      mobs: new Map(),
      quests: new Map(),
      skills: new Map(),
    };
  }

  const db = new Database(SOURCE_DB, { readonly: true });
  const names = new Map();
  if (tableExists(db, "entity_names_en")) {
    for (const row of readAllRows(db, "entity_names_en")) {
      names.set(`${row.entity_type}:${row.entity_id}:${row.source}`, row.name_en);
    }
  }

  const byId = (table) => new Map(readAllRows(db, table).map((row) => [Number(row.id), row]));
  const legacy = {
    names,
    items: tableExists(db, "items") ? byId("items") : new Map(),
    mobs: tableExists(db, "mobs") ? byId("mobs") : new Map(),
    quests: tableExists(db, "quests") ? byId("quests") : new Map(),
    skills: tableExists(db, "skills") ? byId("skills") : new Map(),
  };
  db.close();
  return legacy;
}

function createSchema(db) {
  db.exec(`
    PRAGMA journal_mode=WAL;

    CREATE TABLE data_sources (
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      source TEXT NOT NULL,
      source_version TEXT,
      source_path TEXT,
      source_url TEXT,
      raw_json TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (entity_type, entity_id, source)
    );

    CREATE TABLE canonical_names (
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      locale TEXT NOT NULL,
      name TEXT NOT NULL,
      source TEXT NOT NULL,
      PRIMARY KEY (entity_type, entity_id, locale, source)
    );

    CREATE TABLE canonical_mobs (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      name_kr TEXT,
      level INTEGER NOT NULL DEFAULT 0,
      hp INTEGER NOT NULL DEFAULT 0,
      mp INTEGER NOT NULL DEFAULT 0,
      exp INTEGER NOT NULL DEFAULT 0,
      defense INTEGER NOT NULL DEFAULT 0,
      magic_defense INTEGER NOT NULL DEFAULT 0,
      physical_damage INTEGER NOT NULL DEFAULT 0,
      magic_damage INTEGER NOT NULL DEFAULT 0,
      accuracy INTEGER NOT NULL DEFAULT 0,
      evasion INTEGER NOT NULL DEFAULT 0,
      speed INTEGER NOT NULL DEFAULT 0,
      is_boss INTEGER NOT NULL DEFAULT 0,
      is_undead INTEGER NOT NULL DEFAULT 0,
      elem_attr TEXT,
      source_version TEXT NOT NULL,
      source_priority INTEGER NOT NULL DEFAULT 0,
      is_hidden INTEGER NOT NULL DEFAULT 0,
      validation_flags TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE canonical_items (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      name_kr TEXT,
      category TEXT,
      subcategory TEXT,
      level_req INTEGER NOT NULL DEFAULT 0,
      job_req TEXT,
      stats_json TEXT,
      attack_speed INTEGER,
      price INTEGER,
      upgrade_slots INTEGER,
      description TEXT,
      source_version TEXT NOT NULL,
      is_hidden INTEGER NOT NULL DEFAULT 0,
      validation_flags TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE canonical_quests (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      name_kr TEXT,
      area TEXT,
      level_req INTEGER NOT NULL DEFAULT 0,
      level_max INTEGER,
      npc_start_id INTEGER,
      npc_end_id INTEGER,
      required_items_json TEXT NOT NULL DEFAULT '[]',
      required_mobs_json TEXT NOT NULL DEFAULT '[]',
      completion_items_json TEXT NOT NULL DEFAULT '[]',
      reward_items_json TEXT NOT NULL DEFAULT '[]',
      exp_reward INTEGER NOT NULL DEFAULT 0,
      meso_reward INTEGER NOT NULL DEFAULT 0,
      prerequisite_quests_json TEXT NOT NULL DEFAULT '[]',
      next_quest_id INTEGER,
      dialogue_json TEXT,
      source_version TEXT NOT NULL,
      is_mapleland INTEGER NOT NULL DEFAULT 0,
      validation_flags TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE canonical_skills (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      name_kr TEXT,
      job_code INTEGER,
      job_class TEXT,
      master_level INTEGER NOT NULL DEFAULT 0,
      elem_attr TEXT,
      level_data_json TEXT NOT NULL DEFAULT '{}',
      source_version TEXT NOT NULL,
      validation_flags TEXT NOT NULL DEFAULT '[]'
    );

    CREATE INDEX idx_canonical_mobs_level ON canonical_mobs(level, hp);
    CREATE INDEX idx_canonical_items_category ON canonical_items(category, subcategory);
    CREATE INDEX idx_canonical_quests_level ON canonical_quests(level_req);
    CREATE INDEX idx_canonical_skills_job ON canonical_skills(job_code);
  `);
}

function insertName(db, entityType, entityId, locale, name, source) {
  if (!name) return;
  db.prepare(`
    INSERT OR REPLACE INTO canonical_names(entity_type, entity_id, locale, name, source)
    VALUES (?, ?, ?, ?, ?)
  `).run(entityType, entityId, locale, name, source);
}

function insertSource(db, entityType, entityId, source, version, sourcePath, raw) {
  db.prepare(`
    INSERT OR REPLACE INTO data_sources(entity_type, entity_id, source, source_version, source_path, raw_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(entityType, entityId, source, version, sourcePath, json(raw));
}

function koreanName(legacy, type, id) {
  return legacy.names.get(`${type}:${id}:kms`) || null;
}

function insertMobs(db, legacy) {
  const mobInfo = loadJson(path.join(WZ_DIR, "Mob_info.json"), {});
  const mobStrings = loadJson(path.join(WZ_DIR, "String_Mob.json"), {});
  const inserted = new Set();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO canonical_mobs(
      id, name, name_kr, level, hp, mp, exp, defense, magic_defense,
      physical_damage, magic_damage, accuracy, evasion, speed, is_boss,
      is_undead, elem_attr, source_version, source_priority, is_hidden, validation_flags
    )
    VALUES (
      @id, @name, @name_kr, @level, @hp, @mp, @exp, @defense, @magic_defense,
      @physical_damage, @magic_damage, @accuracy, @evasion, @speed, @is_boss,
      @is_undead, @elem_attr, @source_version, @source_priority, @is_hidden, @validation_flags
    )
  `);

  for (const [rawId, info] of Object.entries(mobInfo)) {
    const id = normalizeId(rawId);
    if (id == null) continue;
    const legacyMob = legacy.mobs.get(id);
    const name = mobStrings[rawId]?.name || legacyMob?.name || `Mob ${id}`;
    const nameKr = koreanName(legacy, "mob", id);
    const flags = [];
    if (!nameKr) flags.push("missing_korean_name");
    if (!info.level || !info.maxHP) flags.push("zero_level_or_hp");
    if (legacyMob && Number(legacyMob.is_hidden ?? 0) === 1) flags.push("legacy_hidden");

    stmt.run({
      id,
      name,
      name_kr: nameKr,
      level: Number(info.level ?? 0),
      hp: Number(info.maxHP ?? 0),
      mp: Number(info.maxMP ?? 0),
      exp: Number(info.exp ?? 0),
      defense: Number(info.PDDamage ?? 0),
      magic_defense: Number(info.MDDamage ?? 0),
      physical_damage: Number(info.PADamage ?? 0),
      magic_damage: Number(info.MADamage ?? 0),
      accuracy: Number(info.acc ?? 0),
      evasion: Number(info.eva ?? 0),
      speed: Number(info.speed ?? 0),
      is_boss: Number(info.boss ?? legacyMob?.is_boss ?? 0),
      is_undead: Number(info.undead ?? 0),
      elem_attr: info.elemAttr ?? null,
      source_version: BASE,
      source_priority: 100,
      is_hidden: flags.includes("zero_level_or_hp") ? 1 : Number(legacyMob?.is_hidden ?? 0),
      validation_flags: flagList(flags),
    });
    insertName(db, "mob", id, "en", name, BASE);
    insertName(db, "mob", id, "ko", nameKr, "kms");
    insertSource(db, "mob", id, "wz", BASE, `${path.basename(WZ_DIR)}/Mob_info.json`, info);
    inserted.add(id);
  }

  for (const [id, legacyMob] of legacy.mobs.entries()) {
    if (inserted.has(id)) continue;
    const nameKr = koreanName(legacy, "mob", id);
    stmt.run({
      id,
      name: legacyMob.name || nameKr || `Mob ${id}`,
      name_kr: nameKr,
      level: Number(legacyMob.level ?? 0),
      hp: Number(legacyMob.hp ?? 0),
      mp: Number(legacyMob.mp ?? 0),
      exp: Number(legacyMob.exp ?? 0),
      defense: Number(legacyMob.defense ?? 0),
      magic_defense: Number(legacyMob.magic_defense ?? 0),
      physical_damage: Number(legacyMob.physical_damage ?? 0),
      magic_damage: Number(legacyMob.magic_damage ?? 0),
      accuracy: Number(legacyMob.accuracy ?? 0),
      evasion: Number(legacyMob.evasion ?? 0),
      speed: Number(legacyMob.speed ?? 0),
      is_boss: Number(legacyMob.is_boss ?? 0),
      is_undead: Number(legacyMob.is_undead ?? 0),
      elem_attr: null,
      source_version: "legacy-current",
      source_priority: 10,
      is_hidden: Number(legacyMob.is_hidden ?? 0),
      validation_flags: flagList(["legacy_only", !nameKr && "missing_korean_name"]),
    });
    insertName(db, "mob", id, "ko", nameKr, "kms");
    insertSource(db, "mob", id, "legacy-db", "legacy-current", "data/maple.db:mobs", legacyMob);
  }
}

function itemStringNames() {
  const out = new Map();
  for (const file of ["String_Consume.json", "String_Etc.json", "String_Ins.json", "String_Cash.json", "String_Pet.json"]) {
    const data = loadJson(path.join(WZ_DIR, file), {});
    for (const [rawId, value] of Object.entries(data)) {
      const id = normalizeId(rawId);
      if (id != null && value?.name) out.set(id, { name: value.name, desc: value.desc ?? null });
    }
  }
  collectNamedLeaves(loadJson(path.join(WZ_DIR, "String_Eqp.json"), {}), out);
  return out;
}

function wzItemInfo() {
  const out = new Map();
  const files = fs.existsSync(WZ_DIR) ? fs.readdirSync(WZ_DIR) : [];
  for (const file of files) {
    if (!file.startsWith("Item_") && !file.startsWith("Character_")) continue;
    const data = loadJson(path.join(WZ_DIR, file), {});
    const category = file.replace(".json", "").replace("Item_", "").replace("Character_", "");
    for (const [rawId, info] of Object.entries(data)) {
      const id = normalizeId(rawId);
      if (id == null || !info || typeof info !== "object") continue;
      out.set(id, { info, category, sourceFile: file });
    }
  }
  return out;
}

function insertItems(db, legacy) {
  const names = itemStringNames();
  const wzItems = wzItemInfo();
  const ids = new Set([...names.keys(), ...wzItems.keys(), ...legacy.items.keys()]);
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO canonical_items(
      id, name, name_kr, category, subcategory, level_req, job_req, stats_json,
      attack_speed, price, upgrade_slots, description, source_version, is_hidden, validation_flags
    )
    VALUES (
      @id, @name, @name_kr, @category, @subcategory, @level_req, @job_req, @stats_json,
      @attack_speed, @price, @upgrade_slots, @description, @source_version, @is_hidden, @validation_flags
    )
  `);

  for (const id of ids) {
    const legacyItem = legacy.items.get(id);
    const wz = wzItems.get(id);
    const stringInfo = names.get(id);
    const info = wz?.info ?? {};
    const nameKr = koreanName(legacy, "item", id);
    const flags = [];
    if (!wz) flags.push("legacy_or_string_only");
    if (!nameKr) flags.push("missing_korean_name");
    if (legacyItem && Number(legacyItem.is_hidden ?? 0) === 1) flags.push("legacy_hidden");

    const category = legacyItem?.category || wz?.category || null;
    const subcategory = legacyItem?.subcategory || null;
    const stats = {
      legacy: legacyItem?.stats ?? null,
      wz: info,
    };

    stmt.run({
      id,
      name: stringInfo?.name || legacyItem?.name || nameKr || `Item ${id}`,
      name_kr: nameKr,
      category,
      subcategory,
      level_req: Number(info.reqLevel ?? legacyItem?.level_req ?? 0),
      job_req: String(info.reqJob ?? legacyItem?.job_req ?? ""),
      stats_json: json(stats),
      attack_speed: info.attackSpeed ?? legacyItem?.attack_speed ?? null,
      price: Number(info.price ?? legacyItem?.price ?? 0),
      upgrade_slots: Number(info.tuc ?? legacyItem?.upgrade_slots ?? 0),
      description: stringInfo?.desc || legacyItem?.description || null,
      source_version: wz ? BASE : "legacy-current",
      is_hidden: Number(legacyItem?.is_hidden ?? 0),
      validation_flags: flagList(flags),
    });
    insertName(db, "item", id, "en", stringInfo?.name, BASE);
    insertName(db, "item", id, "ko", nameKr, "kms");
    if (wz) insertSource(db, "item", id, "wz", BASE, `${path.basename(WZ_DIR)}/${wz.sourceFile}`, info);
    if (legacyItem) insertSource(db, "item", id, "legacy-db", "legacy-current", "data/maple.db:items", legacyItem);
  }
}

function extractItems(block, legacy) {
  return indexedValues(block?.item).map((entry) => ({
    id: Number(entry.id ?? 0),
    count: Number(entry.count ?? 0),
    name_kr: koreanName(legacy, "item", Number(entry.id ?? 0)),
  }));
}

function extractMobs(block, legacy) {
  return indexedValues(block?.mob).map((entry) => ({
    id: Number(entry.id ?? 0),
    count: Number(entry.count ?? 0),
    name_kr: koreanName(legacy, "mob", Number(entry.id ?? 0)),
  }));
}

function extractPrereqs(block) {
  return indexedValues(block?.quest).map((entry) => ({
    id: Number(entry.id ?? 0),
    state: Number(entry.state ?? 0),
  }));
}

function insertQuests(db, legacy) {
  const questInfo = loadJson(path.join(QUEST_WZ_DIR, "Quest_QuestInfo.json"), {});
  const questCheck = loadJson(path.join(QUEST_WZ_DIR, "Quest_Check.json"), {});
  const questAct = loadJson(path.join(QUEST_WZ_DIR, "Quest_Act.json"), {});
  const questSay = loadJson(path.join(QUEST_WZ_DIR, "Quest_Say.json"), {});
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO canonical_quests(
      id, name, name_kr, area, level_req, level_max, npc_start_id, npc_end_id,
      required_items_json, required_mobs_json, completion_items_json, reward_items_json,
      exp_reward, meso_reward, prerequisite_quests_json, next_quest_id,
      dialogue_json, source_version, is_mapleland, validation_flags
    )
    VALUES (
      @id, @name, @name_kr, @area, @level_req, @level_max, @npc_start_id, @npc_end_id,
      @required_items_json, @required_mobs_json, @completion_items_json, @reward_items_json,
      @exp_reward, @meso_reward, @prerequisite_quests_json, @next_quest_id,
      @dialogue_json, @source_version, @is_mapleland, @validation_flags
    )
  `);

  const inserted = new Set();
  for (const [rawId, info] of Object.entries(questInfo)) {
    const id = normalizeId(rawId);
    if (id == null) continue;
    const startCheck = questCheck[rawId]?.["0"] ?? {};
    const endCheck = questCheck[rawId]?.["1"] ?? {};
    const endAct = questAct[rawId]?.["1"] ?? {};
    const legacyQuest = legacy.quests.get(id);
    const flags = [];
    if (!legacyQuest) flags.push("not_in_legacy_excel");

    const rewardItems = extractItems(endAct, legacy).filter((item) => item.count > 0);
    const consumedItems = extractItems(endAct, legacy).filter((item) => item.count < 0);

    stmt.run({
      id,
      name: info.name || legacyQuest?.name || `Quest ${id}`,
      name_kr: legacyQuest?.name ?? null,
      area: info.area != null ? String(info.area) : legacyQuest?.area ?? null,
      level_req: Number(startCheck.lvmin ?? startCheck.lvMin ?? legacyQuest?.level_req ?? 0),
      level_max: startCheck.lvmax ?? startCheck.lvMax ?? null,
      npc_start_id: startCheck.npc ?? null,
      npc_end_id: endCheck.npc ?? null,
      required_items_json: json([...extractItems(startCheck, legacy), ...consumedItems]),
      required_mobs_json: json(extractMobs(endCheck, legacy)),
      completion_items_json: json(extractItems(endCheck, legacy)),
      reward_items_json: json(rewardItems),
      exp_reward: Number(endAct.exp ?? legacyQuest?.exp_reward ?? 0),
      meso_reward: Number(endAct.money ?? legacyQuest?.meso_reward ?? 0),
      prerequisite_quests_json: json(extractPrereqs(startCheck)),
      next_quest_id: endAct.nextQuest ?? questAct[rawId]?.["0"]?.nextQuest ?? null,
      dialogue_json: json(questSay[rawId] ?? null),
      source_version: "wz62",
      is_mapleland: Number(legacyQuest?.is_mapleland ?? 0),
      validation_flags: flagList(flags),
    });
    insertName(db, "quest", id, "zh-TW", info.name, "wz62");
    if (legacyQuest?.name) insertName(db, "quest", id, "ko", legacyQuest.name, "legacy-excel");
    insertSource(db, "quest", id, "wz", "wz62", "wz_data_v62/Quest_QuestInfo.json", info);
    inserted.add(id);
  }

  for (const [id, quest] of legacy.quests.entries()) {
    if (inserted.has(id)) continue;
    stmt.run({
      id,
      name: quest.name || `Quest ${id}`,
      name_kr: quest.name || null,
      area: quest.area ?? null,
      level_req: Number(quest.level_req ?? 0),
      level_max: null,
      npc_start_id: null,
      npc_end_id: null,
      required_items_json: json([]),
      required_mobs_json: json([]),
      completion_items_json: json([]),
      reward_items_json: json([]),
      exp_reward: Number(quest.exp_reward ?? 0),
      meso_reward: Number(quest.meso_reward ?? 0),
      prerequisite_quests_json: json([]),
      next_quest_id: null,
      dialogue_json: null,
      source_version: "legacy-excel",
      is_mapleland: Number(quest.is_mapleland ?? 1),
      validation_flags: flagList(["legacy_excel_only", "needs_structured_wz_mapping"]),
    });
    insertName(db, "quest", id, "ko", quest.name, "legacy-excel");
    insertSource(db, "quest", id, "legacy-db", "legacy-excel", "data/maple.db:quests", quest);
  }
}

function jobClassFromCode(jobCode) {
  const first = String(jobCode).slice(0, 1);
  return {
    "0": "초보자",
    "1": "전사",
    "2": "마법사",
    "3": "궁수",
    "4": "도적",
    "5": "해적",
    "8": "관리자",
    "9": "관리자",
  }[first] || "기타";
}

function insertSkills(db, legacy) {
  const skillData = loadJson(path.join(WZ_DIR, "Skill_data.json"), {});
  const legacyById = legacy.skills;
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO canonical_skills(
      id, name, name_kr, job_code, job_class, master_level, elem_attr,
      level_data_json, source_version, validation_flags
    )
    VALUES (
      @id, @name, @name_kr, @job_code, @job_class, @master_level, @elem_attr,
      @level_data_json, @source_version, @validation_flags
    )
  `);

  const inserted = new Set();
  for (const [rawJobCode, skills] of Object.entries(skillData)) {
    const jobCode = Number(rawJobCode);
    for (const [rawSkillId, info] of Object.entries(skills)) {
      const id = normalizeId(rawSkillId);
      if (id == null) continue;
      const levels = info.level ?? {};
      const masterLevel = Math.max(0, ...Object.keys(levels).map((v) => Number(v)).filter(Number.isFinite));
      const legacySkill = legacyById.get(id);
      const flags = [];
      if (!legacySkill) flags.push("missing_legacy_skill_name");

      stmt.run({
        id,
        name: legacySkill?.skill_name || `Skill ${id}`,
        name_kr: legacySkill?.skill_name || null,
        job_code: jobCode,
        job_class: legacySkill?.job_class || jobClassFromCode(jobCode),
        master_level: masterLevel,
        elem_attr: info.elemAttr ?? null,
        level_data_json: json(levels),
        source_version: BASE,
        validation_flags: flagList(flags),
      });
      insertName(db, "skill", id, "ko", legacySkill?.skill_name, "legacy-db");
      insertSource(db, "skill", id, "wz", BASE, `${path.basename(WZ_DIR)}/Skill_data.json`, info);
      inserted.add(id);
    }
  }

  for (const [id, skill] of legacyById.entries()) {
    if (inserted.has(id)) continue;
    stmt.run({
      id,
      name: skill.skill_name || `Skill ${id}`,
      name_kr: skill.skill_name || null,
      job_code: null,
      job_class: skill.job_class || null,
      master_level: Number(skill.master_level ?? 0),
      elem_attr: null,
      level_data_json: skill.level_data || "{}",
      source_version: "legacy-db",
      validation_flags: flagList(["legacy_only"]),
    });
    insertName(db, "skill", id, "ko", skill.skill_name, "legacy-db");
    insertSource(db, "skill", id, "legacy-db", "legacy-current", "data/maple.db:skills", skill);
  }
}

function applyOverrides(db) {
  const overrides = loadJson(OVERRIDES_PATH, {});
  const tables = {
    mobs: "canonical_mobs",
    items: "canonical_items",
    quests: "canonical_quests",
    skills: "canonical_skills",
  };
  const applied = {};

  for (const [key, table] of Object.entries(tables)) {
    const rows = overrides[key] || {};
    const cols = new Set(tableColumns(db, table));
    applied[key] = 0;
    for (const [rawId, patch] of Object.entries(rows)) {
      const id = normalizeId(rawId);
      if (id == null || !patch || typeof patch !== "object") continue;
      const updates = Object.entries(patch).filter(([col]) => cols.has(col) && col !== "id");
      if (updates.length === 0) continue;
      const setSql = updates.map(([col]) => `${col}=?`).join(", ");
      db.prepare(`UPDATE ${table} SET ${setSql}, source_version='mapleland-current' WHERE id=?`).run(
        ...updates.map(([, value]) => (typeof value === "object" ? json(value) : value)),
        id
      );
      insertSource(db, key.slice(0, -1), id, "mapleland-overrides", "mapleland-current", "data/mapleland_overrides.json", patch);
      applied[key] += 1;
    }
  }

  return applied;
}

function buildReport(db, appliedOverrides) {
  const count = (table, where = "1=1") => scalar(db, `SELECT COUNT(*) as count FROM ${table} WHERE ${where}`)?.count ?? 0;
  return {
    generated_at: new Date().toISOString(),
    output_path: OUT_PATH,
    source_db: SOURCE_DB,
    base: BASE,
    wz_dir: WZ_DIR,
    quest_wz_dir: QUEST_WZ_DIR,
    overrides_path: OVERRIDES_PATH,
    applied_overrides: appliedOverrides,
    counts: {
      mobs: count("canonical_mobs"),
      visible_mobs: count("canonical_mobs", "COALESCE(is_hidden,0)=0"),
      items: count("canonical_items"),
      quests: count("canonical_quests"),
      skills: count("canonical_skills"),
      names: count("canonical_names"),
      data_sources: count("data_sources"),
    },
    quality: {
      mobs_missing_korean_name: count("canonical_mobs", "name_kr IS NULL OR name_kr=''"),
      items_missing_korean_name: count("canonical_items", "name_kr IS NULL OR name_kr=''"),
      quests_from_wz62: count("canonical_quests", "source_version='wz62'"),
      quests_legacy_excel_only: count("canonical_quests", "validation_flags LIKE '%legacy_excel_only%'"),
      skills_missing_legacy_name: count("canonical_skills", "validation_flags LIKE '%missing_legacy_skill_name%'"),
    },
  };
}

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
if (fs.existsSync(OUT_PATH)) fs.unlinkSync(OUT_PATH);
for (const suffix of ["-wal", "-shm"]) {
  const sidecar = `${OUT_PATH}${suffix}`;
  if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
}

const legacy = loadLegacyState();
const db = new Database(OUT_PATH);
createSchema(db);

db.transaction(() => {
  insertMobs(db, legacy);
  insertItems(db, legacy);
  insertQuests(db, legacy);
  insertSkills(db, legacy);
})();

const appliedOverrides = db.transaction(() => applyOverrides(db))();
const report = buildReport(db, appliedOverrides);
db.close();

fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

console.log(`Canonical DB written: ${OUT_PATH}`);
console.log(`Rebuild report written: ${REPORT_PATH}`);
console.log(`Mobs ${report.counts.visible_mobs}/${report.counts.mobs}, items ${report.counts.items}, quests ${report.counts.quests}, skills ${report.counts.skills}`);
console.log(`Missing Korean names: mobs=${report.quality.mobs_missing_korean_name}, items=${report.quality.items_missing_korean_name}`);
