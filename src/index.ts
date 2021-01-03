import { attach } from './modules/debugger'

async function main () {
  const process = await attach('Tap Dungeon.exe')
  const [money, moneyAddress] = await process.memory(process.processName, 0x2F0DD8, 0x24, 0x8)

  for (let index = 0; index < 1000; index++) {
    console.time('write')
    await money.double(index)
    console.timeEnd('write')

    console.time('read')
    await money.double()
    console.timeEnd('read')
  }

  console.log(await money.double(), moneyAddress)

  process.detach()
}
main()
