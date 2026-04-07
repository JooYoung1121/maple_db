const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')

const DB_PATH = '/Users/user/Desktop/jy/maple_db/data/maple.db'
const WZ62_DIR = '/Users/user/Desktop/jy/maple_db/wz_data_v62'
const WZ83_DIR = '/Users/user/Desktop/jy/maple_db/wz_data'

const db = new Database(DB_PATH, { readonly: true })

function findInWz(wzData, id) {
  const s = String(id)
  return wzData[s] || wzData[s.padStart(7, '0')] || wzData[s.padStart(8, '0')] || null
}

// ==============================
// 1. VERSION COMPARISON: v62 vs v83
// ==============================
function compareVersions() {
  console.log('='.repeat(80))
  console.log('VERSION COMPARISON: v62 vs v83')
  console.log('='.repeat(80))

  const v62Mobs = JSON.parse(fs.readFileSync(path.join(WZ62_DIR, 'Mob_info.json')))
  const v83Mobs = JSON.parse(fs.readFileSync(path.join(WZ83_DIR, 'Mob_info.json')))
  const v62Names = JSON.parse(fs.readFileSync(path.join(WZ62_DIR, 'String_Mob.json')))
  const v83Names = JSON.parse(fs.readFileSync(path.join(WZ83_DIR, 'String_Mob.json')))

  console.log(`\nv62 mobs: ${Object.keys(v62Mobs).length}`)
  console.log(`v83 mobs: ${Object.keys(v83Mobs).length}`)
  console.log(`v62 mob names: ${Object.keys(v62Names).length}`)
  console.log(`v83 mob names: ${Object.keys(v83Names).length}`)

  // Mobs only in v62
  const onlyV62 = Object.keys(v62Mobs).filter(id => !v83Mobs[id])
  // Mobs only in v83
  const onlyV83 = Object.keys(v83Mobs).filter(id => !v62Mobs[id])
  // Mobs in both
  const inBoth = Object.keys(v62Mobs).filter(id => v83Mobs[id])

  console.log(`\nOnly in v62: ${onlyV62.length}`)
  console.log(`Only in v83: ${onlyV83.length}`)
  console.log(`In both: ${inBoth.length}`)

  // Check stat changes between v62 and v83
  const statChanges = []
  const fields = ['level', 'maxHP', 'maxMP', 'exp', 'PADamage', 'MADamage', 'PDDamage', 'MDDamage', 'acc', 'eva']

  for (const id of inBoth) {
    const diffs = []
    for (const f of fields) {
      const v62Val = v62Mobs[id][f]
      const v83Val = v83Mobs[id][f]
      if (v62Val != null && v83Val != null && Number(v62Val) !== Number(v83Val)) {
        diffs.push({ field: f, v62: v62Val, v83: v83Val })
      }
    }
    if (diffs.length > 0) {
      const name = v62Names[id]?.name || v83Names[id]?.name || id
      statChanges.push({ id, name, diffs })
    }
  }

  console.log(`\nMobs with stat changes between v62→v83: ${statChanges.length}`)

  if (statChanges.length > 0) {
    console.log('\n--- STAT CHANGES v62→v83 (first 30) ---')
    for (const m of statChanges.slice(0, 30)) {
      console.log(`\n  [${m.id}] ${m.name}`)
      for (const d of m.diffs) {
        const dir = Number(d.v83) > Number(d.v62) ? '↑' : '↓'
        console.log(`    ${d.field}: ${d.v62} → ${d.v83} ${dir}`)
      }
    }
  }

  // New mobs in v83 sample
  if (onlyV83.length > 0) {
    console.log(`\n--- NEW MOBS in v83 (first 20) ---`)
    for (const id of onlyV83.slice(0, 20)) {
      const name = v83Names[id]?.name || 'unknown'
      const info = v83Mobs[id]
      console.log(`  [${id}] ${name} (Lv${info.level || '?'}, HP:${info.maxHP || '?'})`)
    }
  }

  return { statChanges, onlyV62, onlyV83 }
}

