const { WzFile, WzMapleVersion } = require('@tybys/wz')

// v83 GMS typically uses no encryption (empty IV) or the old GMS key
// Let's try parsing with each version and also attempt to read image data
// to see if the underlying data is actually correct despite garbled names

async function main() {
  const wzPath = '/Users/user/Desktop/jy/maple_db/83/String.wz'

  // Try GMS first - even though names are garbled, try parsing image content
  const versions = [
    WzMapleVersion.GMS,
    WzMapleVersion.EMS,
    WzMapleVersion.BMS,
    WzMapleVersion.CLASSIC
  ]

  for (const ver of [WzMapleVersion.GMS, WzMapleVersion.BMS, WzMapleVersion.CLASSIC]) {
    const wzFile = new WzFile(wzPath, ver)
    await wzFile.parseWzFile()
    const dir = wzFile.wzDirectory

    console.log(`\n=== Version ${ver} ===`)

    // Try parsing each image and see which ones have readable data
    let imgIndex = 0
    for (const img of dir.wzImages) {
      try {
        await img.parseImage()
        const props = img.wzProperties
        if (props && props.size > 0) {
          const firstProp = [...props][0]
          const subProps = firstProp.wzProperties ? [...firstProp.wzProperties] : []
          const propNames = subProps.map(p => p.name).slice(0, 5)
          const propValues = subProps.filter(p => p.value).map(p => `${p.name}=${p.value}`).slice(0, 3)

          console.log(`  img[${imgIndex}] "${img.name}" -> ${props.size} top props, first="${firstProp.name}", sub-names=[${propNames}], values=[${propValues}]`)
        } else {
          console.log(`  img[${imgIndex}] "${img.name}" -> parsed but empty`)
        }
      } catch(e) {
        console.log(`  img[${imgIndex}] "${img.name}" -> PARSE ERROR: ${e.message.slice(0, 80)}`)
      }
      imgIndex++
      if (imgIndex >= 5) break
    }

    wzFile.dispose()
  }
}

main().catch(console.error)
