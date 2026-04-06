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
  if (prop.value !== undefined && prop.value !== null) {
    return prop.value
  }
  return null
}

async function extractQuestWz() {
  console.log('=== Extracting Quest.wz ===')
  const wzFile = new WzFile(path.join(WZ_DIR, 'Quest.wz'), WzMapleVersion.GMS)
  await wzFile.parseWzFile()
  const dir = wzFile.wzDirectory

  // Quest.wz contains: Act.img, Check.img, QuestInfo.img, Say.img
  for (const img of dir.wzImages) {
    console.log(`  Parsing ${img.name}...`)
    try {
      await img.parseImage()
      const data = {}
      for (const prop of img.wzProperties) {
        data[prop.name] = propToObj(prop)
      }
      const outName = img.name.replace('.img', '.json')
      fs.writeFileSync(
        path.join(OUTPUT_DIR, `Quest_${outName}`),
        JSON.stringify(data, null, 2)
      )
      console.log(`    -> ${Object.keys(data).length} entries saved`)
    } catch (e) {
      console.log(`    -> Error: ${e.message}`)
    }
  }

  wzFile.dispose()
  console.log('Done!')
}

// Also extract quest name strings from String.wz if not already done
async function extractQuestStrings() {
  const outPath = path.join(OUTPUT_DIR, 'String_Quest.json')
  if (fs.existsSync(outPath)) {
    console.log('String_Quest.json already exists, skipping...')
    return
  }

  console.log('\n=== Extracting Quest Strings from String.wz ===')
  const wzFile = new WzFile(path.join(WZ_DIR, 'String.wz'), WzMapleVersion.GMS)
  await wzFile.parseWzFile()
  const dir = wzFile.wzDirectory

  for (const img of dir.wzImages) {
    if (img.name !== 'Quest.img') continue
    await img.parseImage()
    const data = {}
    for (const prop of img.wzProperties) {
      data[prop.name] = propToObj(prop)
    }
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2))
    console.log(`  -> ${Object.keys(data).length} quest strings saved`)
    break
  }

  wzFile.dispose()
}

async function main() {
  const start = Date.now()
  await extractQuestWz()
  await extractQuestStrings()
  console.log(`\nCompleted in ${((Date.now() - start) / 1000).toFixed(1)}s`)
  console.log('Output directory:', OUTPUT_DIR)
}

main().catch(console.error)
