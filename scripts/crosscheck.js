const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')

const DB_PATH = '/Users/user/Desktop/jy/maple_db/data/maple.db'
const WZ_DIR = '/Users/user/Desktop/jy/maple_db/wz_data'

const db = new Database(DB_PATH, { readonly: true })

// ==============================
// 1. MONSTER CROSS-CHECK
// ==============================
function crosscheckMobs() {
  console.log('=' .repeat(80))
  console.log('1. MONSTER (MOB) CROSS-CHECK')
  console.log('=' .repeat(80))

  const wzMobInfo = JSON.parse(fs.readFileSync(path.join(WZ_DIR, 'Mob_info.json'), 'utf8'))
  const wzMobNames = JSON.parse(fs.readFileSync(path.join(WZ_DIR, 'String_Mob.json'), 'utf8'))

  const dbMobs = db.prepare('SELECT * FROM mobs').all()

  console.log(`\nDB mobs: ${dbMobs.length}`)
  console.log(`WZ mobs (info): ${Object.keys(wzMobInfo).length}`)
  console.log(`WZ mob names: ${Object.keys(wzMobNames).length}`)

  // Build WZ mob lookup by name (Korean)
  const wzByName = {}
  for (const [id, data] of Object.entries(wzMobNames)) {
    if (data && data.name) {
      wzByName[data.name] = { id, ...data, info: wzMobInfo[id] || null }
    }
  }

  // Build WZ mob lookup by ID
  const wzById = {}
  for (const [id, info] of Object.entries(wzMobInfo)) {
    wzById[id] = { info, name: wzMobNames[id]?.name || null }
  }

  let matched = 0
  let mismatches = []
  let notInWz = []

  for (const dbMob of dbMobs) {
    const wzMob = wzById[String(dbMob.id)]

    if (!wzMob || !wzMob.info) {
      // Try matching by name
      const wzByNameMatch = wzByName[dbMob.name]
      if (!wzByNameMatch) {
        notInWz.push({ id: dbMob.id, name: dbMob.name })
        continue
      }
    }

    const wz = wzMob?.info || wzByName[dbMob.name]?.info
    if (!wz) {
      notInWz.push({ id: dbMob.id, name: dbMob.name })
      continue
    }

    matched++
    const diffs = []

    // Compare fields
    const fieldMap = {
      level: 'level',
      hp: 'maxHP',
      mp: 'maxMP',
      exp: 'exp',
      physical_damage: 'PADamage',
      magic_damage: 'MADamage',
      defense: 'PDDamage',
      magic_defense: 'MDDamage',
      accuracy: 'acc',
      evasion: 'eva',
      speed: 'speed',
    }

    for (const [dbField, wzField] of Object.entries(fieldMap)) {
      const dbVal = dbMob[dbField]
      const wzVal = wz[wzField]

      if (dbVal != null && wzVal != null && Number(dbVal) !== Number(wzVal)) {
        diffs.push({
          field: dbField,
          db: dbVal,
          wz: wzVal,
          wzField
        })
      }
    }

    if (diffs.length > 0) {
      mismatches.push({
        id: dbMob.id,
        name: dbMob.name,
        wzName: wzMob?.name || wzByName[dbMob.name]?.name,
        diffs
      })
    }
  }

  console.log(`\nMatched: ${matched}`)
  console.log(`Mismatches: ${mismatches.length}`)
  console.log(`Not in WZ: ${notInWz.length}`)

  // Show mismatches summary
  if (mismatches.length > 0) {
    console.log('\n--- MISMATCH DETAILS (first 30) ---')
    for (const m of mismatches.slice(0, 30)) {
      console.log(`\n  [${m.id}] ${m.name}`)
      for (const d of m.diffs) {
        const pctDiff = d.db ? ((d.wz - d.db) / d.db * 100).toFixed(1) : 'N/A'
        console.log(`    ${d.field}: DB=${d.db} vs WZ=${d.wz} (${pctDiff}%)`)
      }
    }
  }

  // Field-level summary of mismatches
  console.log('\n--- MISMATCH FIELD SUMMARY ---')
  const fieldCounts = {}
  for (const m of mismatches) {
    for (const d of m.diffs) {
      fieldCounts[d.field] = (fieldCounts[d.field] || 0) + 1
    }
  }
  for (const [field, count] of Object.entries(fieldCounts).sort((a,b) => b[1] - a[1])) {
    console.log(`  ${field}: ${count} mismatches`)
  }

  // Show some not-in-WZ
  if (notInWz.length > 0) {
    console.log(`\n--- NOT IN WZ (first 20) ---`)
    for (const m of notInWz.slice(0, 20)) {
      console.log(`  [${m.id}] ${m.name}`)
    }
  }

  return { mismatches, notInWz, matched }
}

