#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const ROOT = path.join(__dirname, "..");
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const outIndex = args.indexOf("--out");
const dbArg = args.find((arg, index) =>
  !arg.startsWith("--") && (outIndex < 0 || index !== outIndex + 1)
);
const DB_PATH = dbArg || path.join(ROOT, "data", "maple.db");
const OUT_PATH = outIndex >= 0 && args[outIndex + 1]
  ? path.resolve(args[outIndex + 1])
  : path.join(ROOT, "data", "data_quality_report.json");

function nowIso() {
  return new Date().toISOString();
}

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function safeRows(db, sql, params = []) {
  try {
    return db.prepare(sql).all(params);
  } catch {
    return [];
  }
}

function safeGet(db, sql, params = []) {
  try {
    return db.prepare(sql).get(params);
  } catch {
    return undefined;
  }
}

function count(db, table, where = "1=1") {
  return safeGet(db, `SELECT COUNT(*) as count FROM ${table} WHERE ${where}`)?.count ?? 0;
}

function tableExists(db, table) {
  return !!safeGet(db, "SELECT name FROM sqlite_master WHERE type='table' AND name=?", [table]);
}

function columns(db, table) {
  return safeRows(db, `PRAGMA table_info(${table})`).map((row) => row.name);
}

function sampleRows(db, sql, params = [], limit = 20) {
  return safeRows(db, `${sql} LIMIT ${limit}`, params);
}

function visibleWhere(db, table) {
  return columns(db, table).includes("is_hidden") ? "COALESCE(is_hidden, 0) = 0" : "1=1";
}

function compareMobWithWz(db) {
  const wzMobs = loadJson(path.join(ROOT, "wz_data", "Mob_info.json"));
  if (!wzMobs) return null;

  const rows = safeRows(db, "SELECT id, name, level, hp, mp, exp, defense, magic_defense, physical_damage, magic_damage, accuracy, evasion FROM mobs");
  const fields = [
    ["level", "level"],
    ["hp", "maxHP"],
    ["mp", "maxMP"],
    ["exp", "exp"],
    ["defense", "PDDamage"],
    ["magic_defense", "MDDamage"],
    ["physical_damage", "PADamage"],
    ["magic_damage", "MADamage"],
    ["accuracy", "acc"],
    ["evasion", "eva"],
  ];

  let matched = 0;
  let perfect = 0;
  const mismatches = [];
  const notInWz = [];

  for (const mob of rows) {
    const wz = wzMobs[String(mob.id)];
    if (!wz) {
      notInWz.push({ id: mob.id, name: mob.name, level: mob.level, hp: mob.hp });
      continue;
    }
    matched += 1;
    const diff = {};
    for (const [dbField, wzField] of fields) {
      const dbValue = mob[dbField] ?? 0;
      const wzValue = wz[wzField] ?? 0;
      if (Number(dbValue) !== Number(wzValue)) {
        diff[dbField] = { db: dbValue, wz83: wzValue };
      }
    }
    if (Object.keys(diff).length === 0) {
      perfect += 1;
    } else {
      mismatches.push({ id: mob.id, name: mob.name, diff });
    }
  }

  return {
    source: "wz_data/Mob_info.json",
    wz_count: Object.keys(wzMobs).length,
    db_count: rows.length,
    matched,
    perfect,
    mismatched: mismatches.length,
    not_in_wz: notInWz.length,
    mismatch_samples: mismatches.slice(0, 30),
    not_in_wz_samples: notInWz.slice(0, 30),
  };
}