// ==============================
// 2. TRIPLE CROSS-CHECK: DB vs v62 vs v83
// ==============================
function tripleCheck() {
  console.log('\n' + '='.repeat(80))
  console.log('TRIPLE CROSS-CHECK: DB vs v62 vs v83')
  console.log('='.repeat(80))

  const v62Mobs = JSON.parse(fs.readFileSync(path.join(WZ62_DIR, 'Mob_info.json')))
  const v83Mobs = JSON.parse(fs.readFileSync(path.join(WZ83_DIR, 'Mob_info.json')))
  const v62Names = JSON.parse(fs.readFileSync(path.join(WZ62_DIR, 'String_Mob.json')))
  const v83Names = JSON.parse(fs.readFileSync(path.join(WZ83_DIR, 'String_Mob.json')))
  const dbMobs = db.prepare('SELECT * FROM mobs').all()

  const fieldMap = {
    level: 'level', hp: 'maxHP', mp: 'maxMP', exp: 'exp',
    physical_damage: 'PADamage', magic_damage: 'MADamage',
    defense: 'PDDamage', magic_defense: 'MDDamage',
    accuracy: 'acc', evasion: 'eva', speed: 'speed'
  }

  // For each DB mob, compare all three
  let matchAll = 0, dbMatchV83 = 0, dbMatchV62 = 0, dbMatchNeither = 0
  const interestingCases = []

  for (const dbMob of dbMobs) {
    const v62 = findInWz(v62Mobs, dbMob.id)
    const v83 = findInWz(v83Mobs, dbMob.id)

    if (!v62 && !v83) continue

    let matchesV62 = true, matchesV83 = true
    const details = []

    for (const [dbField, wzField] of Object.entries(fieldMap)) {
      const dbVal = Number(dbMob[dbField] || 0)
      const v62Val = v62 ? Number(v62[wzField] || 0) : null
      const v83Val = v83 ? Number(v83[wzField] || 0) : null

      if (dbVal === 0) continue // skip empty DB fields

      const m62 = v62Val !== null && dbVal === v62Val
      const m83 = v83Val !== null && dbVal === v83Val

      if (!m62) matchesV62 = false
      if (!m83) matchesV83 = false

      // Interesting: DB matches v62 but not v83, or vice versa
      if (v62Val !== null && v83Val !== null && v62Val !== v83Val && dbVal !== 0) {
        if (m62 && !m83) {
          details.push({ field: dbField, db: dbVal, v62: v62Val, v83: v83Val, match: 'v62' })
        } else if (!m62 && m83) {
          details.push({ field: dbField, db: dbVal, v62: v62Val, v83: v83Val, match: 'v83' })
        } else if (!m62 && !m83) {
          details.push({ field: dbField, db: dbVal, v62: v62Val, v83: v83Val, match: 'neither' })
        }
      }
    }

    if (matchesV62 && matchesV83) matchAll++
    else if (matchesV83) dbMatchV83++
    else if (matchesV62) dbMatchV62++
    else dbMatchNeither++

    if (details.length > 0) {
      interestingCases.push({
        id: dbMob.id,
        name: dbMob.name,
        details
      })
    }
  }

  console.log(`\nDB matches both v62 & v83: ${matchAll}`)
  console.log(`DB matches v83 only: ${dbMatchV83}`)
  console.log(`DB matches v62 only: ${dbMatchV62}`)
  console.log(`DB matches neither: ${dbMatchNeither}`)

  // Show cases where DB matches v62 but not v83
  const dbIsV62 = interestingCases.filter(c => c.details.some(d => d.match === 'v62'))
  const dbIsV83 = interestingCases.filter(c => c.details.some(d => d.match === 'v83'))
  const dbIsNeither = interestingCases.filter(c => c.details.some(d => d.match === 'neither'))

  console.log(`\nFields matching v62 (not v83): ${dbIsV62.length} mobs`)
  console.log(`Fields matching v83 (not v62): ${dbIsV83.length} mobs`)
  console.log(`Fields matching neither: ${dbIsNeither.length} mobs`)

  if (dbIsV62.length > 0) {
    console.log('\n--- DB matches v62 (NOT v83) ---')
    for (const c of dbIsV62.slice(0, 15)) {
      console.log(`\n  [${c.id}] ${c.name}`)
      for (const d of c.details.filter(d => d.match === 'v62')) {
        console.log(`    ${d.field}: DB=${d.db} = v62=${d.v62} ≠ v83=${d.v83}`)
      }
    }
  }

  if (dbIsNeither.length > 0) {
    console.log('\n--- DB matches NEITHER version ---')
    for (const c of dbIsNeither.slice(0, 15)) {
      console.log(`\n  [${c.id}] ${c.name}`)
      for (const d of c.details.filter(d => d.match === 'neither')) {
        console.log(`    ${d.field}: DB=${d.db}, v62=${d.v62}, v83=${d.v83}`)
      }
    }
  }
}