// ==============================
// 2. ITEM/EQUIPMENT CROSS-CHECK
// ==============================
function crosscheckItems() {
  console.log('\n' + '=' .repeat(80))
  console.log('2. ITEM/EQUIPMENT CROSS-CHECK')
  console.log('=' .repeat(80))

  // Load WZ weapon data
  const wzWeapons = JSON.parse(fs.readFileSync(path.join(WZ_DIR, 'Character_Weapon.json'), 'utf8'))

  // Load WZ equipment names from String.wz
  const wzEqpNames = JSON.parse(fs.readFileSync(path.join(WZ_DIR, 'String_Eqp.json'), 'utf8'))

  // Build flat name lookup from nested Eqp structure
  const wzEqpNameLookup = {}
  function flattenEqp(obj) {
    for (const [key, val] of Object.entries(obj)) {
      if (val && val.name) {
        wzEqpNameLookup[key] = val.name
      } else if (typeof val === 'object' && val !== null) {
        flattenEqp(val)
      }
    }
  }
  flattenEqp(wzEqpNames)

  const dbItems = db.prepare("SELECT * FROM items WHERE category IN ('무기', '방어구')").all()

  console.log(`\nDB equipment items: ${dbItems.length}`)
  console.log(`WZ weapons: ${Object.keys(wzWeapons).length}`)
  console.log(`WZ equipment names: ${Object.keys(wzEqpNameLookup).length}`)

  // Load all equipment categories
  const eqpFiles = [
    'Character_Weapon.json', 'Character_Cap.json', 'Character_Coat.json',
    'Character_Longcoat.json', 'Character_Pants.json', 'Character_Shoes.json',
    'Character_Glove.json', 'Character_Cape.json', 'Character_Shield.json',
    'Character_Accessory.json', 'Character_Ring.json'
  ]

  const allWzEquip = {}
  for (const file of eqpFiles) {
    const filePath = path.join(WZ_DIR, file)
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      Object.assign(allWzEquip, data)
    }
  }

  console.log(`Total WZ equipment entries: ${Object.keys(allWzEquip).length}`)

  let matched = 0
  let mismatches = []

  for (const dbItem of dbItems) {
    // Remove leading zeros for matching
    const itemId = String(dbItem.id)
    const paddedId = itemId.padStart(8, '0')

    const wzItem = allWzEquip[itemId] || allWzEquip[paddedId]
    if (!wzItem) continue

    matched++

    const dbStats = dbItem.stats ? JSON.parse(dbItem.stats) : {}
    const diffs = []

    // Compare stat fields
    const statFields = [
      'incSTR', 'incDEX', 'incINT', 'incLUK',
      'incPAD', 'incMAD', 'incPDD', 'incMDD',
      'incMHP', 'incMMP', 'incSpeed', 'incJump',
      'incACC', 'incEVA'
    ]

    for (const field of statFields) {
      const dbVal = dbStats[field]
      const wzVal = wzItem[field]
      if (dbVal != null && wzVal != null && Number(dbVal) !== Number(wzVal)) {
        diffs.push({ field, db: dbVal, wz: wzVal })
      } else if (dbVal == null && wzVal != null && Number(wzVal) > 0) {
        diffs.push({ field, db: 'missing', wz: wzVal })
      } else if (dbVal != null && wzVal == null) {
        diffs.push({ field, db: dbVal, wz: 'missing in WZ' })
      }
    }

    // Check level req
    const dbLevel = dbItem.level_req
    const wzLevel = wzItem.reqLevel
    if (dbLevel != null && wzLevel != null && Number(dbLevel) !== Number(wzLevel)) {
      diffs.push({ field: 'level_req', db: dbLevel, wz: wzLevel })
    }

    // Check upgrade slots
    const dbSlots = dbItem.upgrade_slots
    const wzSlots = wzItem.tuc
    if (dbSlots != null && wzSlots != null && Number(dbSlots) !== Number(wzSlots)) {
      diffs.push({ field: 'upgrade_slots', db: dbSlots, wz: wzSlots })
    }

    if (diffs.length > 0) {
      mismatches.push({
        id: dbItem.id,
        name: dbItem.name,
        wzName: wzEqpNameLookup[itemId] || wzEqpNameLookup[paddedId],
        diffs
      })
    }
  }

  console.log(`\nMatched: ${matched}`)
  console.log(`Mismatches: ${mismatches.length}`)

  if (mismatches.length > 0) {
    console.log('\n--- ITEM MISMATCH DETAILS (first 30) ---')
    for (const m of mismatches.slice(0, 30)) {
      console.log(`\n  [${m.id}] ${m.name} (WZ: ${m.wzName || 'unknown'})`)
      for (const d of m.diffs) {
        console.log(`    ${d.field}: DB=${d.db} vs WZ=${d.wz}`)
      }
    }
  }

  // Field-level summary
  console.log('\n--- ITEM MISMATCH FIELD SUMMARY ---')
  const fieldCounts = {}
  for (const m of mismatches) {
    for (const d of m.diffs) {
      fieldCounts[d.field] = (fieldCounts[d.field] || 0) + 1
    }
  }
  for (const [field, count] of Object.entries(fieldCounts).sort((a,b) => b[1] - a[1])) {
    console.log(`  ${field}: ${count} mismatches`)
  }
}