function compareMobWithMapleLandReference(db) {
  const ref = loadJson(path.join(ROOT, "data", "mapleland_mobs.json"));
  if (!ref?.mobs?.length) return null;

  const refById = new Map(ref.mobs.map((mob) => [Number(mob.id), mob]));
  const dbRows = safeRows(
    db,
    `SELECT id, name, level, hp, exp, is_boss,
            (SELECT name_en FROM entity_names_en
             WHERE entity_type='mob' AND entity_id=mobs.id AND source='kms') as name_kr
     FROM mobs
     WHERE COALESCE(is_hidden, 0)=0`
  );
  const dbById = new Map(dbRows.map((mob) => [Number(mob.id), mob]));

  const visibleNotInRef = dbRows
    .filter((mob) => !refById.has(Number(mob.id)))
    .sort((a, b) => Number(b.level ?? 0) - Number(a.level ?? 0) || Number(a.id) - Number(b.id));
  const refMissingInDb = ref.mobs
    .filter((mob) => !dbById.has(Number(mob.id)))
    .sort((a, b) => Number(a.level ?? 0) - Number(b.level ?? 0) || Number(a.id) - Number(b.id));
  const valueMismatches = [];

  for (const refMob of ref.mobs) {
    const dbMob = dbById.get(Number(refMob.id));
    if (!dbMob) continue;
    const diff = {};
    if (Number(dbMob.level ?? 0) !== Number(refMob.level ?? 0)) {
      diff.level = { db: dbMob.level, mapleland: refMob.level };
    }
    if (Number(dbMob.hp ?? 0) !== Number(refMob.hp ?? 0)) {
      diff.hp = { db: dbMob.hp, mapleland: refMob.hp };
    }
    if (Object.keys(diff).length > 0) {
      valueMismatches.push({
        id: refMob.id,
        name_kr: dbMob.name_kr || refMob.name_kr,
        diff,
      });
    }
  }

  return {
    source: ref.source_url,
    reference_count: ref.mobs.length,
    db_visible_count: dbRows.length,
    visible_not_in_reference: visibleNotInRef.length,
    reference_missing_in_db: refMissingInDb.length,
    value_mismatches: valueMismatches.length,
    visible_not_in_reference_samples: visibleNotInRef.slice(0, 50),
    reference_missing_in_db_samples: refMissingInDb.slice(0, 50),
    value_mismatch_samples: valueMismatches.slice(0, 50),
  };
}

function loadMapleLandEntityReference(kind) {
  const combined = loadJson(path.join(ROOT, "data", "mapleland_reference.json"));
  const combinedRecords = combined?.entities?.[kind]?.records;
  if (Array.isArray(combinedRecords) && combinedRecords.length > 0) {
    return {
      source_url: combined.entities[kind].source_url,
      records: combinedRecords,
      count: combinedRecords.length,
    };
  }

  const standalone = loadJson(path.join(ROOT, "data", `mapleland_${kind}.json`));
  const records = standalone?.[kind];
  if (Array.isArray(records) && records.length > 0) {
    return {
      source_url: standalone.source_url,
      records,
      count: records.length,
    };
  }

  return null;
}

function normalizeName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function compareEntityWithMapleLandReference(db, kind, sql, options = {}) {
  const ref = loadMapleLandEntityReference(kind);
  if (!ref) return null;

  const dbRows = safeRows(db, sql);
  const refById = new Map(ref.records.map((row) => [Number(row.id), row]));
  const dbById = new Map(dbRows.map((row) => [Number(row.id), row]));

  const dbNotInReference = dbRows
    .filter((row) => !refById.has(Number(row.id)))
    .sort((a, b) => Number(a.id) - Number(b.id));
  const referenceMissingInDb = ref.records
    .filter((row) => !dbById.has(Number(row.id)))
    .sort((a, b) => Number(a.id) - Number(b.id));
  const valueMismatches = [];
  const nameMismatches = [];

  for (const refRow of ref.records) {
    const dbRow = dbById.get(Number(refRow.id));
    if (!dbRow) continue;

    const diff = {};
    if (options.compareLevel) {
      const dbLevel = Number(dbRow[options.dbLevelField] ?? 0);
      const refLevel = Number(refRow.level ?? 0);
      if (Number.isFinite(refLevel) && dbLevel !== refLevel) {
        diff.level = { db: dbLevel, mapleland: refLevel };
      }
    }

    if (Object.keys(diff).length > 0) {
      valueMismatches.push({
        id: refRow.id,
        name_kr: dbRow.name_kr || refRow.name_kr,
        diff,
      });
    }

    if (options.compareName && dbRow.name_kr) {
      const dbName = normalizeName(dbRow.name_kr);
      const refName = normalizeName(refRow.name_kr);
      if (dbName && refName && dbName !== refName) {
        nameMismatches.push({
          id: refRow.id,
          db_name_kr: dbName,
          mapleland_name_kr: refName,
        });
      }
    }
  }

  return {
    source: ref.source_url,
    reference_count: ref.count,
    db_count: dbRows.length,
    db_not_in_reference: dbNotInReference.length,
    reference_missing_in_db: referenceMissingInDb.length,
    value_mismatches: valueMismatches.length,
    name_mismatches: nameMismatches.length,
    db_not_in_reference_samples: dbNotInReference.slice(0, 50),
    reference_missing_in_db_samples: referenceMissingInDb.slice(0, 50),
    value_mismatch_samples: valueMismatches.slice(0, 50),
    name_mismatch_samples: nameMismatches.slice(0, 50),
  };
}

