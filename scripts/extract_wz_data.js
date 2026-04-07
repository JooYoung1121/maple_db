const { WzFile, WzMapleVersion } = require('@tybys/wz')
const fs = require('fs')
const path = require('path')

const WZ_DIR = '/Users/user/Desktop/jy/maple_db/83'
const OUTPUT_DIR = '/Users/user/Desktop/jy/maple_db/wz_data'

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })

function propToObj(prop) {
  if (!prop) return null

  // If it has sub-properties, recurse
  if (prop.wzProperties && prop.wzProperties.size > 0) {
    const obj = {}
    for (const sub of prop.wzProperties) {
      obj[sub.name] = propToObj(sub)
    }
    return obj
  }

  // Return primitive value
  if (prop.value !== undefined && prop.value !== null) {
    return prop.value
  }

  return null
}

async function extractStringWz() {
  console.log('=== Extracting String.wz ===')
  const wzFile = new WzFile(path.join(WZ_DIR, 'String.wz'), WzMapleVersion.GMS)
  await wzFile.parseWzFile()
  const dir = wzFile.wzDirectory

  for (const img of dir.wzImages) {
    console.log(`  Parsing ${img.name}...`)
    try {
      await img.parseImage()
      const data = {}
      for (const prop of img.wzProperties) {
        data[prop.name] = propToObj(prop)
      }
      const outName = img.name.replace('.img', '.json')
      fs.writeFileSync(path.join(OUTPUT_DIR, `String_${outName}`), JSON.stringify(data, null, 2))
      console.log(`    -> ${Object.keys(data).length} entries saved`)
    } catch(e) {
      console.log(`    -> Error: ${e.message}`)
    }
  }
  wzFile.dispose()
}

async function extractMobWz() {
  console.log('\n=== Extracting Mob.wz (info only) ===')
  const wzFile = new WzFile(path.join(WZ_DIR, 'Mob.wz'), WzMapleVersion.GMS)
  await wzFile.parseWzFile()
  const dir = wzFile.wzDirectory

  const mobData = {}
  let count = 0
  const total = dir.wzImages.size
  for (const img of dir.wzImages) {
    count++
    if (count % 100 === 0) console.log(`  ${count}/${total}...`)
    try {
      await img.parseImage()
      const mobId = img.name.replace('.img', '')

      // Extract only 'info' sub-property for stats
      const infoProps = [...img.wzProperties].find(p => p.name === 'info')
      if (infoProps) {
        mobData[mobId] = propToObj(infoProps)
      }
    } catch(e) {
      // skip broken entries
    }
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'Mob_info.json'), JSON.stringify(mobData, null, 2))
  console.log(`  -> ${Object.keys(mobData).length} mobs saved`)
  wzFile.dispose()
}

async function extractItemWz() {
  console.log('\n=== Extracting Item.wz ===')
  const wzFile = new WzFile(path.join(WZ_DIR, 'Item.wz'), WzMapleVersion.GMS)
  await wzFile.parseWzFile()
  const dir = wzFile.wzDirectory

  // Item.wz has subdirectories like Consume, Etc, Install, Cash, Pet
  for (const subDir of dir.wzDirectories) {
    console.log(`  Category: ${subDir.name}`)
    await subDir.parseImages()
    const catData = {}
    for (const img of subDir.wzImages) {
      try {
        await img.parseImage()
        const data = {}
        for (const prop of img.wzProperties) {
          // Each prop is an item ID with info sub-property
          const info = prop.wzProperties ? [...prop.wzProperties].find(p => p.name === 'info') : null
          data[prop.name] = info ? propToObj(info) : propToObj(prop)
        }
        Object.assign(catData, data)
      } catch(e) {}
    }
    fs.writeFileSync(path.join(OUTPUT_DIR, `Item_${subDir.name}.json`), JSON.stringify(catData, null, 2))
    console.log(`    -> ${Object.keys(catData).length} items saved`)
  }

  // Also check top-level images
  for (const img of dir.wzImages) {
    console.log(`  Top-level: ${img.name}`)
    try {
      await img.parseImage()
      const data = {}
      for (const prop of img.wzProperties) {
        data[prop.name] = propToObj(prop)
      }
      fs.writeFileSync(path.join(OUTPUT_DIR, `Item_${img.name.replace('.img', '')}.json`), JSON.stringify(data, null, 2))
    } catch(e) {}
  }

  wzFile.dispose()
}

