#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const COMBINED_OUT_PATH = path.join(DATA_DIR, "mapleland_reference.json");

const SOURCES = {
  mobs: {
    type: "mob",
    url: "https://mapledb.kr/mob.php",
    outFile: "mapleland_mobs.json",
  },
  items: {
    type: "item",
    url: "https://mapledb.kr/item.php",
    outFile: "mapleland_items.json",
  },
  maps: {
    type: "map",
    url: "https://mapledb.kr/map.php",
    outFile: "mapleland_maps.json",
  },
  npcs: {
    type: "npc",
    url: "https://mapledb.kr/npc.php",
    outFile: "mapleland_npcs.json",
  },
  quests: {
    type: "quest",
    url: "https://mapledb.kr/quest.php",
    outFile: "mapleland_quests.json",
  },
};

function decodeHtml(text) {
  return String(text ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function numberOrNull(value) {
  if (value == null) return null;
  const normalized = String(value).replace(/,/g, "").trim();
  if (!normalized || normalized === "-") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function attrValue(attrs, name) {
  const match = attrs.match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
  return match ? decodeHtml(match[1].trim()) : null;
}

function contentValue(body, label) {
  const match = body.match(new RegExp(`<div>${label}<\\/div>\\s*<div>([^<]+)<\\/div>`, "i"));
  return match ? decodeHtml(match[1].trim()) : null;
}

function extractTotal(html) {
  const totalMatch = html.match(/id="total_data"[^>]*>\s*\(?([\d,]+)개\)?/i);
  return numberOrNull(totalMatch?.[1]);
}

function parseList(html, kind) {
  const { type } = SOURCES[kind];
  const re = new RegExp(
    `<a([^>]*)href="https:\\/\\/mapledb\\.kr\\/search\\.php\\?q=(\\d+)&t=${type}"[^>]*>([\\s\\S]*?)<\\/a>`,
    "g"
  );
  const seen = new Set();
  const records = [];
  let match;

  while ((match = re.exec(html))) {
    const attrs = match[1] || "";
    const id = Number(match[2]);
    const body = match[3] || "";
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);

    const nameMatch = body.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const name = decodeHtml(nameMatch?.[1]?.trim());
    if (!name) continue;

    const record = {
      id,
      name_kr: name,
    };

    if (kind === "mobs") {
      record.level = numberOrNull(contentValue(body, "LEVEL"));
      record.hp = numberOrNull(contentValue(body, "HP"));
    }

    if (kind === "items") {
      record.level = numberOrNull(attrValue(attrs, "level") ?? contentValue(body, "LEVEL"));
      record.jobs = attrValue(attrs, "jobs");
    }

    records.push(record);
  }

  records.sort((a, b) => {
    if (kind === "mobs") {
      return (a.level ?? 0) - (b.level ?? 0) || (a.hp ?? 0) - (b.hp ?? 0) || a.id - b.id;
    }
    if (kind === "items") {
      return (a.level ?? 0) - (b.level ?? 0) || a.id - b.id;
    }
    return a.id - b.id;
  });

  return records;
}

async function fetchHtml(source) {
  const res = await fetch(source.url, {
    headers: {
      "User-Agent": "maple-db-audit/1.0 (+https://mapledb.kr)",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${source.url}: ${res.status}`);
  }
  return res.text();
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const combined = {
    source: "mapledb.kr",
    fetched_at: fetchedAt,
    entities: {},
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });

  for (const [kind, source] of Object.entries(SOURCES)) {
    const html = await fetchHtml(source);
    const records = parseList(html, kind);
    const payload = {
      source: "mapledb.kr",
      source_url: source.url,
      fetched_at: fetchedAt,
      total: records.length,
      page_total: extractTotal(html),
      [kind]: records,
    };

    const outPath = path.join(DATA_DIR, source.outFile);
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
    combined.entities[kind] = {
      source_url: source.url,
      total: records.length,
      page_total: payload.page_total,
      records,
    };
    console.log(`${kind}: ${records.length}${payload.page_total ? ` / page ${payload.page_total}` : ""}`);
  }

  fs.writeFileSync(COMBINED_OUT_PATH, JSON.stringify(combined, null, 2));
  console.log(`MapleLand reference written: ${COMBINED_OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
