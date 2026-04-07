/**
 * 퀘스트 설명 한국어화 스크립트
 *
 * 1단계: maplestory.io KMS 284 API에서 한국어 퀘스트 설명 크롤링
 * 2단계: 대만어(TW) description을 한국어로 교체
 * 3단계: rewards 아이템명, NPC 이름 한국어화
 *
 * Usage: node scripts/fix_quest_descriptions.js [--crawl] [--sample N] [--fix] [--all]
 *   --crawl       KMS API 크롤링 실행
 *   --sample N    크롤링할 퀘스트 수 (기본: 전체)
 *   --fix         대만어→한국어 변환 + 보상/NPC 한글화
 *   --all         --crawl + --fix 모두 실행
 *   --stats       현재 상태만 출력
 */
const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
const https = require('https')

const DB_PATH = path.join(__dirname, '..', 'data', 'maple.db')
const WZ_DIR = path.join(__dirname, '..', 'wz_data_v62')
const KMS_BASE = 'https://maplestory.io/api/kms/284/quest'
const RATE_LIMIT_MS = 550 // 0.55초 간격 (초당 ~1.8요청, 안전 마진)

// ──────────────────────────────────────────
// HTTP 헬퍼
// ──────────────────────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode === 404) {
        resolve(null)
        res.resume()
        return
      }
      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        return
      }
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
  })
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ──────────────────────────────────────────
// 유틸리티
// ──────────────────────────────────────────
function isChinese(text) {
  if (!text) return false
  // 문장 전체가 중국어(한자+대만어 구조)인지 판별
  const koreanChars = (text.match(/[\uac00-\ud7af]/g) || []).length
  if (koreanChars > 0) return false // 한국어가 있으면 중국어 아님
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  if (chineseChars === 0) return false
  // 메이플 태그(#b, #k, #m12345#, #p12345# 등)와 숫자를 제거한 후 비율 계산
  const cleaned = text.replace(/#[a-z]\d*#?/g, '').replace(/\d+/g, '').replace(/\s/g, '')
  if (cleaned.length === 0) return chineseChars > 0
  return chineseChars / cleaned.length > 0.15
}

function cleanMapleTag(text) {
  if (!text) return text
  // #b, #k, #r, #e, #n, #d, #c 등 메이플 태그 제거
  // #pNNNN → NPC이름 참조, #mNNNN → 맵이름 참조, #iNNNN → 아이템아이콘
  // #t, #z, #s, #o, #f, #l 등도 제거
  return text
    .replace(/#[bkrednc]/g, '')
    .replace(/#p\d+#/g, '')  // NPC 참조 유지 안 함 (이미 이름 있음)
    .replace(/#m\d+#/g, '')  // 맵 참조
    .replace(/#[itzso]\d+#/g, '')
    .replace(/#[fFlL]/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()
}

function loadJson(filename) {
  const p = path.join(WZ_DIR, filename)
  if (!fs.existsSync(p)) return {}
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

// ──────────────────────────────────────────
// 1단계: KMS 284 API 크롤링
// ──────────────────────────────────────────
async function crawlKmsQuestDetails(db, sampleSize) {
  console.log('\n=== 1단계: KMS 284 퀘스트 상세 크롤링 ===\n')

  // 크롤링 결과 캐시 테이블
  db.exec(`CREATE TABLE IF NOT EXISTS kms_quest_cache (
    quest_id INTEGER PRIMARY KEY,
    messages TEXT,
    name_kr TEXT,
    rewards_json TEXT,
    raw_json TEXT,
    crawled_at TEXT
  )`)

  // 크롤링 대상: description 없거나 대만어인 퀘스트
  const allQuests = db.prepare('SELECT id, description FROM quests ORDER BY id').all()

  // 이미 캐시된 ID
  const cachedIds = new Set(
    db.prepare('SELECT quest_id FROM kms_quest_cache').all().map(r => r.quest_id)
  )

  // 크롤링 필요한 퀘스트 필터링
  const needsCrawl = allQuests.filter(q => !cachedIds.has(q.id))

  let targets = needsCrawl
  if (sampleSize && sampleSize < targets.length) {
    targets = targets.slice(0, sampleSize)
  }

  console.log(`총 퀘스트: ${allQuests.length}`)
  console.log(`이미 캐시됨: ${cachedIds.size}`)
  console.log(`크롤링 대상: ${targets.length}`)

  if (targets.length === 0) {
    console.log('크롤링할 대상이 없습니다.')
    return
  }

  const insertCache = db.prepare(`
    INSERT OR REPLACE INTO kms_quest_cache (quest_id, messages, name_kr, rewards_json, raw_json, crawled_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `)

  let success = 0
  let failed = 0
  let notFound = 0

  for (let i = 0; i < targets.length; i++) {
    const qid = targets[i].id
    const url = `${KMS_BASE}/${qid}`

    try {
      const data = await fetchJson(url)

      if (!data) {
        notFound++
        // 404도 캐시 (재시도 방지)
        insertCache.run(qid, null, null, null, null)
      } else {
        const messages = data.messages || []
        const messagesStr = messages.length > 0 ? JSON.stringify(messages) : null
        const nameKr = data.name || null

        // rewards 추출
        let rewardsJson = null
        const rewardOnComplete = data.rewardOnComplete
        if (rewardOnComplete && typeof rewardOnComplete === 'object') {
          rewardsJson = JSON.stringify(rewardOnComplete)
        }

        insertCache.run(qid, messagesStr, nameKr, rewardsJson, JSON.stringify(data))
        success++
      }
    } catch (e) {
      failed++
      if (failed <= 5) {
        console.log(`  오류 (${qid}): ${e.message}`)
      }
    }

    if ((i + 1) % 100 === 0 || i === targets.length - 1) {
      db.exec('BEGIN'); db.exec('COMMIT') // flush
      const pct = ((i + 1) / targets.length * 100).toFixed(1)
      console.log(`  진행: ${i + 1}/${targets.length} (${pct}%) - 성공: ${success}, 404: ${notFound}, 실패: ${failed}`)
    }

    await sleep(RATE_LIMIT_MS)
  }

  console.log(`\n크롤링 완료: 성공 ${success}, 404 ${notFound}, 실패 ${failed}`)
}

// ──────────────────────────────────────────
// 2단계: 대만어 → 한국어 변환
// ──────────────────────────────────────────
function fixDescriptions(db) {
  console.log('\n=== 2단계: description 한국어화 ===\n')

  // KMS 캐시에서 한국어 메시지 로드
  const kmsCache = db.prepare('SELECT quest_id, messages, name_kr FROM kms_quest_cache WHERE messages IS NOT NULL').all()
  console.log(`KMS 캐시 데이터: ${kmsCache.length}건`)

  const kmsMap = new Map()
  for (const row of kmsCache) {
    try {
      const msgs = JSON.parse(row.messages)
      kmsMap.set(row.quest_id, { messages: msgs, nameKr: row.name_kr })
    } catch (e) {}
  }

  // Quest_Say.json에서 한국어 대화도 준비 (v62 WZ)
  // 이건 대만어(TW)이므로 KMS가 우선
  // const questSay = loadJson('Quest_Say.json')

  const allQuests = db.prepare('SELECT id, description, name FROM quests').all()

  const updateDesc = db.prepare('UPDATE quests SET description = ? WHERE id = ?')
  const updateName = db.prepare('UPDATE quests SET name = ? WHERE id = ?')

  let descReplaced = 0
  let descNew = 0
  let nameUpdated = 0

  const tx = db.transaction(() => {
    for (const q of allQuests) {
      const kms = kmsMap.get(q.id)
      if (!kms) continue

      // description 교체/추가
      if (kms.messages && kms.messages.length > 0) {
        const newDesc = kms.messages.join('\n')
        const hasDesc = q.description && q.description.trim()

        if (!hasDesc) {
          // description 없는 경우 → 새로 추가
          updateDesc.run(newDesc, q.id)
          descNew++
        } else if (isChinese(q.description)) {
          // 대만어인 경우 → 한국어로 교체
          updateDesc.run(newDesc, q.id)
          descReplaced++
        }
      }

      // 퀘스트 이름도 한국어로 업데이트 (영어/대만어인 경우)
      if (kms.nameKr && q.name) {
        const hasKorean = /[\uac00-\ud7af]/.test(q.name)
        if (!hasKorean && kms.nameKr.trim()) {
          updateName.run(kms.nameKr.trim(), q.id)
          nameUpdated++
        }
      }
    }
  })

  tx()

  console.log(`description 신규 추가: ${descNew}건`)
  console.log(`description 대만어→한국어 교체: ${descReplaced}건`)
  console.log(`퀘스트명 한국어화: ${nameUpdated}건`)
}

// ──────────────────────────────────────────
// 3단계: rewards 아이템명 + NPC 이름 한국어화
// ──────────────────────────────────────────
function fixRewardsAndNpcs(db) {
  console.log('\n=== 3단계: rewards 아이템명 + NPC 이름 한국어화 ===\n')

  // 아이템 한국어 이름 매핑
  const itemKrNames = {}
  try {
    // entity_names_en에서 KMS 아이템 이름
    const rows = db.prepare("SELECT entity_id, name_en FROM entity_names_en WHERE entity_type='item' AND source='kms'").all()
    for (const r of rows) itemKrNames[r.entity_id] = r.name_en
  } catch (e) {}

  // items 테이블의 이름도 (KMS가 없는 경우 fallback)
  const itemNames = {}
  try {
    const rows = db.prepare('SELECT id, name FROM items').all()
    for (const r of rows) itemNames[r.id] = r.name
  } catch (e) {}

  // NPC 한국어 이름
  const npcKrNames = {}
  try {
    const rows = db.prepare("SELECT entity_id, name_en FROM entity_names_en WHERE entity_type='npc' AND source='kms'").all()
    for (const r of rows) npcKrNames[r.entity_id] = r.name_en
  } catch (e) {}

  // 몬스터 한국어 이름
  const mobKrNames = {}
  try {
    const rows = db.prepare("SELECT entity_id, name_en FROM entity_names_en WHERE entity_type='mob' AND source='kms'").all()
    for (const r of rows) mobKrNames[r.entity_id] = r.name_en
  } catch (e) {}

  console.log(`아이템 KMS 이름: ${Object.keys(itemKrNames).length}건`)
  console.log(`NPC KMS 이름: ${Object.keys(npcKrNames).length}건`)
  console.log(`몬스터 KMS 이름: ${Object.keys(mobKrNames).length}건`)

  // 3-1: rewards 아이템명 한글화
  const questsWithRewards = db.prepare("SELECT id, rewards, reward_items FROM quests WHERE rewards IS NOT NULL AND rewards != ''").all()
  const updateRewards = db.prepare('UPDATE quests SET rewards = ? WHERE id = ?')
  const updateRewardItems = db.prepare('UPDATE quests SET reward_items = ? WHERE id = ?')

  let rewardsUpdated = 0
  let rewardItemsUpdated = 0

  const rewardsTx = db.transaction(() => {
    for (const q of questsWithRewards) {
      let changed = false

      // rewards 필드
      try {
        const rewards = JSON.parse(q.rewards)
        if (rewards.items && Array.isArray(rewards.items)) {
          for (const item of rewards.items) {
            if (item.id) {
              const krName = itemKrNames[item.id] || null
              if (krName && item.name !== krName) {
                item.name = krName
                changed = true
              }
            }
          }
        }
        if (changed) {
          updateRewards.run(JSON.stringify(rewards), q.id)
          rewardsUpdated++
        }
      } catch (e) {}

      // reward_items 필드
      if (q.reward_items) {
        try {
          const items = JSON.parse(q.reward_items)
          let riChanged = false
          if (Array.isArray(items)) {
            for (const item of items) {
              if (item.id) {
                const krName = itemKrNames[item.id] || null
                if (krName && item.name !== krName) {
                  item.name = krName
                  riChanged = true
                }
              }
            }
          }
          if (riChanged) {
            updateRewardItems.run(JSON.stringify(items), q.id)
            rewardItemsUpdated++
          }
        } catch (e) {}
      }
    }
  })

  rewardsTx()
  console.log(`rewards 아이템명 한글화: ${rewardsUpdated}건`)
  console.log(`reward_items 아이템명 한글화: ${rewardItemsUpdated}건`)

  // 3-2: required_items, completion_items, required_mobs 한글화
  const updateRequiredItems = db.prepare('UPDATE quests SET required_items = ? WHERE id = ?')
  const updateCompletionItems = db.prepare('UPDATE quests SET completion_items = ? WHERE id = ?')
  const updateRequiredMobs = db.prepare('UPDATE quests SET required_mobs = ? WHERE id = ?')

  const questsWithReqs = db.prepare("SELECT id, required_items, completion_items, required_mobs FROM quests WHERE required_items IS NOT NULL OR completion_items IS NOT NULL OR required_mobs IS NOT NULL").all()

  let reqItemsUpdated = 0
  let compItemsUpdated = 0
  let reqMobsUpdated = 0

  const reqTx = db.transaction(() => {
    for (const q of questsWithReqs) {
      // required_items
      if (q.required_items) {
        try {
          const items = JSON.parse(q.required_items)
          let changed = false
          for (const item of items) {
            const krName = itemKrNames[item.id] || null
            if (krName && item.name !== krName) { item.name = krName; changed = true }
          }
          if (changed) { updateRequiredItems.run(JSON.stringify(items), q.id); reqItemsUpdated++ }
        } catch (e) {}
      }

      // completion_items
      if (q.completion_items) {
        try {
          const items = JSON.parse(q.completion_items)
          let changed = false
          for (const item of items) {
            const krName = itemKrNames[item.id] || null
            if (krName && item.name !== krName) { item.name = krName; changed = true }
          }
          if (changed) { updateCompletionItems.run(JSON.stringify(items), q.id); compItemsUpdated++ }
        } catch (e) {}
      }

      // required_mobs
      if (q.required_mobs) {
        try {
          const mobs = JSON.parse(q.required_mobs)
          let changed = false
          for (const mob of mobs) {
            const krName = mobKrNames[mob.id] || null
            if (krName && mob.name !== krName) { mob.name = krName; changed = true }
          }
          if (changed) { updateRequiredMobs.run(JSON.stringify(mobs), q.id); reqMobsUpdated++ }
        } catch (e) {}
      }
    }
  })

  reqTx()
  console.log(`required_items 한글화: ${reqItemsUpdated}건`)
  console.log(`completion_items 한글화: ${compItemsUpdated}건`)
  console.log(`required_mobs 한글화: ${reqMobsUpdated}건`)

  // 3-3: NPC 이름 한국어화
  const questsWithNpc = db.prepare("SELECT id, npc_start, npc_end, npc_start_id, npc_end_id FROM quests WHERE npc_start_id IS NOT NULL OR npc_end_id IS NOT NULL").all()
  const updateNpcNames = db.prepare('UPDATE quests SET npc_start = ?, npc_end = ? WHERE id = ?')

  let npcUpdated = 0

  const npcTx = db.transaction(() => {
    for (const q of questsWithNpc) {
      let newStart = q.npc_start
      let newEnd = q.npc_end
      let changed = false

      if (q.npc_start_id && npcKrNames[q.npc_start_id]) {
        const krName = npcKrNames[q.npc_start_id]
        if (newStart !== krName) {
          newStart = krName
          changed = true
        }
      }

      if (q.npc_end_id && npcKrNames[q.npc_end_id]) {
        const krName = npcKrNames[q.npc_end_id]
        if (newEnd !== krName) {
          newEnd = krName
          changed = true
        }
      }

      if (changed) {
        updateNpcNames.run(newStart, newEnd, q.id)
        npcUpdated++
      }
    }
  })

  npcTx()
  console.log(`NPC 이름 한국어화: ${npcUpdated}건`)
}

// ──────────────────────────────────────────
// npc_dialogue 한국어화 (Quest_Say → KMS API)
// ──────────────────────────────────────────
function fixNpcDialogue(db) {
  console.log('\n=== npc_dialogue 한국어화 ===\n')

  const kmsCache = db.prepare('SELECT quest_id, raw_json FROM kms_quest_cache WHERE raw_json IS NOT NULL').all()

  // KMS API에는 dialogue 데이터가 messages에 있음
  // 기존 npc_dialogue는 Quest_Say.json의 대만어임 → KMS messages로 교체 불필요
  // 대신 npc_dialogue가 대만어인 경우 제거하거나 한국어로 교체

  const allQuests = db.prepare("SELECT id, npc_dialogue FROM quests WHERE npc_dialogue IS NOT NULL AND npc_dialogue != ''").all()
  const updateDialogue = db.prepare('UPDATE quests SET npc_dialogue = ? WHERE id = ?')

  let cleaned = 0

  const tx = db.transaction(() => {
    for (const q of allQuests) {
      if (!q.npc_dialogue) continue

      try {
        const dialogues = JSON.parse(q.npc_dialogue)
        if (!Array.isArray(dialogues)) continue

        // 대만어 대화인지 확인
        const hasChinese = dialogues.some(d => typeof d === 'string' && isChinese(d))
        if (hasChinese) {
          // 대만어 대화 → 메이플 태그 정리만 (한국어 대화 소스 없음)
          const cleanedDialogues = dialogues
            .filter(d => typeof d === 'string')
            .map(d => cleanMapleTag(d))
            .filter(d => d.length > 0)

          if (cleanedDialogues.length > 0) {
            updateDialogue.run(JSON.stringify(cleanedDialogues), q.id)
          } else {
            updateDialogue.run(null, q.id)
          }
          cleaned++
        }
      } catch (e) {}
    }
  })

  tx()
  console.log(`npc_dialogue 정리: ${cleaned}건`)
}

// ──────────────────────────────────────────
// 통계 출력
// ──────────────────────────────────────────
function printStats(db) {
  console.log('\n=== 최종 통계 ===\n')

  const total = db.prepare('SELECT COUNT(*) as c FROM quests').get().c
  const mapleland = db.prepare('SELECT COUNT(*) as c FROM quests WHERE is_mapleland = 1').get().c
  const hasDesc = db.prepare("SELECT COUNT(*) as c FROM quests WHERE description IS NOT NULL AND description != ''").get().c
  const noDesc = db.prepare("SELECT COUNT(*) as c FROM quests WHERE description IS NULL OR description = ''").get().c

  // 언어 분류
  const allDescs = db.prepare("SELECT id, description FROM quests WHERE description IS NOT NULL AND description != ''").all()
  let twCount = 0, krCount = 0, enCount = 0
  for (const r of allDescs) {
    if (isChinese(r.description)) twCount++
    else if (/[\uac00-\ud7af]/.test(r.description)) krCount++
    else enCount++
  }

  console.log(`총 퀘스트: ${total}`)
  console.log(`메이플랜드 퀘스트: ${mapleland}`)
  console.log(`description 있음: ${hasDesc}`)
  console.log(`  - 한국어: ${krCount}`)
  console.log(`  - 대만어: ${twCount}`)
  console.log(`  - 영어/기타: ${enCount}`)
  console.log(`description 없음: ${noDesc}`)

  // KMS 캐시 통계
  try {
    const cached = db.prepare('SELECT COUNT(*) as c FROM kms_quest_cache').get().c
    const withMsg = db.prepare('SELECT COUNT(*) as c FROM kms_quest_cache WHERE messages IS NOT NULL').get().c
    console.log(`\nKMS 캐시: ${cached}건 (메시지 있음: ${withMsg})`)
  } catch (e) {}

  // NPC 이름 한국어 비율
  const npcTotal = db.prepare("SELECT COUNT(*) as c FROM quests WHERE npc_start IS NOT NULL AND npc_start != ''").get().c
  const npcKr = db.prepare("SELECT COUNT(*) as c FROM quests WHERE npc_start IS NOT NULL AND npc_start != ''").all()
  console.log(`\nNPC 시작 정보 있음: ${npcTotal}`)

  // rewards 한국어 아이템명 비율
  const rewardsTotal = db.prepare("SELECT COUNT(*) as c FROM quests WHERE rewards IS NOT NULL AND rewards != ''").get().c
  console.log(`rewards 있음: ${rewardsTotal}`)
}

// ──────────────────────────────────────────
// 메인
// ──────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2)
  const doCrawl = args.includes('--crawl') || args.includes('--all')
  const doFix = args.includes('--fix') || args.includes('--all')
  const statsOnly = args.includes('--stats')

  let sampleSize = null
  const sampleIdx = args.indexOf('--sample')
  if (sampleIdx >= 0 && args[sampleIdx + 1]) {
    sampleSize = parseInt(args[sampleIdx + 1])
  }

  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')

  console.log('=== 퀘스트 설명 한국어화 스크립트 ===')

  if (statsOnly) {
    printStats(db)
    db.close()
    return
  }

  // 보완 전 통계
  console.log('\n--- 작업 전 상태 ---')
  printStats(db)

  if (doCrawl) {
    await crawlKmsQuestDetails(db, sampleSize)
  }

  if (doFix) {
    fixDescriptions(db)
    fixRewardsAndNpcs(db)
    fixNpcDialogue(db)
  }

  if (!doCrawl && !doFix) {
    console.log('\n사용법: node scripts/fix_quest_descriptions.js --all')
    console.log('  --crawl       KMS API 크롤링')
    console.log('  --fix         한국어화 적용')
    console.log('  --all         크롤링 + 한국어화')
    console.log('  --sample N    크롤링 샘플 수')
    console.log('  --stats       현재 상태만 출력')
  }

  // 보완 후 통계
  console.log('\n--- 작업 후 상태 ---')
  printStats(db)

  db.close()
  console.log('\n=== 완료 ===')
}

main().catch(e => {
  console.error('오류:', e)
  process.exit(1)
})
