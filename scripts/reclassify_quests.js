#!/usr/bin/env node
/**
 * reclassify_quests.js
 *
 * mapledb.kr 크롤링 결과 + 규칙 기반으로 is_mapleland 재분류
 *
 * 재분류 규칙 (순서):
 * 1. 시그너스 기사단 (20000-29999) → is_mapleland=0
 * 2. TMS/SEA 전용 (50000+) → is_mapleland=0
 * 3. 이벤트 퀘스트: 중국어/영어전용/시즌성 → is_mapleland=0
 * 4. 이벤트 퀘스트: 한국어 포함이라도 상시가 아닌 것 → is_mapleland=0
 * 5. 해외 전용 지역 키워드 (싱가포르/말레이시아/일본) → is_mapleland=0
 * 6. 마스테리아(GMS 전용) 중 mapledb.kr 미등재 → is_mapleland=0
 * 7. 비한국어 이름 퀘스트 (잔여 해외전용) → is_mapleland=0
 * 8. mapledb.kr에 있는 퀘스트 → is_mapleland=1 확정 (최우선, 모든 규칙 오버라이드)
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'maple.db');
const MAPLEDB_IDS_PATH = path.join(__dirname, '..', 'wz_data_v62', 'Quest_MapleDB_IDs.json');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ─── mapledb.kr 확인된 ID 로드 ───
const mapledbData = JSON.parse(fs.readFileSync(MAPLEDB_IDS_PATH, 'utf8'));
const mapledbIds = new Set(mapledbData.quest_ids);
console.log(`[INFO] mapledb.kr 확인된 퀘스트 ID: ${mapledbIds.size}건`);

// ─── 통계 추적 ───
const stats = {
  cygnus: 0,
  tms_sea: 0,
  event_foreign: 0,
  event_seasonal: 0,
  event_english_only: 0,
  event_korean_remaining: 0,
  overseas_region: 0,
  masteria_overseas: 0,
  non_korean_misc: 0,
  mapledb_restored: 0,
  mapledb_not_in_db: 0,
};

// ─── 유틸리티 ───
function hasKorean(text) {
  return /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(text);
}
function hasChinese(text) {
  return /[\u4E00-\u9FFF\u3400-\u4DBF]/.test(text);
}

// ─── 상수 ───
const SEASONAL_KEYWORDS = [
  '할로윈', '크리스마스', '발렌타인', '화이트데이',
  'Halloween', 'Christmas', 'Easter', 'Valentine',
  'Xmas', 'X-mas', 'Maplemas', 'Snowman',
  '聖誕', '萬聖', '情人',
];

const PERMANENT_EVENT_IDS = new Set([
  1047, // 몬스터북 지정몬스터 효과
  9955, // 아리안트 투기대회
]);

const PERMANENT_EVENT_KEYWORDS = ['몬스터북', '투기대회'];

const OVERSEAS_KEYWORDS = [
  'Ulu City', 'Kampung', 'CBD', 'Singapore',
  'Showa', 'Mushroom Shrine', 'Zipangu',
  'Malaysia', 'Boat Quay',
  '싱가포르', '말레이시아', '쇼와', '소림사',
];

// ─── 현재 상태 기록 ───
const beforeCount = db.prepare('SELECT COUNT(*) as c FROM quests WHERE is_mapleland=1').get().c;
console.log(`\n[BEFORE] is_mapleland=1: ${beforeCount}건`);
console.log(`[BEFORE] is_mapleland=0: ${db.prepare('SELECT COUNT(*) as c FROM quests WHERE is_mapleland=0').get().c}건`);

const updateTo0 = db.prepare('UPDATE quests SET is_mapleland=0 WHERE id=?');
const updateTo1 = db.prepare('UPDATE quests SET is_mapleland=1 WHERE id=?');

const changedTo0 = [];
const changedTo1 = [];
const alreadyChanged = new Set();

function markAs0(q, reason, statKey) {
  if (alreadyChanged.has(q.id)) return;
  updateTo0.run(q.id);
  changedTo0.push({ id: q.id, name: q.name, reason });
  alreadyChanged.add(q.id);
  stats[statKey]++;
}

const applyAll = db.transaction(() => {
  // ─── 1. 시그너스 기사단 (20000-29999) ───
  const cygnusQuests = db.prepare(
    'SELECT id, name FROM quests WHERE id BETWEEN 20000 AND 29999 AND is_mapleland=1'
  ).all();
  for (const q of cygnusQuests) {
    if (mapledbIds.has(q.id)) continue;
    markAs0(q, '시그너스 기사단 (20000-29999)', 'cygnus');
  }

  // ─── 2. TMS/SEA 전용 (50000+) ───
  const tmsQuests = db.prepare(
    'SELECT id, name FROM quests WHERE id >= 50000 AND is_mapleland=1'
  ).all();
  for (const q of tmsQuests) {
    if (mapledbIds.has(q.id)) continue;
    markAs0(q, 'TMS/SEA 전용 (50000+)', 'tms_sea');
  }

  // ─── 3. 이벤트 퀘스트 (외국어/시즌성) ───
  const eventQuests = db.prepare(
    "SELECT id, name FROM quests WHERE area='이벤트' AND is_mapleland=1"
  ).all();
  for (const q of eventQuests) {
    if (mapledbIds.has(q.id)) continue;
    if (PERMANENT_EVENT_IDS.has(q.id)) continue;
    if (PERMANENT_EVENT_KEYWORDS.some(kw => q.name.includes(kw))) continue;

    if (hasChinese(q.name) && !hasKorean(q.name)) {
      markAs0(q, '이벤트 - 중국어/해외전용', 'event_foreign');
    } else if (!hasKorean(q.name) && !hasChinese(q.name)) {
      markAs0(q, '이벤트 - 영어전용 (해외)', 'event_english_only');
    } else if (SEASONAL_KEYWORDS.some(kw => q.name.toLowerCase().includes(kw.toLowerCase()))) {
      markAs0(q, '이벤트 - 시즌성', 'event_seasonal');
    }
  }

  // ─── 4. 이벤트 퀘스트 (한국어 포함 잔여 이벤트 - 상시 아닌 것) ───
  const remainingEvents = db.prepare(
    "SELECT id, name FROM quests WHERE area='이벤트' AND is_mapleland=1"
  ).all();
  for (const q of remainingEvents) {
    if (mapledbIds.has(q.id)) continue;
    if (PERMANENT_EVENT_IDS.has(q.id)) continue;
    if (PERMANENT_EVENT_KEYWORDS.some(kw => q.name.includes(kw))) continue;
    if (alreadyChanged.has(q.id)) continue;
    markAs0(q, '이벤트 - 비활성 한국어 이벤트', 'event_korean_remaining');
  }

  // ─── 5. 해외 전용 지역 키워드 ───
  const allMapleland = db.prepare(
    'SELECT id, name, area FROM quests WHERE is_mapleland=1'
  ).all();
  for (const q of allMapleland) {
    if (mapledbIds.has(q.id)) continue;
    if (alreadyChanged.has(q.id)) continue;
    if (OVERSEAS_KEYWORDS.some(kw => q.name.includes(kw))) {
      markAs0(q, `해외 전용 지역 (${q.area})`, 'overseas_region');
    }
  }

  // ─── 6. 마스테리아(GMS 전용) ───
  const masteriaQuests = db.prepare(
    "SELECT id, name FROM quests WHERE area='마스테리아' AND is_mapleland=1"
  ).all();
  for (const q of masteriaQuests) {
    if (mapledbIds.has(q.id)) continue;
    if (alreadyChanged.has(q.id)) continue;
    markAs0(q, '마스테리아/GMS 전용', 'masteria_overseas');
  }

  // ─── 7. 비한국어 이름 잔여 퀘스트 ───
  const allRemaining = db.prepare(
    'SELECT id, name, area FROM quests WHERE is_mapleland=1'
  ).all();
  for (const q of allRemaining) {
    if (mapledbIds.has(q.id)) continue;
    if (alreadyChanged.has(q.id)) continue;
    if (!hasKorean(q.name) && q.name.length > 0) {
      markAs0(q, `비한국어 잔여 (${q.area})`, 'non_korean_misc');
    }
  }

  // ─── 8. mapledb.kr 확인 → is_mapleland=1 복원 (최우선) ───
  for (const qid of mapledbIds) {
    const row = db.prepare('SELECT id, name, is_mapleland FROM quests WHERE id=?').get(qid);
    if (!row) {
      stats.mapledb_not_in_db++;
      continue;
    }
    if (row.is_mapleland === 0) {
      updateTo1.run(qid);
      changedTo1.push({ id: qid, name: row.name, reason: 'mapledb.kr 확인' });
      stats.mapledb_restored++;
    }
  }
});

applyAll();

// ─── 결과 출력 ───
const afterCount = db.prepare('SELECT COUNT(*) as c FROM quests WHERE is_mapleland=1').get().c;

console.log('\n' + '='.repeat(60));
console.log('재분류 결과');
console.log('='.repeat(60));

console.log(`\n[변경: is_mapleland=1 → 0] 총 ${changedTo0.length}건`);
console.log(`  - 시그너스 기사단: ${stats.cygnus}건`);
console.log(`  - TMS/SEA 전용: ${stats.tms_sea}건`);
console.log(`  - 이벤트(중국어/해외전용): ${stats.event_foreign}건`);
console.log(`  - 이벤트(영어전용): ${stats.event_english_only}건`);
console.log(`  - 이벤트(시즌성): ${stats.event_seasonal}건`);
console.log(`  - 이벤트(한국어 비활성): ${stats.event_korean_remaining}건`);
console.log(`  - 해외 전용 지역: ${stats.overseas_region}건`);
console.log(`  - 마스테리아/GMS 전용: ${stats.masteria_overseas}건`);
console.log(`  - 비한국어 잔여: ${stats.non_korean_misc}건`);

console.log(`\n[변경: is_mapleland=0 → 1] 총 ${changedTo1.length}건`);
console.log(`  - mapledb.kr 확인: ${stats.mapledb_restored}건`);

console.log(`\n[mapledb.kr에만 있고 DB에 없음] ${stats.mapledb_not_in_db}건`);

console.log(`\n[AFTER] is_mapleland=1: ${afterCount}건 (변화: ${afterCount - beforeCount})`);
console.log(`[AFTER] is_mapleland=0: ${db.prepare('SELECT COUNT(*) as c FROM quests WHERE is_mapleland=0').get().c}건`);

// ─── 변경 로그 저장 ───
const logPath = path.join(__dirname, '..', 'data', 'reclassify_log.json');
fs.writeFileSync(logPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  before_mapleland_1: beforeCount,
  after_mapleland_1: afterCount,
  changed_to_0: changedTo0,
  changed_to_1: changedTo1,
  mapledb_not_in_db: stats.mapledb_not_in_db,
  stats,
}, null, 2), 'utf8');
console.log(`\n[LOG] 상세 로그 저장: ${logPath}`);

// ─── mapledb.kr에 있지만 DB에 없는 ID ───
const missingIds = [];
for (const qid of mapledbIds) {
  if (!db.prepare('SELECT id FROM quests WHERE id=?').get(qid)) {
    missingIds.push(qid);
  }
}
if (missingIds.length > 0) {
  console.log(`\n[WARNING] mapledb.kr에 있지만 DB에 없는 퀘스트 ID (${missingIds.length}건):`);
  console.log(missingIds.join(', '));
}

// ─── Area별 최종 통계 ───
console.log('\n[FINAL] Area별 is_mapleland=1 분포:');
db.prepare(
  "SELECT area, COUNT(*) as c FROM quests WHERE is_mapleland=1 GROUP BY area ORDER BY c DESC"
).all().forEach(row => {
  console.log(`  ${row.area || '(없음)'}: ${row.c}건`);
});

db.close();
console.log('\n완료.');
