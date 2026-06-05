#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT_PATH = path.join(ROOT, "data", "mapleland_mobs.json");
const SOURCE_URL = "https://mapledb.kr/mob.php";

function decodeHtml(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

async function main() {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${SOURCE_URL}: ${res.status}`);
  }
  const html = await res.text();
  const re =
    /search\.php\?q=(\d+)&t=mob[\s\S]*?<h3[^>]*>([^<]+)<\/h3>[\s\S]*?<div>LEVEL<\/div>\s*<div>([^<]+)<\/div>[\s\S]*?<div>HP<\/div>\s*<div>([^<]+)<\/div>/g;

  const seen = new Set();
  const mobs = [];
  let match;
  while ((match = re.exec(html))) {
    const id = Number(match[1]);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    mobs.push({
      id,
      name_kr: decodeHtml(match[2].trim()),
      level: Number(match[3].replace(/,/g, "")),
      hp: Number(match[4].replace(/,/g, "")),
    });
  }

  mobs.sort((a, b) => a.level - b.level || a.hp - b.hp || a.id - b.id);
  const payload = {
    source: "mapledb.kr",
    source_url: SOURCE_URL,
    fetched_at: new Date().toISOString(),
    total: mobs.length,
    mobs,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));
  console.log(`MapleLand mob reference written: ${OUT_PATH}`);
  console.log(`Mobs: ${mobs.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
