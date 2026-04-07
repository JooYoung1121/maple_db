const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')

const DB_PATH = '/Users/user/Desktop/jy/maple_db/data/maple.db'
const WZ_DIR = '/Users/user/Desktop/jy/maple_db/wz_data'

const db = new Database(DB_PATH)

function findInWz(wzData, id) {
  const s = String(id)
  return wzData[s] || wzData[s.padStart(7, '0')] || wzData[s.padStart(8, '0')] || null
}

// ==============================
// 1. Fix monsters with 0 values
// ==============================
function fixZeroValueMobs() {
  console.log('=== 1. Fixing monsters with 0 values ===')
  const wzMobInfo = JSON.parse(fs.readFileSync(path.join(WZ_DIR, 'Mob_info.json')))
  const dbMobs = db.prepare('SELECT * FROM mobs').all()

  const fieldMap = {
    level: 'level', hp: 'maxHP', mp: 'maxMP', exp: 'exp',
    physical_damage: 'PADamage', magic_damage: 'MADamage',
    defense: 'PDDamage', magic_defense: 'MDDamage',
    accuracy: 'acc', evasion: 'eva', speed: 'speed'
  }

  const updateStmt = db.prepare(`
    UPDATE mobs SET level=?, hp=?, mp=?, exp=?, physical_damage=?, magic_damage=?,
    defense=?, magic_defense=?, accuracy=?, evasion=?, speed=?
    WHERE id=?
  `)

  let updated = 0
  const updates = []

  for (const dbMob of dbMobs) {
    const wzInfo = findInWz(wzMobInfo, dbMob.id)
    if (!wzInfo) continue

    let needsUpdate = false
    const newValues = {}

    for (const [dbField, wzField] of Object.entries(fieldMap)) {
      const dbVal = Number(dbMob[dbField] || 0)
      const wzVal = Number(wzInfo[wzField] || 0)

      // Only update if DB has 0 and WZ has real data
      if (dbVal === 0 && wzVal > 0) {
        newValues[dbField] = wzVal
        needsUpdate = true
      } else {
        newValues[dbField] = dbVal
      }
    }

    if (needsUpdate) {
      updateStmt.run(
        newValues.level, newValues.hp, newValues.mp, newValues.exp,
        newValues.physical_damage, newValues.magic_damage,
        newValues.defense, newValues.magic_defense,
        newValues.accuracy, newValues.evasion, newValues.speed,
        dbMob.id
      )
      updates.push({ id: dbMob.id, name: dbMob.name, fields: Object.entries(newValues).filter(([k, v]) => v !== Number(dbMob[k] || 0)).map(([k, v]) => `${k}: 0→${v}`) })
      updated++
    }
  }

  console.log(`  Updated ${updated} monsters:`)
  for (const u of updates) {
    console.log(`    [${u.id}] ${u.name}: ${u.fields.join(', ')}`)
  }
  return updated
}

// ==============================
// 2. Fix equipment mismatches
// ==============================
function fixEquipmentMismatches() {
  console.log('\n=== 2. Fixing equipment mismatches ===')

  const eqpFiles = [
    'Character_Weapon.json', 'Character_Cap.json', 'Character_Coat.json',
    'Character_Longcoat.json', 'Character_Pants.json', 'Character_Shoes.json',
    'Character_Glove.json', 'Character_Cape.json', 'Character_Shield.json',
    'Character_Accessory.json', 'Character_Ring.json'
  ]

  const allWzEquip = {}
  for (const file of eqpFiles) {
    const filePath = path.join(WZ_DIR, file)
    if (fs.existsSync(filePath)) Object.assign(allWzEquip, JSON.parse(fs.readFileSync(filePath)))
  }

  // Known mismatches from cross-check
  const mismatchIds = [1003036, 1142145, 1382025, 1382058, 1452058, 1472069, 1492024]

  let updated = 0
  for (const itemId of mismatchIds) {
    const dbItem = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId)
    if (!dbItem) continue

    const wzItem = findInWz(allWzEquip, itemId)
    if (!wzItem) continue

    const dbStats = dbItem.stats ? JSON.parse(dbItem.stats) : {}
    let changed = false

    // Update stats from WZ
    const statFields = ['incSTR', 'incDEX', 'incINT', 'incLUK', 'incPAD', 'incMAD', 'incPDD', 'incMDD', 'incMHP', 'incMMP', 'incSpeed', 'incJump', 'incACC', 'incEVA']

    for (const field of statFields) {
      if (wzItem[field] != null && Number(wzItem[field]) > 0) {
        if (dbStats[field] == null || Number(dbStats[field]) !== Number(wzItem[field])) {
          console.log(`  [${itemId}] ${dbItem.name}: ${field} DB=${dbStats[field] || 'missing'} → WZ=${wzItem[field]}`)
          dbStats[field] = Number(wzItem[field])
          changed = true
        }
      }
    }

    // Update level req
    if (wzItem.reqLevel != null && Number(wzItem.reqLevel) > 0) {
      if (Number(dbItem.level_req) !== Number(wzItem.reqLevel)) {
        console.log(`  [${itemId}] ${dbItem.name}: level_req DB=${dbItem.level_req} → WZ=${wzItem.reqLevel}`)
        db.prepare('UPDATE items SET level_req = ? WHERE id = ?').run(Number(wzItem.reqLevel), itemId)
        changed = true
      }
    }

    // Update upgrade slots
    if (wzItem.tuc != null && Number(wzItem.tuc) > 0) {
      if (Number(dbItem.upgrade_slots) !== Number(wzItem.tuc)) {
        console.log(`  [${itemId}] ${dbItem.name}: upgrade_slots DB=${dbItem.upgrade_slots} → WZ=${wzItem.tuc}`)
        db.prepare('UPDATE items SET upgrade_slots = ? WHERE id = ?').run(Number(wzItem.tuc), itemId)
      }
    }

    if (changed) {
      db.prepare('UPDATE items SET stats = ? WHERE id = ?').run(JSON.stringify(dbStats), itemId)
      updated++
    }
  }

  console.log(`  Fixed ${updated} equipment items`)
  return updated
}

