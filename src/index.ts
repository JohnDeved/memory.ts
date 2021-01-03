import { attach, DataTypes } from './modules/debugger'

async function main () {
  const process = await attach('Tap Dungeon.exe')

  const moneyAddress = await process.address(process.processName, 0x2F0DD8, 0x24, 0x8)
  const [money] = await process.memory(moneyAddress)

  for (let index = 0; index < 1000; index++) {
    console.time('write')
    await money.double(index)
    console.timeEnd('write')

    console.time('read')
    await money.double()
    console.timeEnd('read')
  }

  process.detach()
}
main()
