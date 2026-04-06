/**
 * Quest.wz 파싱 데이터를 SQLite DB에 임포트하는 스크립트.
 * wz_data_v62/Quest_*.json → data/maple.db quests 테이블
 */
const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const DB_PATH = path.join(__dirname, '..', 'data', 'maple.db')
const WZ_DIR = path.join(__dirname, '..', 'wz_data_v62')

// Quest category mapping (from Etc_QuestCategory.json)
const CATEGORY_MAP = {
  10: '전직',
  20: '메이플 아일랜드',
  30: '빅토리아 아일랜드',
  33: '엘나스/아쿠아로드',
  37: '루디브리엄',
  40: '기타',
  41: '리프레',
  44: '무릉/니할사막',
  45: '마스테리아',
  46: '기타',
  47: '펫',
  48: '월드투어',
  49: '기타',
  50: '이벤트',
}

// Area code → Korean area name
const AREA_NAME_MAP = {
  10: '전직',
  15: '전직',
  20: '메이플 아일랜드',
  30: '빅토리아 아일랜드',
  33: '엘나스/아쿠아로드',
  37: '루디브리엄',
  40: '기타 지역',
  41: '리프레',
  44: '무릉/니할사막',
  45: '마스테리아',
  46: '기타 지역',
  47: '펫',
  49: '기타 지역',
  50: '이벤트',
}

