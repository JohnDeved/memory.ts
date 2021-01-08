import { attach, attachSync } from '..'
import { DataTypes } from '../modules/dbg/types'

async function main () {
  const process = await attach('Tap Dungeon.exe')
  const [money, moneyAddress] = await process.memory(process.processName, 0x2F0DD8, 0x24, 0x8)

  let time = Date.now() + 1000
  let index = 0
  for (; time >= Date.now(); index++) await money.double(index)
  console.log('write proxy', index, '/ sec')

  time = Date.now() + 1000
  index = 0
  for (; time >= Date.now(); index++) await money.double()
  console.log('read proxy', index, '/ sec')

  time = Date.now() + 1000
  index = 0
  for (; time >= Date.now(); index++) await process.write(DataTypes.double, moneyAddress, index)
  console.log('write', index, '/ sec')

  time = Date.now() + 1000
  index = 0
  for (; time >= Date.now(); index++) await process.read(DataTypes.double, moneyAddress)
  console.log('read', index, '/ sec')

  console.log(await money.double(), moneyAddress)

  process.detach()

  const processSync = await attachSync('Tap Dungeon.exe')
  const [moneySync, moneyAddressSync] = await processSync.memory(processSync.processName, 0x2F0DD8, 0x24, 0x8)

  time = Date.now() + 1000
  index = 0
  for (; time >= Date.now(); index++) moneySync.double = index
  console.log('sync write proxy', index, '/ sec')

  time = Date.now() + 1000
  index = 0
  for (; time >= Date.now(); index++) void moneySync.double
  console.log('sync read proxy', index, '/ sec')

  time = Date.now() + 1000
  index = 0
  for (; time >= Date.now(); index++) processSync.write(DataTypes.double, moneyAddressSync, index)
  console.log('sync write', index, '/ sec')

  time = Date.now() + 1000
  index = 0
  for (; time >= Date.now(); index++) processSync.read(DataTypes.double, 0x28b5c6c0)
  console.log('sync read', index, '/ sec')

  console.log(moneySync.double, 0x28b5c6c0)

  processSync.detach()
}
main()
