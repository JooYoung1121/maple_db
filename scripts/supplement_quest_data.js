/**
 * 퀘스트 데이터 보완 스크립트
 *
 * 1. is_mapleland 컬럼 추가 및 v62 존재 여부 마킹
 * 2. Quest_Check.json에서 레벨 데이터 보완
 * 3. NPC 이름 매칭 (한국어)
 * 4. 기존 entity_names_en의 한국어 이름을 quests.name에 반영
 * 5. QuestInfo의 중국어(TW) 이름을 entity_names_en에 source='tw_wz'로 저장
 */
const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const DB_PATH = path.join(__dirname, '..', 'data', 'maple.db')
const WZ_DIR = path.join(__dirname, '..', 'wz_data_v62')

function loadJson(filename) {
  const p = path.join(WZ_DIR, filename)
  if (!fs.existsSync(p)) {
    console.log(`  Warning: ${filename} not found`)
    return {}
  }
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

function main() {
  console.log('=== 퀘스트 데이터 보완 시작 ===\n')

  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')

  // ──────────────────────────────────────────
  // 보완 전 상태 스냅샷
  // ──────────────────────────────────────────
  console.log('--- 보완 전 상태 ---')
  const beforeStats = getStats(db)
  printStats(beforeStats)

  // ──────────────────────────────────────────
  // 1. is_mapleland 컬럼 추가
  // ──────────────────────────────────────────
  console.log('\n[1] is_mapleland 컬럼 추가...')
  try {
    db.exec('ALTER TABLE quests ADD COLUMN is_mapleland INTEGER DEFAULT 1')
    console.log('  -> 컬럼 생성 완료')
  } catch (e) {
    console.log('  -> 이미 존재')
  }

  // v62 퀘스트 ID 목록 로드
  const questInfo = loadJson('Quest_QuestInfo.json')
  const questCheck = loadJson('Quest_Check.json')
  const questAct = loadJson('Quest_Act.json')
  const v62QuestIds = new Set(Object.keys(questInfo).map(Number))
  console.log(`  v62 WZ 퀘스트 수: ${v62QuestIds.size}`)

  // 모든 퀘스트에 대해 is_mapleland 마킹
  const markMapleland = db.prepare('UPDATE quests SET is_mapleland = ? WHERE id = ?')
  const allQuestIds = db.prepare('SELECT id FROM quests').all()

  const markTx = db.transaction(() => {
    let mapleland = 0, nonMapleland = 0
    for (const { id } of allQuestIds) {
      if (v62QuestIds.has(id)) {
        markMapleland.run(1, id)
        mapleland++
      } else {
        markMapleland.run(0, id)
        nonMapleland++
      }
    }
    return { mapleland, nonMapleland }
  })

  const markResult = markTx()
  console.log(`  -> 메이플랜드 퀘스트: ${markResult.mapleland}개`)
  console.log(`  -> 비메이플랜드 퀘스트: ${markResult.nonMapleland}개`)

  // v62에는 있지만 DB에 없는 퀘스트 삽입
  const existingIds = new Set(allQuestIds.map(r => r.id))
  const insertNewQuest = db.prepare(`
    INSERT OR IGNORE INTO quests (id, name, is_mapleland) VALUES (?, ?, 1)
  `)
  const insertTx = db.transaction(() => {
    let inserted = 0
    for (const qid of v62QuestIds) {
      if (!existingIds.has(qid)) {
        const info = questInfo[String(qid)]
        const name = info?.name || `Quest ${qid}`
        insertNewQuest.run(qid, name)
        inserted++
      }
    }
    return inserted
  })
  const newCount = insertTx()
  if (newCount > 0) {
    console.log(`  -> 새로 추가된 v62 퀘스트: ${newCount}개`)
  }

  // ──────────────────────────────────────────
  // 2. 레벨 데이터 보완
  // ──────────────────────────────────────────
  console.log('\n[2] 레벨 데이터 보완...')

  const updateLevel = db.prepare(`
    UPDATE quests SET
      level_req = CASE WHEN level_req = 0 AND ? > 0 THEN ? ELSE level_req END,
      start_level = CASE WHEN start_level = 0 AND ? > 0 THEN ? ELSE start_level END,
      end_level = CASE WHEN (end_level = 0 OR end_level IS NULL) AND ? > 0 THEN ? ELSE end_level END
    WHERE id = ?
  `)

  const levelTx = db.transaction(() => {
    let updated = 0
    for (const [qid, checkData] of Object.entries(questCheck)) {
      const check0 = checkData?.['0'] || {}
      const lvmin = check0.lvmin || 0
      const lvmax = check0.lvmax || 0

      if (lvmin > 0 || lvmax > 0) {
        const result = updateLevel.run(lvmin, lvmin, lvmin, lvmin, lvmax, lvmax, parseInt(qid))
        if (result.changes > 0) updated++
      }
    }
    return updated
  })

  const levelUpdated = levelTx()
  console.log(`  -> ${levelUpdated}개 퀘스트 레벨 정보 업데이트`)

  // ──────────────────────────────────────────
  // 3. NPC 이름 매칭 (한국어)
  // ──────────────────────────────────────────
  console.log('\n[3] NPC 이름 매칭...')

  // DB에서 NPC 이름 가져오기
  const npcNames = {}
  try {
    const npcRows = db.prepare('SELECT id, name FROM npcs').all()
    for (const r of npcRows) npcNames[r.id] = r.name
  } catch (e) {}

  // entity_names_en에서 NPC 한국어 이름도 가져오기 (source='kms')
  const npcKorNames = {}
  try {
    const rows = db.prepare("SELECT entity_id, name_en FROM entity_names_en WHERE entity_type='npc' AND source='kms'").all()
    for (const r of rows) npcKorNames[r.entity_id] = r.name_en
  } catch (e) {}

  const updateNpc = db.prepare(`
    UPDATE quests SET
      npc_start = COALESCE(?, npc_start),
      npc_end = COALESCE(?, npc_end),
      npc_start_id = COALESCE(?, npc_start_id),
      npc_end_id = COALESCE(?, npc_end_id)
    WHERE id = ?
  `)

  const npcTx = db.transaction(() => {
    let updated = 0
    for (const [qid, checkData] of Object.entries(questCheck)) {
      const check0 = checkData?.['0'] || {}
      const check1 = checkData?.['1'] || {}

      const npcStartId = check0.npc || null
      const npcEndId = check1.npc || null

      // 한국어 NPC 이름 우선, 없으면 DB 이름
      const npcStartName = npcStartId
        ? (npcKorNames[npcStartId] || npcNames[npcStartId] || null)
        : null
      const npcEndName = npcEndId
        ? (npcKorNames[npcEndId] || npcNames[npcEndId] || null)
        : null

      if (npcStartName || npcEndName || npcStartId || npcEndId) {
        updateNpc.run(npcStartName, npcEndName, npcStartId, npcEndId, parseInt(qid))
        updated++
      }
    }
    return updated
  })

  const npcUpdated = npcTx()
  console.log(`  -> ${npcUpdated}개 퀘스트 NPC 정보 업데이트`)

  // ──────────────────────────────────────────
  // 4. 한국어 이름 반영: entity_names_en → quests.name
  // ──────────────────────────────────────────
  console.log('\n[4] 한국어 이름 반영...')

  // entity_names_en에서 한국어 퀘스트 이름 가져오기
  const korNames = {}
  try {
    const rows = db.prepare("SELECT entity_id, name_en FROM entity_names_en WHERE entity_type='quest' AND source='kms'").all()
    for (const r of rows) korNames[r.entity_id] = r.name_en
  } catch (e) {}

  // 현재 영어인 퀘스트 이름을 한국어로 교체
  const updateName = db.prepare(`
    UPDATE quests SET name = ? WHERE id = ?
  `)

  const nameTx = db.transaction(() => {
    let updated = 0
    for (const [id, name] of Object.entries(korNames)) {
      if (name && name.trim()) {
        const result = updateName.run(name.trim(), parseInt(id))
        if (result.changes > 0) updated++
      }
    }
    return updated
  })

  const nameUpdated = nameTx()
  console.log(`  -> ${nameUpdated}개 퀘스트 이름을 한국어로 변경`)

  // ──────────────────────────────────────────
  // 5. QuestInfo 중국어(TW) 이름을 entity_names_en에 저장
  // ──────────────────────────────────────────
  console.log('\n[5] 중국어(TW) 퀘스트 이름 저장...')

  const insertTwName = db.prepare(`
    INSERT OR REPLACE INTO entity_names_en (entity_type, entity_id, name_en, source)
    VALUES ('quest', ?, ?, 'tw_wz')
  `)

  const twTx = db.transaction(() => {
    let count = 0
    for (const [qid, info] of Object.entries(questInfo)) {
      if (info && info.name) {
        insertTwName.run(parseInt(qid), info.name)
        count++
      }
    }
    return count
  })

  const twCount = twTx()
  console.log(`  -> ${twCount}개 중국어 퀘스트 이름 저장`)

  // ──────────────────────────────────────────
  // 6. 카테고리/영역 보완 (QuestInfo에서)
  // ──────────────────────────────────────────
  console.log('\n[6] 카테고리/영역 보완...')

  const AREA_MAP = {
    10: '전직', 15: '전직',
    20: '메이플 아일랜드',
    30: '빅토리아 아일랜드',
    33: '엘나스/아쿠아로드',
    37: '루디브리엄',
    40: '기타 지역', 41: '리프레',
    44: '무릉/니할사막', 45: '마스테리아',
    46: '기타 지역', 47: '펫',
    48: '월드투어', 49: '기타 지역',
    50: '이벤트',
  }

  const updateCatArea = db.prepare(`
    UPDATE quests SET
      category = COALESCE(?, category),
      area = COALESCE(?, area)
    WHERE id = ? AND (category IS NULL OR area IS NULL)
  `)

  const catTx = db.transaction(() => {
    let updated = 0
    for (const [qid, info] of Object.entries(questInfo)) {
      if (info && info.area !== undefined) {
        const area = AREA_MAP[info.area] || '기타'
        const result = updateCatArea.run(area, area, parseInt(qid))
        if (result.changes > 0) updated++
      }
    }
    return updated
  })

  const catUpdated = catTx()
  console.log(`  -> ${catUpdated}개 퀘스트 카테고리/영역 보완`)

  // ──────────────────────────────────────────
  // 7. quest_type 보완 (반복/자동시작 등)
  // ──────────────────────────────────────────
  console.log('\n[7] 퀘스트 타입 보완...')

  const updateType = db.prepare(`
    UPDATE quests SET quest_type = ?, auto_start = ?
    WHERE id = ? AND (quest_type IS NULL)
  `)

  const typeTx = db.transaction(() => {
    let updated = 0
    for (const [qid, info] of Object.entries(questInfo)) {
      if (!info) continue
      const check0 = questCheck[qid]?.['0'] || {}

      let questType = '일반'
      if (info.autoStart) questType = '자동시작'
      if (check0.interval || check0.dayByDay) questType = '반복'

      const autoStart = info.autoStart ? 1 : 0
      const result = updateType.run(questType, autoStart, parseInt(qid))
      if (result.changes > 0) updated++
    }
    return updated
  })

  const typeUpdated = typeTx()
  console.log(`  -> ${typeUpdated}개 퀘스트 타입 보완`)

  // ──────────────────────────────────────────
  // 8. 보상 데이터 보완 (Act.json에서)
  // ──────────────────────────────────────────
  console.log('\n[8] 보상 데이터 보완...')

  // 아이템 이름 로드
  const itemNames = {}
  try {
    const rows = db.prepare('SELECT id, name FROM items').all()
    for (const r of rows) itemNames[r.id] = r.name
  } catch (e) {}

  const updateRewards = db.prepare(`
    UPDATE quests SET
      exp_reward = CASE WHEN (exp_reward IS NULL OR exp_reward = 0) AND ? > 0 THEN ? ELSE exp_reward END,
      meso_reward = CASE WHEN (meso_reward IS NULL OR meso_reward = 0) AND ? > 0 THEN ? ELSE meso_reward END,
      reward_items = CASE WHEN reward_items IS NULL AND ? IS NOT NULL THEN ? ELSE reward_items END,
      rewards = CASE WHEN rewards IS NULL AND ? IS NOT NULL THEN ? ELSE rewards END
    WHERE id = ?
  `)

  const rewardTx = db.transaction(() => {
    let updated = 0
    for (const [qid, actData] of Object.entries(questAct)) {
      const act1 = actData?.['1'] || {}
      const exp = act1.exp || 0
      const meso = act1.money || 0

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

      const rewardItemsJson = rewardItems.length > 0 ? JSON.stringify(rewardItems) : null

      // Build rewards summary
      const rewardsObj = {}
      if (exp > 0) rewardsObj.exp = exp
      if (meso > 0) rewardsObj.meso = meso
      if (rewardItems.length > 0) rewardsObj.items = rewardItems
      const rewardsJson = Object.keys(rewardsObj).length > 0 ? JSON.stringify(rewardsObj) : null

      if (exp > 0 || meso > 0 || rewardItemsJson) {
        const result = updateRewards.run(
          exp, exp, meso, meso,
          rewardItemsJson, rewardItemsJson,
          rewardsJson, rewardsJson,
          parseInt(qid)
        )
        if (result.changes > 0) updated++
      }
    }
    return updated
  })

  const rewardUpdated = rewardTx()
  console.log(`  -> ${rewardUpdated}개 퀘스트 보상 정보 보완`)

  // ──────────────────────────────────────────
  // 9. 선행 퀘스트 / 필요 몹 / 필요 아이템 보완
  // ──────────────────────────────────────────
  console.log('\n[9] 선행 퀘스트/필요 몹/아이템 보완...')

  const mobNames = {}
  try {
    const rows = db.prepare('SELECT id, name FROM mobs').all()
    for (const r of rows) mobNames[r.id] = r.name
  } catch (e) {}

  const updateReqs = db.prepare(`
    UPDATE quests SET
      prerequisite_quests = CASE WHEN prerequisite_quests IS NULL AND ? IS NOT NULL THEN ? ELSE prerequisite_quests END,
      required_items = CASE WHEN required_items IS NULL AND ? IS NOT NULL THEN ? ELSE required_items END,
      required_mobs = CASE WHEN required_mobs IS NULL AND ? IS NOT NULL THEN ? ELSE required_mobs END,
      completion_items = CASE WHEN completion_items IS NULL AND ? IS NOT NULL THEN ? ELSE completion_items END,
      next_quest_id = CASE WHEN next_quest_id IS NULL AND ? IS NOT NULL THEN ? ELSE next_quest_id END
    WHERE id = ?
  `)

  const reqTx = db.transaction(() => {
    let updated = 0
    for (const [qid, checkData] of Object.entries(questCheck)) {
      const check0 = checkData?.['0'] || {}
      const check1 = checkData?.['1'] || {}
      const act1 = questAct[qid]?.['1'] || {}

      // Prerequisite quests
      const prereqs = []
      if (check0.quest) {
        for (const key of Object.keys(check0.quest)) {
          const pq = check0.quest[key]
          if (pq && pq.id) prereqs.push({ id: pq.id, state: pq.state || 2 })
        }
      }

      // Required items (start)
      const reqItems = []
      if (check0.item) {
        for (const key of Object.keys(check0.item)) {
          const it = check0.item[key]
          if (it && it.id) reqItems.push({ id: it.id, count: it.count || 1, name: itemNames[it.id] || null })
        }
      }

      // Required mobs (completion)
      const reqMobs = []
      if (check1.mob) {
        for (const key of Object.keys(check1.mob)) {
          const mb = check1.mob[key]
          if (mb && mb.id) reqMobs.push({ id: mb.id, count: mb.count || 1, name: mobNames[mb.id] || null })
        }
      }

      // Completion items
      const compItems = []
      if (check1.item) {
        for (const key of Object.keys(check1.item)) {
          const it = check1.item[key]
          if (it && it.id) compItems.push({ id: it.id, count: it.count || 1, name: itemNames[it.id] || null })
        }
      }

      // Next quest
      const nextQuest = act1.nextQuest || null

      const prereqJson = prereqs.length > 0 ? JSON.stringify(prereqs) : null
      const reqItemJson = reqItems.length > 0 ? JSON.stringify(reqItems) : null
      const reqMobJson = reqMobs.length > 0 ? JSON.stringify(reqMobs) : null
      const compItemJson = compItems.length > 0 ? JSON.stringify(compItems) : null

      if (prereqJson || reqItemJson || reqMobJson || compItemJson || nextQuest) {
        const result = updateReqs.run(
          prereqJson, prereqJson,
          reqItemJson, reqItemJson,
          reqMobJson, reqMobJson,
          compItemJson, compItemJson,
          nextQuest, nextQuest,
          parseInt(qid)
        )
        if (result.changes > 0) updated++
      }
    }
    return updated
  })

  const reqUpdated = reqTx()
  console.log(`  -> ${reqUpdated}개 퀘스트 요구사항 보완`)

  // ──────────────────────────────────────────
  // 보완 후 상태
  // ──────────────────────────────────────────
  console.log('\n\n--- 보완 후 상태 ---')
  const afterStats = getStats(db)
  printStats(afterStats)

  // 비교
  console.log('\n--- 보완 전후 비교 ---')
  for (const key of Object.keys(afterStats)) {
    const before = beforeStats[key] || 0
    const after = afterStats[key] || 0
    if (before !== after) {
      console.log(`  ${key}: ${before} -> ${after} (${after > before ? '+' : ''}${after - before})`)
    }
  }

  db.close()
  console.log('\n=== 완료 ===')
}

function getStats(db) {
  const stats = {}
  stats['총 퀘스트'] = db.prepare('SELECT COUNT(*) as c FROM quests').get().c
  stats['메이플랜드 퀘스트 (is_mapleland=1)'] = (() => {
    try { return db.prepare('SELECT COUNT(*) as c FROM quests WHERE is_mapleland = 1').get().c } catch { return 'N/A' }
  })()
  stats['비메이플랜드 (is_mapleland=0)'] = (() => {
    try { return db.prepare('SELECT COUNT(*) as c FROM quests WHERE is_mapleland = 0').get().c } catch { return 'N/A' }
  })()
  stats['레벨 정보 있음 (level_req>0)'] = db.prepare('SELECT COUNT(*) as c FROM quests WHERE level_req > 0').get().c
  stats['start_level > 0'] = db.prepare('SELECT COUNT(*) as c FROM quests WHERE start_level > 0').get().c
  stats['NPC 시작 정보 있음'] = db.prepare(`SELECT COUNT(*) as c FROM quests WHERE npc_start IS NOT NULL AND npc_start != ''`).get().c
  stats['NPC 종료 정보 있음'] = db.prepare(`SELECT COUNT(*) as c FROM quests WHERE npc_end IS NOT NULL AND npc_end != ''`).get().c
  stats['보상 정보 있음 (exp_reward>0 OR meso_reward>0)'] = db.prepare('SELECT COUNT(*) as c FROM quests WHERE exp_reward > 0 OR meso_reward > 0').get().c
  stats['카테고리 있음'] = db.prepare('SELECT COUNT(*) as c FROM quests WHERE category IS NOT NULL').get().c
  stats['선행퀘스트 있음'] = db.prepare('SELECT COUNT(*) as c FROM quests WHERE prerequisite_quests IS NOT NULL').get().c
  stats['필요 몹 있음'] = db.prepare('SELECT COUNT(*) as c FROM quests WHERE required_mobs IS NOT NULL').get().c
  stats['한국어 이름 (entity_names_en quest/kms)'] = db.prepare("SELECT COUNT(*) as c FROM entity_names_en WHERE entity_type='quest' AND source='kms'").get().c
  stats['중국어 이름 (entity_names_en quest/tw_wz)'] = (() => {
    try { return db.prepare("SELECT COUNT(*) as c FROM entity_names_en WHERE entity_type='quest' AND source='tw_wz'").get().c } catch { return 0 }
  })()

  // 한국어 이름이 quests.name에 반영된 수 (한글 유니코드 범위 체크)
  stats['한국어 퀘스트명 (quests.name 한글 포함)'] = db.prepare("SELECT COUNT(*) as c FROM quests WHERE name LIKE '%가%' OR name LIKE '%나%' OR name LIKE '%다%' OR name LIKE '%의%' OR name LIKE '%을%' OR name LIKE '%는%' OR name LIKE '%이%' OR name LIKE '%에%' OR name LIKE '%서%' OR name LIKE '%와%' OR name LIKE '%하%' OR name LIKE '%한%' OR name LIKE '%퀘%'").get().c

  return stats
}

function printStats(stats) {
  for (const [key, val] of Object.entries(stats)) {
    console.log(`  ${key}: ${val}`)
  }
}

main()