// ==============================
// 3. SKILL CROSS-CHECK
// ==============================
function crosscheckSkills() {
  console.log('\n' + '=' .repeat(80))
  console.log('3. SKILL CROSS-CHECK')
  console.log('=' .repeat(80))

  const wzSkills = JSON.parse(fs.readFileSync(path.join(WZ_DIR, 'Skill_data.json'), 'utf8'))
  const wzSkillNames = JSON.parse(fs.readFileSync(path.join(WZ_DIR, 'String_Skill.json'), 'utf8'))

  const dbSkills = db.prepare('SELECT * FROM skills').all()

  console.log(`\nDB skills: ${dbSkills.length}`)
  console.log(`WZ skill books: ${Object.keys(wzSkills).length}`)
  console.log(`WZ skill names: ${Object.keys(wzSkillNames).length}`)

  // Flatten WZ skills
  const wzSkillFlat = {}
  for (const [bookId, bookData] of Object.entries(wzSkills)) {
    for (const [skillId, skillData] of Object.entries(bookData)) {
      if (skillData && typeof skillData === 'object') {
        wzSkillFlat[skillId] = skillData
      }
    }
  }
  console.log(`WZ individual skills: ${Object.keys(wzSkillFlat).length}`)

  let matched = 0
  let mismatches = []

  for (const dbSkill of dbSkills) {
    const skillId = String(dbSkill.id)
    const wzSkill = wzSkillFlat[skillId]
    if (!wzSkill) continue

    matched++

    // Compare level data if available
    const dbLevelData = dbSkill.level_data ? JSON.parse(dbSkill.level_data) : null
    const wzLevelData = wzSkill.level

    if (dbLevelData && wzLevelData && typeof wzLevelData === 'object') {
      // Check damage values at max level
      const dbMaxLevel = dbSkill.master_level
      const wzMaxLevelData = wzLevelData[String(dbMaxLevel)]
      if (wzMaxLevelData && wzMaxLevelData.damage) {
        const dbDamage = dbLevelData[String(dbMaxLevel)]?.damage
        if (dbDamage != null && Number(dbDamage) !== Number(wzMaxLevelData.damage)) {
          mismatches.push({
            id: skillId,
            name: dbSkill.skill_name,
            field: 'damage',
            dbVal: dbDamage,
            wzVal: wzMaxLevelData.damage,
            level: dbMaxLevel
          })
        }
      }
    }
  }

  console.log(`\nMatched: ${matched}`)
  console.log(`Skill mismatches: ${mismatches.length}`)

  if (mismatches.length > 0) {
    console.log('\n--- SKILL MISMATCH DETAILS (first 20) ---')
    for (const m of mismatches.slice(0, 20)) {
      console.log(`  [${m.id}] ${m.name} @ Lv${m.level}: DB ${m.field}=${m.dbVal} vs WZ=${m.wzVal}`)
    }
  }
}

// Run all cross-checks
crosscheckMobs()
crosscheckItems()
crosscheckSkills()

db.close()
