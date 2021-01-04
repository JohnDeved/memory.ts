import { attach } from './modules/debugger'

async function main () {
  const process = await attach('Tap Dungeon.exe')
  console.log('idk')
  const [money, moneyAddress] = await process.memory(process.processName, 0x2F0DD8, 0x24, 0x8)
  console.log('idk2')

  console.time('10000 writes')
  for (let index = 0; index < 10000; index++) {
    await money.double(index)
  }
  console.timeEnd('10000 writes')

  console.time('10000 reads')
  for (let index = 0; index < 10000; index++) {
    await money.double()
  }
  console.timeEnd('10000 reads')

  console.log(await money.double(), moneyAddress)
  process.detach()
}
main()

// search full process for bytes "00 00 00 00 7E E0 63 41"
// s -b 0 L?7fffffffffff 00 00 00 00 7E E0 63 41
