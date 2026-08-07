#!/usr/bin/env node
/*
 * 메이플랜드 현행 공개 DB와 사이트 원작 데이터(v62/v83/GMS92)를 전수 대조한다.
 * 결과는 후보 감사용이며, 자동으로 라이브 값을 확정하지 않는다.
 */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const ROOT = path.resolve(__dirname, "..");
const DB_PATH = path.join(ROOT, "data", "maple.db");
const V62_DIR = path.join(ROOT, "wz_data_v62");
const V83_DIR = process.env.MAPLE_WZ83_DIR || path.join(ROOT, "wz_data");
const OUTPUT = path.join(ROOT, "data", "mapleland_difference_audit.json");
const EXCLUDED_MOBS = new Set([9300183, 9500190]);

function readJson(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

function loadItemInfo(dir) {
  if (!fs.existsSync(dir)) return {};
  const merged = {};
  for (const file of fs.readdirSync(dir).filter((name) => /^(Character|Item)_.+\.json$/.test(name))) {
    const rows = readJson(path.join(dir, file));
    for (const [rawId, row] of Object.entries(rows)) {
      const id = String(Number(rawId));
      if (id !== "NaN" && row && typeof row === "object") merged[id] = row;
    }
  }
  return merged;
}

function mobValue(row) {
  if (!row) return null;
  return { level: Number(row.level || 0), hp: Number(row.maxHP ?? row.hp ?? 0) };
}

function sameMob(a, b) {
  return Boolean(a && b && a.level === b.level && a.hp === b.hp);
}

function normalizeName(value) {
  return String(value || "").normalize("NFC").trim().replace(/\s+/g, " ");
}

function auditIdentity(table, entityType, liveRows, nameNormalizer = normalizeName) {
  const dbRows = db.prepare(
    `SELECT e.id, e.name,
       (SELECT n.name_en FROM entity_names_en n
        WHERE n.entity_type=? AND n.entity_id=e.id AND n.source='kms' LIMIT 1) name_kr
     FROM ${table} e`
  ).all(entityType);
  const dbById = new Map(dbRows.map((row) => [Number(row.id), row]));
  const liveById = new Map(liveRows.map((row) => [Number(row.id), row]));
  const shared = liveRows.filter((row) => dbById.has(Number(row.id)));
  const nameMismatches = shared.filter((row) => {
    const dbRow = dbById.get(Number(row.id));
    return nameNormalizer(dbRow.name_kr || dbRow.name) !== nameNormalizer(row.name_kr);
  });
  return {
    shared_ids: shared.length,
    site_only_ids: dbRows.filter((row) => !liveById.has(Number(row.id))).length,
    live_only_ids: liveRows.filter((row) => !dbById.has(Number(row.id))).length,
    shared_id_name_mismatches: nameMismatches.length,
    name_mismatch_samples: nameMismatches.slice(0, 20).map((row) => ({
      id: row.id,
      site: dbById.get(Number(row.id)).name_kr || dbById.get(Number(row.id)).name,
      live: row.name_kr,
    })),
  };
}

const liveMobsPayload = readJson(path.join(ROOT, "data", "mapleland_mobs.json"));
const liveItemsPayload = readJson(path.join(ROOT, "data", "mapleland_items.json"));
const liveMapsPayload = readJson(path.join(ROOT, "data", "mapleland_maps.json"));
const liveNpcsPayload = readJson(path.join(ROOT, "data", "mapleland_npcs.json"));
const liveQuestsPayload = readJson(path.join(ROOT, "data", "mapleland_quests.json"));
const liveMobs = liveMobsPayload.mobs || [];
const liveItems = liveItemsPayload.items || [];
const v62Mobs = readJson(path.join(V62_DIR, "Mob_info.json"));
const v83Mobs = readJson(path.join(V83_DIR, "Mob_info.json"));
const v62Items = loadItemInfo(V62_DIR);
const v83Items = loadItemInfo(V83_DIR);
const db = new Database(DB_PATH, { readonly: true });

const dbMobs = new Map(db.prepare("SELECT id, name, level, hp, COALESCE(is_hidden, 0) is_hidden FROM mobs").all().map((row) => [row.id, row]));
const dbItems = new Map(db.prepare("SELECT id, name, level_req, job_req, COALESCE(is_hidden, 0) is_hidden FROM items").all().map((row) => [row.id, row]));

const mobCandidates = [];
const excluded = [];
for (const live of liveMobs) {
  const baseline = dbMobs.get(live.id);
  if (!baseline) continue;
  const current = { level: Number(live.level || 0), hp: Number(live.hp || 0) };
  const gms92 = { level: Number(baseline.level || 0), hp: Number(baseline.hp || 0) };
  if (sameMob(current, gms92)) continue;
  if (baseline.is_hidden) {
    excluded.push({ type: "mob", id: live.id, name: live.name_kr, reason: "hidden_from_public_site" });
    continue;
  }
  if (EXCLUDED_MOBS.has(live.id)) {
    excluded.push({ type: "mob", id: live.id, name: live.name_kr, reason: "internal_or_sentinel" });
    continue;
  }
  const v62 = mobValue(v62Mobs[String(live.id)]);
  const v83 = mobValue(v83Mobs[String(live.id)]);
  let classification = "changed_candidate";
  if (sameMob(current, v62) || sameMob(current, v83)) classification = "original_version_difference";
  mobCandidates.push({ id: live.id, name: live.name_kr, live: current, gms92, v62, v83, classification });
}

const itemCandidates = [];
const parserCorrections = [];
const itemJobMismatches = [];
const normalizeJobs = (value) => String(value || "").split(/[,/]/)
  .map((job) => job.trim() === "법사" ? "마법사" : job.trim())
  .filter(Boolean)
  .sort();
const jobsFromReqCode = (rawCode) => {
  if (rawCode == null) return null;
  const code = Number(rawCode);
  if (code === -1) return ["궁수", "도적", "마법사", "전사"].sort();
  const jobs = [];
  if (code & 1) jobs.push("전사");
  if (code & 2) jobs.push("마법사");
  if (code & 4) jobs.push("궁수");
  if (code & 8) jobs.push("도적");
  if (code & 16) jobs.push("해적");
  return jobs.sort();
};
for (const live of liveItems) {
  const baseline = dbItems.get(live.id);
  if (!baseline) continue;
  const liveJobs = normalizeJobs(live.jobs);
  const dbJobs = normalizeJobs(baseline.job_req);
  const normalizedLiveJobs = liveJobs.length === 1 && liveJobs[0] === "공용" ? [] : liveJobs;
  const normalizedDbJobs = dbJobs.length === 1 && dbJobs[0] === "공용" ? [] : dbJobs;
  if (normalizedLiveJobs[0] !== "not" && JSON.stringify(normalizedLiveJobs) !== JSON.stringify(normalizedDbJobs)) {
    const v62Jobs = jobsFromReqCode(v62Items[String(live.id)]?.reqJob);
    const v83Jobs = jobsFromReqCode(v83Items[String(live.id)]?.reqJob);
    let classification = "changed_candidate";
    if (v83Jobs && JSON.stringify(normalizedLiveJobs) === JSON.stringify(v83Jobs)) classification = "gms92_parser_gap";
    else if (v62Jobs && JSON.stringify(normalizedLiveJobs) === JSON.stringify(v62Jobs)) classification = "original_version_difference";
    itemJobMismatches.push({
      id: live.id,
      name: live.name_kr,
      live: live.jobs,
      gms92_db: baseline.job_req || "공용",
      v62_req_job: v62Items[String(live.id)]?.reqJob ?? null,
      v83_req_job: v83Items[String(live.id)]?.reqJob ?? null,
      classification,
    });
  }
  if (Number(live.level || 0) === Number(baseline.level_req || 0)) continue;
  if (baseline.is_hidden) {
    excluded.push({ type: "item", id: live.id, name: live.name_kr, reason: "hidden_from_public_site" });
    continue;
  }
  const v62Level = v62Items[String(live.id)]?.reqLevel;
  const v83Level = v83Items[String(live.id)]?.reqLevel;
  const currentLevel = Number(live.level || 0);
  const row = {
    id: live.id,
    name: live.name_kr,
    live: { level_req: currentLevel, job_req: live.jobs },
    gms92_db: { level_req: Number(baseline.level_req || 0), job_req: baseline.job_req },
    v62: v62Level == null ? null : { level_req: Number(v62Level) },
    v83: v83Level == null ? null : { level_req: Number(v83Level) },
  };
  if (v83Level != null && currentLevel === Number(v83Level)) {
    parserCorrections.push({ ...row, classification: "gms92_parser_gap" });
  } else if (v62Level != null && currentLevel === Number(v62Level)) {
    itemCandidates.push({ ...row, classification: "original_version_difference" });
  } else {
    itemCandidates.push({ ...row, classification: "changed_candidate" });
  }
}

const normalizeMapName = (value) => normalizeName(value).split(":").pop().trim();
const mapIdentity = auditIdentity("maps", "map", liveMapsPayload.maps || [], normalizeMapName);
const npcIdentity = auditIdentity("npcs", "npc", liveNpcsPayload.npcs || []);
const dbQuestNames = new Set(db.prepare("SELECT name FROM quests").all().map((row) => normalizeName(row.name)));
const liveQuestNames = new Set((liveQuestsPayload.quests || []).map((row) => normalizeName(row.name_kr)));
const questIdentity = {
  shared_names: [...dbQuestNames].filter((name) => liveQuestNames.has(name)).length,
  site_only_names: [...dbQuestNames].filter((name) => !liveQuestNames.has(name)).length,
  live_only_names: [...liveQuestNames].filter((name) => !dbQuestNames.has(name)).length,
  note: "사이트 퀘스트 ID가 AUTOINCREMENT 대체키여서 이름 기준으로만 비교",
};

const result = {
  generated_at: new Date().toISOString(),
  policy: {
    live_source: liveMobsPayload.source_url || "https://mapledb.kr/",
    original_snapshots: ["local WZ v62", "local WZ v83", "maplestory.io GMS92-derived site DB"],
    rule: "공식·복수 실측 확인 전에는 후보를 자동 확정하지 않으며 판본 일치와 메이플랜드 변경을 분리한다.",
  },
  coverage: {
    mobs: { site: dbMobs.size, site_visible: [...dbMobs.values()].filter((row) => !row.is_hidden).length, live: liveMobs.length, fields: ["id", "name", "level", "hp"] },
    items: { site: dbItems.size, site_visible: [...dbItems.values()].filter((row) => !row.is_hidden).length, live: liveItems.length, fields: ["id", "name", "level_req", "job_req"] },
    maps: { site: db.prepare("SELECT COUNT(*) count FROM maps").get().count, live: liveMapsPayload.maps?.length || liveMapsPayload.total || 0, fields: ["id", "name"] },
    npcs: { site: db.prepare("SELECT COUNT(*) count FROM npcs").get().count, live: liveNpcsPayload.npcs?.length || liveNpcsPayload.total || 0, fields: ["id", "name"] },
    quests: { site: db.prepare("SELECT COUNT(*) count FROM quests").get().count, live: liveQuestsPayload.quests?.length || liveQuestsPayload.total || 0, fields: ["name"], note: "양쪽 ID 체계가 달라 이름 기준" },
    skills: { site: db.prepare("SELECT COUNT(*) count FROM skills").get().count, live: null, fields: ["official_patch_skill_name", "current_behavior"] },
  },
  summary: {
    mob_candidates: mobCandidates.length,
    item_candidates: itemCandidates.length,
    parser_false_positives: parserCorrections.length,
    item_job_mismatches: itemJobMismatches.length,
    item_job_parser_corrections: itemJobMismatches.filter((row) => row.classification === "gms92_parser_gap").length,
    item_job_version_differences: itemJobMismatches.filter((row) => row.classification === "original_version_difference").length,
    item_job_changed_candidates: itemJobMismatches.filter((row) => row.classification === "changed_candidate").length,
    excluded_internal_records: excluded.length,
  },
  candidates: { mobs: mobCandidates, items: itemCandidates },
  job_mismatch_candidates: itemJobMismatches,
  identity_audits: { maps: mapIdentity, npcs: npcIdentity, quests: questIdentity },
  parser_corrections: parserCorrections,
  excluded,
};

fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Wrote ${path.relative(ROOT, OUTPUT)}`);
console.log(JSON.stringify(result.summary, null, 2));
