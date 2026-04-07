const { WzFile, WzMapleVersion } = require('@tybys/wz')

async function main() {
  const wzPath = '/Users/user/Desktop/jy/maple_db/83/String.wz'

  // Try BMS which showed entries before
  const wzFile = new WzFile(wzPath, WzMapleVersion.BMS)
  await wzFile.parseWzFile()

  const dir = wzFile.wzDirectory
  console.log('dir type:', typeof dir)
  console.log('dir keys:', Object.keys(dir).slice(0, 20))
  console.log('wzImages type:', typeof dir.wzImages)
  console.log('wzImages:', dir.wzImages)

  // Check if it's iterable
  if (dir.wzImages && typeof dir.wzImages[Symbol.iterator] === 'function') {
    let count = 0
    for (const img of dir.wzImages) {
      console.log(`img: ${img.name}`)
      if (++count > 5) break
    }
  }

  // Check wzDirectory properties
  const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(dir))
  console.log('\ndir prototype methods:', proto)

  // Try direct child access
  if (typeof dir.at === 'function') {
    console.log('\ndir.at(0):', dir.at(0))
  }

  // Check _wzImages or similar
  for (const key of Object.keys(dir)) {
    const val = dir[key]
    if (val && typeof val === 'object' && !Buffer.isBuffer(val)) {
      console.log(`dir.${key}: type=${val.constructor?.name}, length=${val.length}`)
    }
  }

  wzFile.dispose()
}

main().catch(console.error)
