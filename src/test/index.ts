import { attachSync } from '../modules/memory'

attachSync('Tap Dungeon.exe').then(process => {
  process.writeBuffer(0x00ce0000, Buffer.from('Hello World!'))
  const buffer = process.readBuffer(0x00ce0000, 100)
  console.log(buffer, buffer.byteLength)
  process.detach()
})
