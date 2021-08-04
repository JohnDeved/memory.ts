import { DataTypes } from '../modules/dbg/types'
import { attachSync } from '../modules/memory'

attachSync('Tap Dungeon.exe').then(process => {
  const region = process.alloc()

  const myBuffer = Buffer.from('Hello World! This is a bit of a longer text, just for testing if it gets cut off. Lets see how it goes!')
  process.writeBuffer(region, myBuffer)

  const buffer = process.readBuffer(region, myBuffer.byteLength)
  console.log('read buffer', region.toString(16), buffer.toString())

  const readString = process.read(DataTypes.ascii, region)
  console.log('read ascii ', region.toString(16), readString)

  process.free(region)

  process.detach()
})
