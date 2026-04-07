const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')

const DB_PATH = '/Users/user/Desktop/jy/maple_db/data/maple.db'
const WZ_DIR = '/Users/user/Desktop/jy/maple_db/wz_data'

const db = new Database(DB_PATH, { readonly: true })

// Helper: try multiple ID formats
function findInWz(wzData, id) {
  const strId = String(id)
  return wzData[strId]
    || wzData[strId.padStart(7, '0')]
    || wzData[strId.padStart(8, '0')]
    || null
}

// ==============================
// 1. MONSTER CROSS-CHECK (FIXED)
// ==============================
function crosscheckMobs() {
  console.log('='.repeat(80))
  console.log('1. MONSTER (MOB) CROSS-CHECK')
  console.log('='.repeat(80))

  const wzMobInfo = JSON.parse(fs.readFileSync(path.join(WZ_DIR, 'Mob_info.json'), 'utf8'))
  const wzMobNames = JSON.parse(fs.readFileSync(path.join(WZ_DIR, 'String_Mob.json'), 'utf8'))
  const dbMobs = db.prepare('SELECT * FROM mobs').all()

  console.log(`DB mobs: ${dbMobs.length}`)
  console.log(`WZ mobs: ${Object.keys(wzMobInfo).length}`)

  let matched = 0, perfect = 0
  const allMismatches = []
  const notInWz = []
  const dbHasZeroButWzHasData = []

  for (const dbMob of dbMobs) {
    const wzInfo = findInWz(wzMobInfo, dbMob.id)
    const wzName = findInWz(wzMobNames, dbMob.id)

    if (!wzInfo) {
      notInWz.push({ id: dbMob.id, name: dbMob.name })
      continue
    }

    matched++
    const diffs = []

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
      const wzVal = wzInfo[wzField]

      if (dbVal != null && wzVal != null && Number(dbVal) !== Number(wzVal)) {
        // Categorize: DB is 0 but WZ has real data (DB missing data)
        if (Number(dbVal) === 0 && Number(wzVal) > 0) {
          diffs.push({ field: dbField, db: dbVal, wz: wzVal, type: 'db_missing' })
        }
        // WZ is 0 but DB has data (WZ might be placeholder)
        else if (Number(wzVal) === 0 && Number(dbVal) > 0) {
          diffs.push({ field: dbField, db: dbVal, wz: wzVal, type: 'wz_zero' })
        }
        // Both have data but different
        else {
          diffs.push({ field: dbField, db: dbVal, wz: wzVal, type: 'mismatch' })
        }
      }
    }

    if (diffs.length === 0) {
      perfect++
    } else {
      allMismatches.push({
        id: dbMob.id,
        name: dbMob.name,
        wzName: wzName?.name,
        diffs
      })
    }
  }

  console.log(`\nMatched: ${matched}`)
  console.log(`Perfect match: ${perfect}`)
  console.log(`With differences: ${allMismatches.length}`)
  console.log(`Not in WZ: ${notInWz.length}`)

  // Categorize mismatches
  const realMismatches = allMismatches.filter(m => m.diffs.some(d => d.type === 'mismatch'))
  const dbMissing = allMismatches.filter(m => m.diffs.some(d => d.type === 'db_missing') && !m.diffs.some(d => d.type === 'mismatch'))
  const wzZero = allMismatches.filter(m => m.diffs.every(d => d.type === 'wz_zero'))

  console.log(`\n  Real data mismatches: ${realMismatches.length}`)
  console.log(`  DB has 0 / WZ has real data: ${dbMissing.length}`)
  console.log(`  WZ has 0 / DB has real data: ${wzZero.length}`)

  // Show REAL mismatches (both have non-zero but different values)
  console.log('\n--- REAL MISMATCHES (DB ≠ WZ, both non-zero) ---')
  for (const m of realMismatches.slice(0, 30)) {
    console.log(`\n  [${m.id}] ${m.name}`)
    for (const d of m.diffs.filter(d => d.type === 'mismatch')) {
      console.log(`    ${d.field}: DB=${d.db} → WZ=${d.wz}`)
    }
  }

  // Field summary for real mismatches
  console.log('\n--- REAL MISMATCH FIELD SUMMARY ---')
  const fieldCounts = {}
  for (const m of realMismatches) {
    for (const d of m.diffs.filter(d => d.type === 'mismatch')) {
      fieldCounts[d.field] = (fieldCounts[d.field] || 0) + 1
    }
  }
  for (const [field, count] of Object.entries(fieldCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${field}: ${count}`)
  }

  // Show DB missing data (should be updated from WZ)
  console.log('\n--- DB MISSING DATA (DB=0, WZ has value) - first 20 ---')
  for (const m of dbMissing.slice(0, 20)) {
    console.log(`  [${m.id}] ${m.name}`)
    for (const d of m.diffs.filter(d => d.type === 'db_missing')) {
      console.log(`    ${d.field}: 0 → ${d.wz}`)
    }
  }

  console.log(`\n--- NOT IN WZ v83 (${notInWz.length} total, first 30) ---`)
  for (const m of notInWz.slice(0, 30)) {
    console.log(`  [${m.id}] ${m.name}`)
  }

  return { realMismatches, dbMissing, notInWz }
}

// ==============================
// 2. EQUIPMENT CROSS-CHECK (FIXED)
// ==============================
function crosscheckEquipment() {
  console.log('\n' + '='.repeat(80))
  console.log('2. EQUIPMENT CROSS-CHECK')
  console.log('='.repeat(80))

  // Load all WZ equipment
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
      Object.assign(allWzEquip, JSON.parse(fs.readFileSync(filePath, 'utf8')))
    }
  }

  const dbItems = db.prepare("SELECT * FROM items WHERE overall_category = 'Equip'").all()

  console.log(`DB equipment items: ${dbItems.length}`)
  console.log(`WZ equipment entries: ${Object.keys(allWzEquip).length}`)

  let matched = 0, perfect = 0
  const mismatches = []
  const dbMissingStats = []

  for (const dbItem of dbItems) {
    const wzItem = findInWz(allWzEquip, dbItem.id)
    if (!wzItem) continue

    matched++
    const dbStats = dbItem.stats ? JSON.parse(dbItem.stats) : {}
    const diffs = []

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
      } else if ((dbVal == null || dbVal === undefined) && wzVal != null && Number(wzVal) > 0) {
        diffs.push({ field, db: 'missing', wz: wzVal })
      }
    }

    // Level req
    if (dbItem.level_req != null && wzItem.reqLevel != null) {
      if (Number(dbItem.level_req) !== Number(wzItem.reqLevel)) {
        diffs.push({ field: 'reqLevel', db: dbItem.level_req, wz: wzItem.reqLevel })
      }
    }

    // Upgrade slots
    if (dbItem.upgrade_slots != null && wzItem.tuc != null) {
      if (Number(dbItem.upgrade_slots) !== Number(wzItem.tuc)) {
        diffs.push({ field: 'tuc', db: dbItem.upgrade_slots, wz: wzItem.tuc })
      }
    }

    if (diffs.length === 0) {
      perfect++
    } else if (diffs.every(d => d.db === 'missing')) {
      dbMissingStats.push({ id: dbItem.id, name: dbItem.name, diffs })
    } else {
      mismatches.push({ id: dbItem.id, name: dbItem.name, category: dbItem.subcategory, diffs })
    }
  }

  console.log(`\nMatched: ${matched}`)
  console.log(`Perfect match: ${perfect}`)
  console.log(`Value mismatches: ${mismatches.length}`)
  console.log(`DB missing stats (WZ has): ${dbMissingStats.length}`)

  if (mismatches.length > 0) {
    console.log('\n--- EQUIPMENT VALUE MISMATCHES (first 30) ---')
    for (const m of mismatches.slice(0, 30)) {
      console.log(`\n  [${m.id}] ${m.name} (${m.category})`)
      for (const d of m.diffs) {
        console.log(`    ${d.field}: DB=${d.db} → WZ=${d.wz}`)
      }
    }
  }

  // Field summary
  console.log('\n--- EQUIPMENT MISMATCH FIELD SUMMARY ---')
  const fieldCounts = {}
  for (const m of [...mismatches, ...dbMissingStats]) {
    for (const d of m.diffs) {
      const cat = d.db === 'missing' ? `${d.field} (missing in DB)` : d.field
      fieldCounts[cat] = (fieldCounts[cat] || 0) + 1
    }
  }
  for (const [field, count] of Object.entries(fieldCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${field}: ${count}`)
  }
}

