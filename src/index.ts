import { DataTypes } from './modules/dbg/types'
import { attach } from './modules/memory'

async function main () {
  const process = await attach('Tap Dungeon.exe')
  const [money, moneyAddress] = await process.memory(process.processName, 0x2F0DD8, 0x24, 0x8)

  // let time = Date.now() + 1000
  // let index = 0
  // for (; time >= Date.now(); index++) await money.double(index)
  // console.log('write', index, '/ sec')

  // time = Date.now() + 1000
  // index = 0
  // for (; time >= Date.now(); index++) await money.double()
  // console.log('read', index, '/ sec')

  // time = Date.now() + 1000
  // index = 0
  // for (; time >= Date.now(); index++) process.readSync(DataTypes.double, moneyAddress)
  // console.log('readSync', index, '/ sec')

  const newMoney = await money.double() * 2
  await money.double(newMoney)
}
main()

// search full process for bytes "00 00 00 00 7E E0 63 41"
// s -b 0 L?7fffffffffff 00 00 00 00 7E E0 63 41