function loadJson(filename) {
  const p = path.join(WZ_DIR, filename)
  if (!fs.existsSync(p)) {
    console.log(`  Warning: ${filename} not found`)
    return {}
  }
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

function main() {
  console.log('=== Importing Quest.wz data into DB ===')

  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')

  // Add new columns to quests table (ignore if already exist)
  const migrations = [
    'ALTER TABLE quests ADD COLUMN category TEXT',
    'ALTER TABLE quests ADD COLUMN prerequisite_quests TEXT',
    'ALTER TABLE quests ADD COLUMN required_items TEXT',
    'ALTER TABLE quests ADD COLUMN required_mobs TEXT',
    'ALTER TABLE quests ADD COLUMN completion_items TEXT',
    'ALTER TABLE quests ADD COLUMN quest_type TEXT',
    'ALTER TABLE quests ADD COLUMN area TEXT',
    'ALTER TABLE quests ADD COLUMN auto_start INTEGER DEFAULT 0',
    'ALTER TABLE quests ADD COLUMN npc_start_id INTEGER',
    'ALTER TABLE quests ADD COLUMN npc_end_id INTEGER',
    'ALTER TABLE quests ADD COLUMN exp_reward INTEGER DEFAULT 0',
    'ALTER TABLE quests ADD COLUMN meso_reward INTEGER DEFAULT 0',
    'ALTER TABLE quests ADD COLUMN reward_items TEXT',
    'ALTER TABLE quests ADD COLUMN npc_dialogue TEXT',
    'ALTER TABLE quests ADD COLUMN start_level INTEGER DEFAULT 0',
    'ALTER TABLE quests ADD COLUMN end_level INTEGER DEFAULT 0',
    'ALTER TABLE quests ADD COLUMN next_quest_id INTEGER',
  ]

  for (const sql of migrations) {
    try { db.exec(sql) } catch (e) { /* column already exists */ }
  }

  // Load all WZ data
  const questInfo = loadJson('Quest_QuestInfo.json')
  const questCheck = loadJson('Quest_Check.json')
  const questAct = loadJson('Quest_Act.json')
  const questSay = loadJson('Quest_Say.json')

  // Load string names (English) from existing DB entity_names_en
  // Load NPC names for mapping
  const npcNames = {}
  try {
    const npcRows = db.prepare('SELECT id, name FROM npcs').all()
    for (const r of npcRows) npcNames[r.id] = r.name
  } catch (e) {}

  // Load item names
  const itemNames = {}
  try {
    const itemRows = db.prepare('SELECT id, name FROM items').all()
    for (const r of itemRows) itemNames[r.id] = r.name
  } catch (e) {}

  // Load mob names
  const mobNames = {}
  try {
    const mobRows = db.prepare('SELECT id, name FROM mobs').all()
    for (const r of mobRows) mobNames[r.id] = r.name
  } catch (e) {}

  const upsert = db.prepare(`
    INSERT INTO quests (id, name, level_req, npc_start, npc_end, rewards, description,
      category, prerequisite_quests, required_items, required_mobs, completion_items,
      quest_type, area, auto_start, npc_start_id, npc_end_id,
      exp_reward, meso_reward, reward_items, npc_dialogue, start_level, end_level, next_quest_id)
    VALUES (?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      category = excluded.category,
      prerequisite_quests = excluded.prerequisite_quests,
      required_items = excluded.required_items,
      required_mobs = excluded.required_mobs,
      completion_items = excluded.completion_items,
      quest_type = excluded.quest_type,
      area = excluded.area,
      auto_start = excluded.auto_start,
      npc_start_id = excluded.npc_start_id,
      npc_end_id = excluded.npc_end_id,
      exp_reward = excluded.exp_reward,
      meso_reward = excluded.meso_reward,
      reward_items = excluded.reward_items,
      npc_dialogue = excluded.npc_dialogue,
      start_level = excluded.start_level,
      end_level = excluded.end_level,
      next_quest_id = excluded.next_quest_id,
      name = CASE WHEN quests.name IS NULL OR quests.name = '' THEN excluded.name ELSE quests.name END,
      level_req = CASE WHEN excluded.level_req > 0 THEN excluded.level_req ELSE quests.level_req END,
      npc_start = CASE WHEN excluded.npc_start IS NOT NULL AND excluded.npc_start != '' THEN excluded.npc_start ELSE quests.npc_start END,
      npc_end = CASE WHEN excluded.npc_end IS NOT NULL AND excluded.npc_end != '' THEN excluded.npc_end ELSE quests.npc_end END,
      description = CASE WHEN excluded.description IS NOT NULL AND excluded.description != '' THEN excluded.description ELSE quests.description END,
      rewards = CASE WHEN excluded.rewards IS NOT NULL AND excluded.rewards != '' THEN excluded.rewards ELSE quests.rewards END
  `)

  const insertTx = db.transaction(() => {
    let count = 0
    for (const questId of Object.keys(questInfo)) {
      const info = questInfo[questId]
      if (!info || typeof info !== 'object') continue

      const check0 = questCheck[questId]?.['0'] || {} // start conditions
      const check1 = questCheck[questId]?.['1'] || {} // completion conditions
      const act0 = questAct[questId]?.['0'] || {}     // on start
      const act1 = questAct[questId]?.['1'] || {}     // on completion
      const say0 = questSay[questId]?.['0'] || {}     // start dialogue
      const say1 = questSay[questId]?.['1'] || {}     // end dialogue

      // Quest name
      const name = info.name || `Quest ${questId}`

      // Level requirements
      const lvMin = check0.lvmin || 0
      const lvMax = check0.lvmax || 0

      // NPC IDs
      const npcStartId = check0.npc || null
      const npcEndId = check1.npc || null
      const npcStartName = npcStartId ? (npcNames[npcStartId] || `NPC ${npcStartId}`) : null
      const npcEndName = npcEndId ? (npcNames[npcEndId] || `NPC ${npcEndId}`) : null

      // Category / Area
      const areaCode = info.area
      const category = CATEGORY_MAP[areaCode] || '기타'
      const area = AREA_NAME_MAP[areaCode] || '기타'

      // Quest type
      let questType = '일반'
      if (info.autoStart) questType = '자동시작'
      if (check0.interval) questType = '반복'
      if (check0.dayByDay) questType = '반복'

      // Auto start
      const autoStart = info.autoStart ? 1 : 0

      // Prerequisite quests
      const prereqQuests = []
      if (check0.quest) {
        for (const key of Object.keys(check0.quest)) {
          const pq = check0.quest[key]
          if (pq && pq.id) prereqQuests.push({ id: pq.id, state: pq.state || 2 })
        }
      }

      // Required items (to start)
      const requiredItems = []
      if (check0.item) {
        for (const key of Object.keys(check0.item)) {
          const it = check0.item[key]
          if (it && it.id) {
            requiredItems.push({
              id: it.id,
              count: it.count || 1,
              name: itemNames[it.id] || null
            })
          }
        }
      }

      // Required mobs (for completion)
      const requiredMobs = []
      if (check1.mob) {
        for (const key of Object.keys(check1.mob)) {
          const mb = check1.mob[key]
          if (mb && mb.id) {
            requiredMobs.push({
              id: mb.id,
              count: mb.count || 1,
              name: mobNames[mb.id] || null
            })
          }
        }
      }

      // Completion items
      const completionItems = []
      if (check1.item) {
        for (const key of Object.keys(check1.item)) {
          const it = check1.item[key]
          if (it && it.id) {
            completionItems.push({
              id: it.id,
              count: it.count || 1,
              name: itemNames[it.id] || null
            })
          }
        }
      }

      // Rewards
      const expReward = act1.exp || 0
      const mesoReward = act1.money || 0
      const rewardItems = []
      if (act1.item) {
        for (const key of Object.keys(act1.item)) {
          const it = act1.item[key]
          if (it && it.id && (it.count > 0)) {
            rewardItems.push({
              id: it.id,
              count: it.count || 1,
              name: itemNames[it.id] || null
            })
          }
        }
      }

      // Build rewards summary string
      const rewardParts = []
      if (expReward > 0) rewardParts.push(`EXP ${expReward.toLocaleString()}`)
      if (mesoReward > 0) rewardParts.push(`메소 ${mesoReward.toLocaleString()}`)
      if (rewardItems.length > 0) {
        for (const ri of rewardItems) {
          const rName = ri.name || `아이템 #${ri.id}`
          rewardParts.push(ri.count > 1 ? `${rName} x${ri.count}` : rName)
        }
      }
      const rewardsStr = rewardParts.length > 0 ? JSON.stringify(
        Object.fromEntries([
          ...(expReward > 0 ? [['exp', expReward]] : []),
          ...(mesoReward > 0 ? [['meso', mesoReward]] : []),
          ...(rewardItems.length > 0 ? [['items', rewardItems.map(r => ({id: r.id, count: r.count, name: r.name}))]] : []),
        ])
      ) : null

      // Description from QuestInfo fields 0, 1, 2
      const desc = info['0'] || ''

      // Next quest
      const nextQuestId = act1.nextQuest || null

      // NPC Dialogue - extract text from Say
      let dialogue = null
      const dialogueParts = []
      for (const stage of [say0, say1]) {
        if (stage && typeof stage === 'object') {
          for (const k of Object.keys(stage)) {
            if (typeof stage[k] === 'string') {
              dialogueParts.push(stage[k])
            }
          }
        }
      }
      if (dialogueParts.length > 0) {
        dialogue = JSON.stringify(dialogueParts)
      }

      upsert.run(
        parseInt(questId), name, lvMin, npcStartName, npcEndName, rewardsStr, desc,
        category,
        prereqQuests.length > 0 ? JSON.stringify(prereqQuests) : null,
        requiredItems.length > 0 ? JSON.stringify(requiredItems) : null,
        requiredMobs.length > 0 ? JSON.stringify(requiredMobs) : null,
        completionItems.length > 0 ? JSON.stringify(completionItems) : null,
        questType, area, autoStart, npcStartId, npcEndId,
        expReward, mesoReward,
        rewardItems.length > 0 ? JSON.stringify(rewardItems) : null,
        dialogue, lvMin, lvMax, nextQuestId
      )
      count++
    }
    return count
  })

  const count = insertTx()
  console.log(`  -> ${count} quests imported/updated`)

  // Build quest chain data: for each quest, find what quests require it
  console.log('\n=== Verifying data ===')
  const total = db.prepare('SELECT COUNT(*) as cnt FROM quests').get()
  const withRewards = db.prepare('SELECT COUNT(*) as cnt FROM quests WHERE exp_reward > 0 OR meso_reward > 0').get()
  const withPrereq = db.prepare('SELECT COUNT(*) as cnt FROM quests WHERE prerequisite_quests IS NOT NULL').get()
  const withMobs = db.prepare('SELECT COUNT(*) as cnt FROM quests WHERE required_mobs IS NOT NULL').get()
  console.log(`  Total quests: ${total.cnt}`)
  console.log(`  With rewards: ${withRewards.cnt}`)
  console.log(`  With prerequisites: ${withPrereq.cnt}`)
  console.log(`  With mob requirements: ${withMobs.cnt}`)

  db.close()
  console.log('\nDone!')
}

main()