// ==============================
// 3. SKILL CROSS-CHECK (FIXED)
// ==============================
function crosscheckSkills() {
  console.log('\n' + '='.repeat(80))
  console.log('3. SKILL CROSS-CHECK')
  console.log('='.repeat(80))

  const wzSkills = JSON.parse(fs.readFileSync(path.join(WZ_DIR, 'Skill_data.json'), 'utf8'))
  const wzSkillNames = JSON.parse(fs.readFileSync(path.join(WZ_DIR, 'String_Skill.json'), 'utf8'))

  // Flatten WZ skills with name lookup
  const wzSkillFlat = {}
  for (const [bookId, bookData] of Object.entries(wzSkills)) {
    for (const [skillId, skillData] of Object.entries(bookData)) {
      if (skillData && typeof skillData === 'object' && skillData.level) {
        wzSkillFlat[skillId] = {
          ...skillData,
          name: wzSkillNames[skillId]?.name || null,
          bookName: wzSkillNames[skillId]?.bookName || null
        }
      }
    }
  }

  const dbSkills = db.prepare('SELECT * FROM skills').all()

  console.log(`DB skills: ${dbSkills.length}`)
  console.log(`WZ skills (with level data): ${Object.keys(wzSkillFlat).length}`)

  // DB uses auto-increment IDs and Korean names, so match by name
  // Build WZ name→skill lookup (Korean names from String.wz)
  const wzByName = {}
  for (const [id, data] of Object.entries(wzSkillFlat)) {
    if (data.name) {
      wzByName[data.name] = { id, ...data }
    }
  }

  // Also build English name -> WZ skill lookup
  console.log('\nSample WZ skill names:', Object.keys(wzByName).slice(0, 20))

  // The DB skills have Korean names, WZ has English names
  // Need to check the actual name matching
  console.log('\nDB skill sample names:', dbSkills.slice(0, 10).map(s => s.skill_name))

  // Since DB uses Korean, WZ uses English - we need the Korean names from String.wz
  // But String_Skill.json only has English names for GMS v83
  // Let's compare by skill level data structure instead

  console.log('\n--- Skill comparison approach needed ---')
  console.log('DB skills use Korean names, WZ has English names')
  console.log('A name mapping would be needed for precise matching')

  // Show WZ skill data sample for reference
  console.log('\n--- WZ Skill Data Sample ---')
  const sampleSkills = Object.entries(wzSkillFlat).slice(0, 5)
  for (const [id, data] of sampleSkills) {
    const maxLevel = Object.keys(data.level || {}).sort((a, b) => Number(b) - Number(a))[0]
    const maxData = data.level?.[maxLevel]
    console.log(`  [${id}] ${data.name} (max lv: ${maxLevel})`)
    if (maxData) {
      const keys = Object.keys(maxData).filter(k => typeof maxData[k] !== 'object')
      console.log(`    Stats: ${keys.map(k => `${k}=${maxData[k]}`).join(', ')}`)
    }
  }
}

