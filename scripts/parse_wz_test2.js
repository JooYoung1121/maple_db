const { WzFile, WzMapleVersion } = require('@tybys/wz')

async function tryVersion(version, versionName) {
  const wzPath = '/Users/user/Desktop/jy/maple_db/83/String.wz'
  const wzFile = new WzFile(wzPath, version)

  try {
    await wzFile.parseWzFile()
    const dir = wzFile.wzDirectory

    // Get images
    const images = []
    for (let i = 0; i < dir.wzImages.length; i++) {
      images.push(dir.wzImages.at(i))
    }

    console.log(`\n=== ${versionName} ===`)
    for (const img of images.slice(0, 5)) {
      console.log(`  ${img.name}`)
    }

    // Check if names look correct (should be like Mob.img, Map.img, etc.)
    const hasValidNames = images.some(img => /^[A-Za-z]+\.img$/.test(img.name))
    console.log(`  Valid names: ${hasValidNames}`)

    if (hasValidNames) {
      // Parse Mob.img
      const mobImg = images.find(i => i.name === 'Mob.img')
      if (mobImg) {
        await mobImg.parseImage()
        let count = 0
        for (let i = 0; i < mobImg.wzProperties.length && count < 10; i++) {
          const prop = mobImg.wzProperties.at(i)
          let name = 'N/A'
          if (prop.wzProperties) {
            for (let j = 0; j < prop.wzProperties.length; j++) {
              const sub = prop.wzProperties.at(j)
              if (sub.name === 'name') {
                name = sub.value
                break
              }
            }
          }
          console.log(`  Mob ${prop.name}: ${name}`)
          count++
        }
      }
    }

    wzFile.dispose()
    return hasValidNames
  } catch (err) {
    console.log(`  ${versionName}: Error - ${err.message}`)
    wzFile.dispose()
    return false
  }
}

async function main() {
  const versions = [
    [WzMapleVersion.GMS, 'GMS'],
    [WzMapleVersion.EMS, 'EMS'],
    [WzMapleVersion.BMS, 'BMS'],
    [WzMapleVersion.CLASSIC, 'CLASSIC'],
  ]

  for (const [ver, name] of versions) {
    const ok = await tryVersion(ver, name)
    if (ok) {
      console.log(`\n>>> ${name} is the correct version!`)
      break
    }
  }
}

main()
