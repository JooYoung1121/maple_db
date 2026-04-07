const { WzFile, WzMapleVersion } = require('@tybys/wz')

async function tryVersion(version, versionName) {
  const wzPath = '/Users/user/Desktop/jy/maple_db/83/String.wz'
  const wzFile = new WzFile(wzPath, version)

  try {
    await wzFile.parseWzFile()
    const dir = wzFile.wzDirectory

    // Try to enumerate images
    const names = []
    for (let i = 0; i < dir.wzImages.length; i++) {
      const img = dir.wzImages.at(i)
      names.push(img.name)
    }

    console.log(`${versionName}: images=${names.length}, first=${names.slice(0, 3).join(', ')}`)

    // Check if any name looks like a valid .img name
    const valid = names.some(n => /^[A-Za-z0-9]+\.img$/.test(n))
    if (!valid && names.length > 0) {
      // Try parsing first image anyway to see if data makes sense
      const firstImg = dir.wzImages.at(0)
      try {
        await firstImg.parseImage()
        const props = firstImg.wzProperties
        if (props && props.length > 0) {
          const firstProp = props.at(0)
          console.log(`  First prop: name=${firstProp.name}, has sub-props=${firstProp.wzProperties ? firstProp.wzProperties.length : 0}`)
          // Check if prop names look like numbers (mob IDs)
          const propNames = []
          for (let i = 0; i < Math.min(5, props.length); i++) {
            propNames.push(props.at(i).name)
          }
          console.log(`  First 5 prop names: ${propNames.join(', ')}`)
          const numericProps = propNames.filter(n => /^\d+$/.test(n))
          if (numericProps.length > 0) {
            console.log(`  >> Numeric props found! Data may be valid despite garbled names`)
          }
        }
      } catch (e) {
        console.log(`  Image parse failed: ${e.message}`)
      }
    }

    wzFile.dispose()
    return valid
  } catch (err) {
    console.log(`${versionName}: Error - ${err.message}`)
    return false
  }
}

async function main() {
  const versions = [
    [WzMapleVersion.GMS, 'GMS'],
    [WzMapleVersion.EMS, 'EMS'],
    [WzMapleVersion.BMS, 'BMS'],
    [WzMapleVersion.CLASSIC, 'CLASSIC'],
    [WzMapleVersion.GETFROMZLZ, 'GETFROMZLZ'],
    [WzMapleVersion.GENERATE, 'GENERATE'],
  ]

  for (const [ver, name] of versions) {
    await tryVersion(ver, name)
  }
}

main()
