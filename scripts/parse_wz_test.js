const { WzFile, WzMapleVersion } = require('@tybys/wz')

async function testParse() {
  const wzPath = '/Users/user/Desktop/jy/maple_db/83/String.wz'

  console.log('Opening String.wz...')
  const wzFile = new WzFile(wzPath, WzMapleVersion.BMS)

  try {
    const parseResult = await wzFile.parseWzFile()
    console.log('Parse result:', parseResult)

    const dir = wzFile.wzDirectory
    console.log('\n=== Top-level entries in String.wz ===')

    if (dir && dir.wzImages) {
      for (const img of dir.wzImages) {
        console.log(`  - ${img.name} (${img.blockSize} bytes)`)
      }
    }

    if (dir && dir.subDirs) {
      for (const subDir of dir.subDirs) {
        console.log(`  [DIR] ${subDir.name}`)
      }
    }

    // Try to read Mob.img (monster names)
    console.log('\n=== Parsing Mob.img (monster names) ===')
    const mobImg = dir.getChildImages().find(i => i.name === 'Mob.img')
    if (mobImg) {
      await mobImg.parseImage()
      const props = mobImg.wzProperties
      let count = 0
      for (const prop of props) {
        if (count >= 20) {
          console.log(`  ... and more (total props: ${props.length})`)
          break
        }
        // Each prop is a mob ID, containing sub-props like 'name'
        const nameProp = prop.wzProperties ? prop.wzProperties.find(p => p.name === 'name') : null
        console.log(`  ID: ${prop.name}, Name: ${nameProp ? nameProp.value : 'N/A'}`)
        count++
      }
    }

    // Try to read Item.img or Eqp.img
    console.log('\n=== Parsing Eqp.img (equipment names) ===')
    const eqpImg = dir.getChildImages().find(i => i.name === 'Eqp.img')
    if (eqpImg) {
      await eqpImg.parseImage()
      const props = eqpImg.wzProperties
      let count = 0
      for (const prop of props) {
        console.log(`  Category: ${prop.name}`)
        if (prop.wzProperties && count < 3) {
          for (const sub of prop.wzProperties.slice(0, 3)) {
            console.log(`    Sub: ${sub.name}`)
            if (sub.wzProperties) {
              for (const item of sub.wzProperties.slice(0, 3)) {
                const nameProp = item.wzProperties ? item.wzProperties.find(p => p.name === 'name') : null
                console.log(`      ID: ${item.name}, Name: ${nameProp ? nameProp.value : 'N/A'}`)
              }
            }
          }
        }
        count++
      }
    }

  } catch (err) {
    console.error('Error:', err.message)
    console.error(err.stack)
  } finally {
    wzFile.dispose()
  }
}

testParse()