function compareQuestsWithMapleLandReference(db) {
  const ref = loadMapleLandEntityReference("quests");
  if (!ref) return null;

  const dbRows = safeRows(
    db,
    `SELECT id, name, level_req, area, start_location, start_level, end_level, quest_type
     FROM quests`
  );
  const refById = new Map(ref.records.map((row) => [Number(row.id), row]));
  const dbById = new Map(dbRows.map((row) => [Number(row.id), row]));
  const refNames = new Map(ref.records.map((row) => [normalizeName(row.name_kr), row]));
  const dbNames = new Map(dbRows.map((row) => [normalizeName(row.name), row]));

  const dbNameNotInReference = dbRows
    .filter((row) => !refNames.has(normalizeName(row.name)))
    .sort((a, b) => Number(a.id) - Number(b.id));
  const referenceNameMissingInDb = ref.records
    .filter((row) => !dbNames.has(normalizeName(row.name_kr)))
    .sort((a, b) => Number(a.id) - Number(b.id));

  return {
    source: ref.source_url,
    schema_warning:
      "quests.id is an AUTOINCREMENT surrogate key in the current DB, so MapleLand quest ID comparisons are not reliable. Name-based comparison is used as a weaker signal.",
    reference_count: ref.count,
    db_count: dbRows.length,
    db_id_matches_reference_id: dbRows.filter((row) => refById.has(Number(row.id))).length,
    reference_id_missing_in_db_surrogate_space: ref.records.filter((row) => !dbById.has(Number(row.id))).length,
    db_name_not_in_reference: dbNameNotInReference.length,
    reference_name_missing_in_db: referenceNameMissingInDb.length,
    db_name_not_in_reference_samples: dbNameNotInReference.slice(0, 50),
    reference_name_missing_in_db_samples: referenceNameMissingInDb.slice(0, 50),
  };
}

if (!fs.existsSync(DB_PATH)) {
  console.error(`DB not found: ${DB_PATH}`);
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });

const report = {
  generated_at: nowIso(),
  db_path: DB_PATH,
  counts: {},
  names: {},
  relations: {},
  anomalies: {},
  crosscheck: {},
  search: {},
};

for (const table of ["items", "mobs", "maps", "npcs", "quests", "skills", "mob_drops", "mob_spawns"]) {
  if (!tableExists(db, table)) continue;
  const tableColumns = columns(db, table);
  const entry = { total: count(db, table) };
  if (tableColumns.includes("is_hidden")) {
    entry.visible = count(db, table, "COALESCE(is_hidden, 0) = 0");
    entry.hidden = count(db, table, "COALESCE(is_hidden, 0) = 1");
  }
  report.counts[table] = entry;
}

if (tableExists(db, "entity_names_en")) {
  report.names.visible_items_without_kms_name = safeGet(
    db,
    `SELECT COUNT(*) as count
     FROM items i
     WHERE ${visibleWhere(db, "items")}
       AND NOT EXISTS (
         SELECT 1 FROM entity_names_en n
         WHERE n.entity_type='item' AND n.entity_id=i.id AND n.source='kms'
       )`
  )?.count ?? 0;
  report.names.visible_mobs_without_kms_name = safeGet(
    db,
    `SELECT COUNT(*) as count
     FROM mobs m
     WHERE ${visibleWhere(db, "mobs")}
       AND NOT EXISTS (
         SELECT 1 FROM entity_names_en n
         WHERE n.entity_type='mob' AND n.entity_id=m.id AND n.source='kms'
       )`
  )?.count ?? 0;
}

if (tableExists(db, "mob_drops")) {
  report.relations.mob_drops = {
    total: count(db, "mob_drops"),
    null_drop_rate: count(db, "mob_drops", "drop_rate IS NULL"),
    visible_mob_links: safeGet(
      db,
      `SELECT COUNT(*) as count
       FROM mob_drops d
       JOIN mobs m ON m.id=d.mob_id
       WHERE ${visibleWhere(db, "mobs").replaceAll("is_hidden", "m.is_hidden")}`
    )?.count ?? 0,
    visible_item_links: safeGet(
      db,
      `SELECT COUNT(*) as count
       FROM mob_drops d
       JOIN items i ON i.id=d.item_id
       WHERE ${visibleWhere(db, "items").replaceAll("is_hidden", "i.is_hidden")}`
    )?.count ?? 0,
  };
}

if (tableExists(db, "mob_spawns")) {
  report.relations.mob_spawns = {
    total: count(db, "mob_spawns"),
    maps_with_spawns: safeGet(db, "SELECT COUNT(DISTINCT map_id) as count FROM mob_spawns")?.count ?? 0,
    mobs_with_spawns: safeGet(db, "SELECT COUNT(DISTINCT mob_id) as count FROM mob_spawns")?.count ?? 0,
  };
}

