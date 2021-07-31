import { attachSync } from '../modules/memory'

attachSync('Tap Dungeon.exe').then(process => {
  const region = process.alloc()

  const myBuffer = Buffer.from('Hello World!')
  process.writeBuffer(region, myBuffer)

  const buffer = process.readBuffer(region, myBuffer.byteLength)
  console.log(region.toString(16), buffer.toString())

  // process.free(region)

  process.detach()
})
