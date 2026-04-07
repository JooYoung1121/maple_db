const { WzFile, WzMapleVersion } = require('@tybys/wz')
const fs = require('fs')
const path = require('path')

const WZ_DIR = '/Users/user/Desktop/jy/maple_db/62'
const OUTPUT_DIR = '/Users/user/Desktop/jy/maple_db/wz_data_v62'

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })

function propToObj(prop) {
  if (!prop) return null
  if (prop.wzProperties && prop.wzProperties.size > 0) {
    const obj = {}
    for (const sub of prop.wzProperties) {
      obj[sub.name] = propToObj(sub)
    }
    return obj
  }
  if (prop.value !== undefined && prop.value !== null) return prop.value
  return null
}

// Try all versions to find the right one for v62
async function findVersion() {
  const testPath = path.join(WZ_DIR, 'String.wz')
  for (const ver of [WzMapleVersion.GMS, WzMapleVersion.BMS, WzMapleVersion.EMS, WzMapleVersion.CLASSIC]) {
    const wz = new WzFile(testPath, ver)
    try {
      await wz.parseWzFile()
      const dir = wz.wzDirectory
      let firstImg = null
      for (const img of dir.wzImages) { firstImg = img; break }
      if (firstImg) {
        await firstImg.parseImage()
        const props = firstImg.wzProperties
        if (props && props.size > 0) {
          const first = [...props][0]
          if (first.name && /^[A-Za-z0-9]/.test(first.name)) {
            console.log(`Found correct version: ${ver} (first img: ${firstImg.name}, first prop: ${first.name})`)
            wz.dispose()
            return ver
          }
        }
      }
    } catch(e) {}
    wz.dispose()
  }
  return WzMapleVersion.GMS // fallback
}

async function extractFile(wzFileName, version, handler) {
  const wzPath = path.join(WZ_DIR, wzFileName)
  if (!fs.existsSync(wzPath)) { console.log(`  ${wzFileName} not found, skipping`); return }

  const wzFile = new WzFile(wzPath, version)
  await wzFile.parseWzFile()
  await handler(wzFile.wzDirectory)
  wzFile.dispose()
}

async function main() {
  const start = Date.now()
  const version = await findVersion()

  // String.wz
  console.log('=== Extracting String.wz ===')
  await extractFile('String.wz', version, async (dir) => {
    for (const img of dir.wzImages) {
      try {
        await img.parseImage()
        const data = {}
        for (const prop of img.wzProperties) data[prop.name] = propToObj(prop)
        fs.writeFileSync(path.join(OUTPUT_DIR, `String_${img.name.replace('.img', '')}.json`), JSON.stringify(data, null, 2))
        console.log(`  ${img.name}: ${Object.keys(data).length} entries`)
      } catch(e) { console.log(`  ${img.name}: Error - ${e.message.slice(0, 60)}`) }
    }
  })

  // Etc.wz
  console.log('\n=== Extracting Etc.wz ===')
  await extractFile('Etc.wz', version, async (dir) => {
    for (const img of dir.wzImages) {
      try {
        await img.parseImage()
        const data = {}
        for (const prop of img.wzProperties) data[prop.name] = propToObj(prop)
        fs.writeFileSync(path.join(OUTPUT_DIR, `Etc_${img.name.replace('.img', '')}.json`), JSON.stringify(data, null, 2))
        console.log(`  ${img.name}: ${Object.keys(data).length} entries`)
      } catch(e) {}
    }
  })

  // Mob.wz
  console.log('\n=== Extracting Mob.wz (info only) ===')
  await extractFile('Mob.wz', version, async (dir) => {
    const mobData = {}
    let count = 0, total = dir.wzImages.size
    for (const img of dir.wzImages) {
      count++
      if (count % 200 === 0) console.log(`  ${count}/${total}...`)
      try {
        await img.parseImage()
        const mobId = img.name.replace('.img', '')
        const infoProps = [...img.wzProperties].find(p => p.name === 'info')
        if (infoProps) mobData[mobId] = propToObj(infoProps)
      } catch(e) {}
    }
    fs.writeFileSync(path.join(OUTPUT_DIR, 'Mob_info.json'), JSON.stringify(mobData, null, 2))
    console.log(`  -> ${Object.keys(mobData).length} mobs saved`)
  })

  // Item.wz
  console.log('\n=== Extracting Item.wz ===')
  await extractFile('Item.wz', version, async (dir) => {
    for (const subDir of dir.wzDirectories) {
      console.log(`  Category: ${subDir.name}`)
      await subDir.parseImages()
      const catData = {}
      for (const img of subDir.wzImages) {
        try {
          await img.parseImage()
          for (const prop of img.wzProperties) {
            const info = prop.wzProperties ? [...prop.wzProperties].find(p => p.name === 'info') : null
            catData[prop.name] = info ? propToObj(info) : propToObj(prop)
          }
        } catch(e) {}
      }
      fs.writeFileSync(path.join(OUTPUT_DIR, `Item_${subDir.name}.json`), JSON.stringify(catData, null, 2))
      console.log(`    -> ${Object.keys(catData).length} items`)
    }
  })

  // Skill.wz
  console.log('\n=== Extracting Skill.wz ===')
  await extractFile('Skill.wz', version, async (dir) => {
    const skillData = {}
    let count = 0
    for (const img of dir.wzImages) {
      count++
      try {
        await img.parseImage()
        const skillId = img.name.replace('.img', '')
        const data = {}
        for (const prop of img.wzProperties) {
          if (prop.name === 'skill') {
            for (const sp of prop.wzProperties) data[sp.name] = propToObj(sp)
          } else {
            data[prop.name] = propToObj(prop)
          }
        }
        skillData[skillId] = data
      } catch(e) {}
    }
    fs.writeFileSync(path.join(OUTPUT_DIR, 'Skill_data.json'), JSON.stringify(skillData, null, 2))
    console.log(`  -> ${Object.keys(skillData).length} skill books`)
  })

  // Character.wz
  console.log('\n=== Extracting Character.wz (equipment info) ===')
  await extractFile('Character.wz', version, async (dir) => {
    for (const subDir of dir.wzDirectories) {
      console.log(`  Category: ${subDir.name}`)
      await subDir.parseImages()
      const catData = {}
      for (const img of subDir.wzImages) {
        try {
          await img.parseImage()
          const eqId = img.name.replace('.img', '')
          const infoProp = [...img.wzProperties].find(p => p.name === 'info')
          if (infoProp) catData[eqId] = propToObj(infoProp)
        } catch(e) {}
      }
      if (Object.keys(catData).length > 0) {
        fs.writeFileSync(path.join(OUTPUT_DIR, `Character_${subDir.name}.json`), JSON.stringify(catData, null, 2))
        console.log(`    -> ${Object.keys(catData).length} items`)
      }
    }
  })

  console.log(`\nDone in ${((Date.now() - start) / 1000).toFixed(1)}s`)
}

main().catch(console.error)