if (tableExists(db, "maps")) {
  report.anomalies.maps_without_area = count(db, "maps", "area IS NULL OR area = ''");
  report.anomalies.maps_without_spawns = safeGet(
    db,
    "SELECT COUNT(*) as count FROM maps m WHERE NOT EXISTS (SELECT 1 FROM mob_spawns s WHERE s.map_id=m.id)"
  )?.count ?? 0;
}

if (tableExists(db, "mobs")) {
  report.anomalies.visible_mobs_invalid_level_or_hp = sampleRows(
    db,
    `SELECT id, name, level, hp, exp, is_boss
     FROM mobs
     WHERE ${visibleWhere(db, "mobs")} AND (level <= 0 OR hp <= 1)
     ORDER BY level, id`
  );
  report.anomalies.suspicious_bosses = sampleRows(
    db,
    `SELECT id, name, level, hp, exp
     FROM mobs
     WHERE ${visibleWhere(db, "mobs")} AND COALESCE(is_boss, 0)=1 AND (level <= 1 OR hp <= 1)
     ORDER BY level, id`
  );
}

if (tableExists(db, "quests")) {
  report.anomalies.quest_low_meso_reward_samples = sampleRows(
    db,
    `SELECT id, name, level_req, item_reward, meso_reward
     FROM quests
     WHERE meso_reward > 0 AND meso_reward < 1000
     ORDER BY meso_reward, id`
  );
  report.anomalies.quest_generic_drop_item_conditions = sampleRows(
    db,
    `SELECT id, name, quest_conditions
     FROM quests
     WHERE quest_conditions LIKE '%드롭 아이템%'
     ORDER BY id`
  );
}

if (tableExists(db, "skills")) {
  report.anomalies.duplicate_skill_names = sampleRows(
    db,
    `SELECT skill_name, COUNT(*) as copies, GROUP_CONCAT(DISTINCT job_class) as job_classes
     FROM skills
     GROUP BY skill_name
     HAVING COUNT(*) > 1
     ORDER BY copies DESC, skill_name`,
    [],
    50
  );
  report.anomalies.suspicious_warrior_skills = sampleRows(
    db,
    `SELECT id, job_class, job_branch, skill_name
     FROM skills
     WHERE job_class='전사'
       AND skill_name IN ('럭키 세븐', '트리플 스로우', '더블 스탭', '헤이스트', '쉐도우 파트너')
     ORDER BY skill_name, id`,
    [],
    50
  );
}

if (tableExists(db, "entity_names_en")) {
  report.anomalies.display_name_variants = safeRows(
    db,
    `SELECT entity_type, name_en as display_name, COUNT(*) as variants
     FROM entity_names_en
     WHERE source='kms'
     GROUP BY entity_type, name_en
     HAVING COUNT(*) > 1
     ORDER BY variants DESC, entity_type, display_name`
  );
}

if (tableExists(db, "weekly_news_issues")) {
  report.anomalies.duplicate_weekly_issues = safeRows(
    db,
    `SELECT week_start, COUNT(*) as copies
     FROM weekly_news_issues
     GROUP BY week_start
     HAVING COUNT(*) > 1`
  );
}

if (tableExists(db, "search_index")) {
  const allowedTypes = ["item", "mob", "map", "npc", "quest", "skill"];
  const tableByType = {
    item: ["items", "id"],
    mob: ["mobs", "id"],
    map: ["maps", "id"],
    npc: ["npcs", "id"],
    quest: ["quests", "id"],
    skill: ["skills", "id"],
  };
  report.search.counts_by_type = safeRows(
    db,
    "SELECT entity_type, COUNT(*) as count FROM search_index GROUP BY entity_type ORDER BY entity_type"
  );
  report.search.invalid_types = safeRows(
    db,
    `SELECT entity_type, COUNT(*) as count
     FROM search_index
     WHERE entity_type NOT IN (${allowedTypes.map(() => "?").join(",")})
     GROUP BY entity_type`,
    allowedTypes
  );
  report.search.orphans = [];
  for (const [entityType, [table, idColumn]] of Object.entries(tableByType)) {
    const orphanCount = safeGet(
      db,
      `SELECT COUNT(*) as count
       FROM search_index s
       WHERE s.entity_type=?
         AND NOT EXISTS (SELECT 1 FROM ${table} e WHERE e.${idColumn}=s.entity_id)`,
      [entityType]
    )?.count ?? 0;
    if (orphanCount > 0) report.search.orphans.push({ entity_type: entityType, count: orphanCount });
  }
}