// ==============================
// 3. EQUIPMENT COMPARISON v62 vs v83
// ==============================
function compareEquipment() {
  console.log('\n' + '='.repeat(80))
  console.log('EQUIPMENT COMPARISON: v62 vs v83')
  console.log('='.repeat(80))

  const eqpFiles = [
    'Character_Weapon.json', 'Character_Cap.json', 'Character_Coat.json',
    'Character_Longcoat.json', 'Character_Pants.json', 'Character_Shoes.json',
    'Character_Glove.json', 'Character_Cape.json', 'Character_Shield.json',
    'Character_Accessory.json', 'Character_Ring.json'
  ]

  const v62Equip = {}, v83Equip = {}
  for (const file of eqpFiles) {
    const p62 = path.join(WZ62_DIR, file)
    const p83 = path.join(WZ83_DIR, file)
    if (fs.existsSync(p62)) Object.assign(v62Equip, JSON.parse(fs.readFileSync(p62)))
    if (fs.existsSync(p83)) Object.assign(v83Equip, JSON.parse(fs.readFileSync(p83)))
  }

  console.log(`\nv62 equipment: ${Object.keys(v62Equip).length}`)
  console.log(`v83 equipment: ${Object.keys(v83Equip).length}`)

  const onlyV62 = Object.keys(v62Equip).filter(id => !v83Equip[id])
  const onlyV83 = Object.keys(v83Equip).filter(id => !v62Equip[id])
  const inBoth = Object.keys(v62Equip).filter(id => v83Equip[id])

  console.log(`Only in v62: ${onlyV62.length}`)
  console.log(`Only in v83: ${onlyV83.length}`)
  console.log(`In both: ${inBoth.length}`)

  // Check for stat changes
  const statFields = ['incPAD', 'incMAD', 'incPDD', 'incMDD', 'incSTR', 'incDEX', 'incINT', 'incLUK', 'reqLevel', 'tuc']
  let changed = 0
  const changes = []

  for (const id of inBoth) {
    const diffs = []
    for (const f of statFields) {
      const v62Val = v62Equip[id][f]
      const v83Val = v83Equip[id][f]
      if (v62Val != null && v83Val != null && Number(v62Val) !== Number(v83Val)) {
        diffs.push({ field: f, v62: v62Val, v83: v83Val })
      }
    }
    if (diffs.length > 0) {
      changed++
      changes.push({ id, diffs })
    }
  }

  console.log(`\nEquipment with stat changes v62→v83: ${changed}`)
  if (changes.length > 0) {
    console.log('\n--- EQUIPMENT STAT CHANGES (first 20) ---')
    // Load names
    const v83Names = {}
    try {
      const eqp = JSON.parse(fs.readFileSync(path.join(WZ83_DIR, 'String_Eqp.json')))
      function flatten(obj) {
        for (const [k, v] of Object.entries(obj)) {
          if (v && v.name) v83Names[k] = v.name
          else if (typeof v === 'object' && v) flatten(v)
        }
      }
      flatten(eqp)
    } catch(e) {}

    for (const c of changes.slice(0, 20)) {
      const name = v83Names[c.id] || c.id
      console.log(`\n  [${c.id}] ${name}`)
      for (const d of c.diffs) {
        console.log(`    ${d.field}: v62=${d.v62} → v83=${d.v83}`)
      }
    }
  }
}