// ==============================
// 3. Add new v83 monsters
// ==============================
function addNewV83Monsters() {
  console.log('\n=== 3. Adding new v83 monsters to DB ===')

  const wzMobInfo = JSON.parse(fs.readFileSync(path.join(WZ_DIR, 'Mob_info.json')))
  const wzMobNames = JSON.parse(fs.readFileSync(path.join(WZ_DIR, 'String_Mob.json')))
  const dbMobIds = new Set(db.prepare('SELECT id FROM mobs').all().map(m => m.id))

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO mobs (id, name, level, hp, mp, exp, physical_damage, magic_damage,
    defense, magic_defense, accuracy, evasion, speed, is_boss, is_undead, is_hidden)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  let added = 0
  const newMobs = []

  for (const [wzId, info] of Object.entries(wzMobInfo)) {
    // Convert WZ ID (0100100) to DB ID (100100)
    const dbId = Number(wzId)
    if (dbMobIds.has(dbId)) continue

    const nameData = wzMobNames[wzId] || wzMobNames[String(dbId)]
    if (!nameData || !nameData.name) continue

    // Skip placeholder mobs (level=0 or HP=0)
    if (!info.level || !info.maxHP) continue
    // Skip event/test mobs
    if (nameData.name.includes('test') || nameData.name.includes('Test')) continue

    const isBoss = info.boss ? 1 : 0
    const isUndead = info.undead ? 1 : 0

    insertStmt.run(
      dbId,
      nameData.name,
      info.level || 0,
      info.maxHP || 0,
      info.maxMP || 0,
      info.exp || 0,
      info.PADamage || 0,
      info.MADamage || 0,
      info.PDDamage || 0,
      info.MDDamage || 0,
      info.acc || 0,
      info.eva || 0,
      info.speed || 0,
      isBoss,
      isUndead,
      0 // is_hidden
    )
    newMobs.push({ id: dbId, name: nameData.name, level: info.level, hp: info.maxHP })
    added++
  }

  console.log(`  Added ${added} new monsters`)
  // Show some notable additions
  const notable = newMobs.filter(m => m.level >= 50).sort((a, b) => b.level - a.level)
  console.log(`  Notable additions (Lv50+):`)
  for (const m of notable.slice(0, 30)) {
    console.log(`    [${m.id}] ${m.name} (Lv${m.level}, HP:${m.hp.toLocaleString()})`)
  }

  return added
}

// Run all updates
const t = db.transaction(() => {
  const r1 = fixZeroValueMobs()
  const r2 = fixEquipmentMismatches()
  const r3 = addNewV83Monsters()
  console.log(`\n=== SUMMARY ===`)
  console.log(`  Monsters with 0-values fixed: ${r1}`)
  console.log(`  Equipment mismatches fixed: ${r2}`)
  console.log(`  New v83 monsters added: ${r3}`)
})

t()
db.close()
console.log('\nDatabase updated successfully!')