report.crosscheck.mobs_vs_wz83 = compareMobWithWz(db);
report.crosscheck.mobs_vs_mapleland_reference = compareMobWithMapleLandReference(db);
report.crosscheck.items_vs_mapleland_reference = compareEntityWithMapleLandReference(
  db,
  "items",
  `SELECT i.id, i.name, i.level_req, i.category, i.subcategory,
          n.name_en as name_kr
   FROM items i
   LEFT JOIN entity_names_en n
     ON n.entity_type='item' AND n.entity_id=i.id AND n.source='kms'
   WHERE ${visibleWhere(db, "items").replaceAll("is_hidden", "i.is_hidden")}`,
  { compareLevel: true, dbLevelField: "level_req", compareName: true }
);
report.crosscheck.maps_vs_mapleland_reference = compareEntityWithMapleLandReference(
  db,
  "maps",
  `SELECT m.id, m.name, m.street_name, m.area,
          n.name_en as name_kr
   FROM maps m
   LEFT JOIN entity_names_en n
     ON n.entity_type='map' AND n.entity_id=m.id AND n.source='kms'`
);
report.crosscheck.npcs_vs_mapleland_reference = compareEntityWithMapleLandReference(
  db,
  "npcs",
  `SELECT p.id, p.name, p.map_id, p.map_name,
          n.name_en as name_kr
   FROM npcs p
   LEFT JOIN entity_names_en n
     ON n.entity_type='npc' AND n.entity_id=p.id AND n.source='kms'`
);
report.crosscheck.quests_vs_mapleland_reference = compareQuestsWithMapleLandReference(db);

db.close();

if (!checkOnly) {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));
  console.log(`Data quality report written: ${OUT_PATH}`);
} else {
  console.log("Data quality check completed (report file unchanged)");
}

console.log(`Mobs: ${report.counts.mobs?.visible ?? 0} visible / ${report.counts.mobs?.total ?? 0} total`);
console.log(`Items: ${report.counts.items?.visible ?? 0} visible / ${report.counts.items?.total ?? 0} total`);
console.log(`Quests: ${report.counts.quests?.total ?? 0}`);
console.log(`Missing KMS names: mobs=${report.names.visible_mobs_without_kms_name ?? 0}, items=${report.names.visible_items_without_kms_name ?? 0}`);
if (report.crosscheck.mobs_vs_wz83) {
  console.log(`WZ83 mob crosscheck: perfect=${report.crosscheck.mobs_vs_wz83.perfect}, mismatched=${report.crosscheck.mobs_vs_wz83.mismatched}, not_in_wz=${report.crosscheck.mobs_vs_wz83.not_in_wz}`);
}
if (report.crosscheck.mobs_vs_mapleland_reference) {
  console.log(`MapleLand mob reference: visible_not_in_ref=${report.crosscheck.mobs_vs_mapleland_reference.visible_not_in_reference}, missing_in_db=${report.crosscheck.mobs_vs_mapleland_reference.reference_missing_in_db}, value_mismatches=${report.crosscheck.mobs_vs_mapleland_reference.value_mismatches}`);
}
for (const [label, key] of [
  ["item", "items_vs_mapleland_reference"],
  ["map", "maps_vs_mapleland_reference"],
  ["npc", "npcs_vs_mapleland_reference"],
]) {
  const entry = report.crosscheck[key];
  if (!entry) continue;
  console.log(`MapleLand ${label} reference: db_not_in_ref=${entry.db_not_in_reference}, missing_in_db=${entry.reference_missing_in_db}, value_mismatches=${entry.value_mismatches ?? 0}, name_mismatches=${entry.name_mismatches ?? 0}`);
}
if (report.crosscheck.quests_vs_mapleland_reference) {
  const entry = report.crosscheck.quests_vs_mapleland_reference;
  console.log(`MapleLand quest reference: db_name_not_in_ref=${entry.db_name_not_in_reference}, missing_name_in_db=${entry.reference_name_missing_in_db}, db=${entry.db_count}, ref=${entry.reference_count}`);
}

const criticalFailures = [
  ...(report.search.invalid_types || []).map((row) => `invalid search type ${row.entity_type}: ${row.count}`),
  ...(report.search.orphans || []).map((row) => `orphan search ${row.entity_type}: ${row.count}`),
  ...(report.anomalies.duplicate_weekly_issues || []).map((row) => `duplicate weekly issue ${row.week_start}: ${row.copies}`),
];
if (criticalFailures.length > 0) {
  console.error(`Critical integrity failures:\n- ${criticalFailures.join("\n- ")}`);
  if (checkOnly) process.exitCode = 1;
}