async function extractEtcWz() {
  console.log('\n=== Extracting Etc.wz ===')
  const wzFile = new WzFile(path.join(WZ_DIR, 'Etc.wz'), WzMapleVersion.GMS)
  await wzFile.parseWzFile()
  const dir = wzFile.wzDirectory

  for (const img of dir.wzImages) {
    console.log(`  ${img.name}`)
    try {
      await img.parseImage()
      const data = {}
      for (const prop of img.wzProperties) {
        data[prop.name] = propToObj(prop)
      }
      fs.writeFileSync(path.join(OUTPUT_DIR, `Etc_${img.name.replace('.img', '')}.json`), JSON.stringify(data, null, 2))
      console.log(`    -> ${Object.keys(data).length} entries`)
    } catch(e) {
      console.log(`    -> Error: ${e.message}`)
    }
  }
  wzFile.dispose()
}

async function extractSkillWz() {
  console.log('\n=== Extracting Skill.wz ===')
  const wzFile = new WzFile(path.join(WZ_DIR, 'Skill.wz'), WzMapleVersion.GMS)
  await wzFile.parseWzFile()
  const dir = wzFile.wzDirectory

  const skillData = {}
  let count = 0
  const total = dir.wzImages.size
  for (const img of dir.wzImages) {
    count++
    if (count % 50 === 0) console.log(`  ${count}/${total}...`)
    try {
      await img.parseImage()
      const skillId = img.name.replace('.img', '')
      const data = {}
      for (const prop of img.wzProperties) {
        if (prop.name === 'skill') {
          // Each sub-prop is a skill with level data
          for (const skillProp of prop.wzProperties) {
            data[skillProp.name] = propToObj(skillProp)
          }
        } else {
          data[prop.name] = propToObj(prop)
        }
      }
      skillData[skillId] = data
    } catch(e) {}
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'Skill_data.json'), JSON.stringify(skillData, null, 2))
  console.log(`  -> ${Object.keys(skillData).length} skill books saved`)
  wzFile.dispose()
}

async function extractCharacterWz() {
  console.log('\n=== Extracting Character.wz (equipment info) ===')
  const wzFile = new WzFile(path.join(WZ_DIR, 'Character.wz'), WzMapleVersion.GMS)
  await wzFile.parseWzFile()
  const dir = wzFile.wzDirectory

  // Character.wz has subdirectories for each equipment type
  for (const subDir of dir.wzDirectories) {
    console.log(`  Category: ${subDir.name}`)
    await subDir.parseImages()
    const catData = {}
    let count = 0
    for (const img of subDir.wzImages) {
      try {
        await img.parseImage()
        const eqId = img.name.replace('.img', '')
        const infoProp = [...img.wzProperties].find(p => p.name === 'info')
        if (infoProp) {
          catData[eqId] = propToObj(infoProp)
        }
      } catch(e) {}
      count++
    }
    if (Object.keys(catData).length > 0) {
      fs.writeFileSync(path.join(OUTPUT_DIR, `Character_${subDir.name}.json`), JSON.stringify(catData, null, 2))
      console.log(`    -> ${Object.keys(catData).length} items saved`)
    }
  }
  wzFile.dispose()
}

async function main() {
  const start = Date.now()

  await extractStringWz()
  await extractEtcWz()
  await extractMobWz()
  await extractItemWz()
  await extractSkillWz()
  await extractCharacterWz()

  console.log(`\nDone in ${((Date.now() - start) / 1000).toFixed(1)}s`)
  console.log('Output directory:', OUTPUT_DIR)
}

main().catch(console.error)