// ==============================
// 4. DAMAGE FORMULA CHECK
// ==============================
function checkDamageFormula() {
  console.log('\n' + '='.repeat(80))
  console.log('4. N-HIT CALCULATOR DATA CHECK')
  console.log('='.repeat(80))

  // Check weapon multipliers from WZ
  const wzWeapons = JSON.parse(fs.readFileSync(path.join(WZ_DIR, 'Character_Weapon.json'), 'utf8'))

  // Group by weapon type (first 3 digits of ID indicate type)
  const weaponTypes = {}
  for (const [id, data] of Object.entries(wzWeapons)) {
    const typeCode = id.substring(0, 3)
    if (!weaponTypes[typeCode]) {
      weaponTypes[typeCode] = { count: 0, samples: [] }
    }
    weaponTypes[typeCode].count++
    if (weaponTypes[typeCode].samples.length < 2) {
      weaponTypes[typeCode].samples.push({ id, incPAD: data.incPAD, reqLevel: data.reqLevel })
    }
  }

  console.log('\nWeapon type distribution:')
  const typeNames = {
    '130': 'One-Handed Sword', '131': 'One-Handed Axe', '132': 'One-Handed Mace',
    '133': 'Dagger', '137': 'Wand', '138': 'Staff',
    '140': 'Two-Handed Sword', '141': 'Two-Handed Axe', '142': 'Two-Handed Mace',
    '143': 'Spear', '144': 'Polearm',
    '145': 'Bow', '146': 'Crossbow', '147': 'Claw', '148': 'Knuckle', '149': 'Gun'
  }
  for (const [code, data] of Object.entries(weaponTypes).sort()) {
    console.log(`  ${code} (${typeNames[code] || 'unknown'}): ${data.count} weapons`)
  }
}

// Run all
crosscheckMobs()
crosscheckEquipment()
crosscheckSkills()
checkDamageFormula()

db.close()