// ==============================
// 4. SKILL COMPARISON v62 vs v83
// ==============================
function compareSkills() {
  console.log('\n' + '='.repeat(80))
  console.log('SKILL COMPARISON: v62 vs v83')
  console.log('='.repeat(80))

  const v62Skills = JSON.parse(fs.readFileSync(path.join(WZ62_DIR, 'Skill_data.json')))
  const v83Skills = JSON.parse(fs.readFileSync(path.join(WZ83_DIR, 'Skill_data.json')))
  const v83SkillNames = JSON.parse(fs.readFileSync(path.join(WZ83_DIR, 'String_Skill.json')))

  // Flatten
  function flattenSkills(data) {
    const flat = {}
    for (const [bookId, bookData] of Object.entries(data)) {
      for (const [skillId, skillData] of Object.entries(bookData)) {
        if (skillData && typeof skillData === 'object' && skillData.level) {
          flat[skillId] = skillData
        }
      }
    }
    return flat
  }

  const v62Flat = flattenSkills(v62Skills)
  const v83Flat = flattenSkills(v83Skills)

  console.log(`v62 skills: ${Object.keys(v62Flat).length}`)
  console.log(`v83 skills: ${Object.keys(v83Flat).length}`)

  const onlyV62 = Object.keys(v62Flat).filter(id => !v83Flat[id])
  const onlyV83 = Object.keys(v83Flat).filter(id => !v62Flat[id])

  console.log(`Only in v62: ${onlyV62.length}`)
  console.log(`Only in v83: ${onlyV83.length}`)

  // New skills in v83
  if (onlyV83.length > 0) {
    console.log('\n--- NEW SKILLS in v83 ---')
    for (const id of onlyV83.slice(0, 30)) {
      const name = v83SkillNames[id]?.name || 'unknown'
      console.log(`  [${id}] ${name}`)
    }
  }

  // Check damage changes at max level
  const inBoth = Object.keys(v62Flat).filter(id => v83Flat[id])
  const damageChanges = []

  for (const id of inBoth) {
    const v62Levels = v62Flat[id].level || {}
    const v83Levels = v83Flat[id].level || {}

    // Get max level data
    const v62MaxLv = Object.keys(v62Levels).sort((a, b) => Number(b) - Number(a))[0]
    const v83MaxLv = Object.keys(v83Levels).sort((a, b) => Number(b) - Number(a))[0]

    if (!v62MaxLv || !v83MaxLv) continue

    const v62Data = v62Levels[v62MaxLv]
    const v83Data = v83Levels[v83MaxLv]

    const diffs = []
    for (const key of ['damage', 'dam', 'x', 'y', 'z', 'mobCount', 'attackCount', 'time', 'dot', 'dotTime']) {
      if (v62Data[key] != null && v83Data[key] != null && Number(v62Data[key]) !== Number(v83Data[key])) {
        diffs.push({ field: key, v62: v62Data[key], v83: v83Data[key] })
      }
    }

    if (v62MaxLv !== v83MaxLv) {
      diffs.push({ field: 'maxLevel', v62: v62MaxLv, v83: v83MaxLv })
    }

    if (diffs.length > 0) {
      const name = v83SkillNames[id]?.name || id
      damageChanges.push({ id, name, diffs })
    }
  }

  console.log(`\nSkills with damage/level changes: ${damageChanges.length}`)
  if (damageChanges.length > 0) {
    console.log('\n--- SKILL CHANGES v62→v83 (first 30) ---')
    for (const c of damageChanges.slice(0, 30)) {
      console.log(`\n  [${c.id}] ${c.name}`)
      for (const d of c.diffs) {
        console.log(`    ${d.field}: v62=${d.v62} → v83=${d.v83}`)
      }
    }
  }
}

compareVersions()
tripleCheck()
compareEquipment()
compareSkills()

db.close()
