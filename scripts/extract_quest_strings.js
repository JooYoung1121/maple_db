/**
 * String.wz에서 Quest 관련 문자열 추출 시도.
 * v62 KMS String.wz에는 Quest.img가 없을 수 있으므로,
 * 대안으로 Quest_QuestInfo.json의 name 필드(중국어)를 매핑 파일로 저장.
 */
const { WzFile, WzMapleVersion } = require('@tybys/wz')
const fs = require('fs')
const path = require('path')

const WZ_DIR = '/Users/user/Desktop/jy/maple_db/62'
const OUTPUT_DIR = '/Users/user/Desktop/jy/maple_db/wz_data_v62'

async function main() {
  const outPath = path.join(OUTPUT_DIR, 'Quest_String.json')

  // 1) Try String.wz for Quest.img
  console.log('=== Trying String.wz for Quest strings ===')
  const wzFile = new WzFile(path.join(WZ_DIR, 'String.wz'), WzMapleVersion.GMS)
  await wzFile.parseWzFile()
  const dir = wzFile.wzDirectory

  let found = false
  for (const img of dir.wzImages) {
    if (img.name.toLowerCase().includes('quest')) {
      console.log(`  Found: ${img.name}`)
      await img.parseImage()
      const data = {}
      for (const prop of img.wzProperties) {
        data[prop.name] = propToObj(prop)
      }
      fs.writeFileSync(outPath, JSON.stringify(data, null, 2))
      console.log(`  -> ${Object.keys(data).length} quest strings saved`)
      found = true
      break
    }
  }

  if (!found) {
    console.log('  No Quest.img found in String.wz')
    console.log('  Available images:')
    for (const img of dir.wzImages) {
      console.log(`    - ${img.name}`)
    }
  }
  wzFile.dispose()

  // 2) Build quest name mapping from QuestInfo.json (Chinese names from TW v62)
  console.log('\n=== Building Quest name mapping from QuestInfo.json ===')
  const questInfo = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'Quest_QuestInfo.json'), 'utf-8'))
  const nameMap = {}
  let count = 0
  for (const [id, info] of Object.entries(questInfo)) {
    if (info && info.name) {
      nameMap[id] = {
        name_tw: info.name,       // Traditional Chinese name
        parent: info.parent || null,
        area: info.area || null,
      }
      count++
    }
  }

  const mapPath = path.join(OUTPUT_DIR, 'Quest_NameMap.json')
  fs.writeFileSync(mapPath, JSON.stringify(nameMap, null, 2))
  console.log(`  -> ${count} quest name mappings saved to Quest_NameMap.json`)

  // 3) Also list all quest IDs that exist in v62 WZ data
  const v62QuestIds = Object.keys(questInfo).map(Number).sort((a, b) => a - b)
  const idsPath = path.join(OUTPUT_DIR, 'Quest_V62_IDs.json')
  fs.writeFileSync(idsPath, JSON.stringify(v62QuestIds))
  console.log(`  -> ${v62QuestIds.length} v62 quest IDs saved`)
  console.log(`  ID range: ${v62QuestIds[0]} ~ ${v62QuestIds[v62QuestIds.length - 1]}`)
}

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

main().catch(console.error)
