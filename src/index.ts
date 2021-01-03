import { attach, DataTypes } from './modules/dbg'

async function main () {
  const process = await attach('Tap Dungeon.exe')

  const moneyAddress = await process.address(process.processName, 0x2F0DD8, 0x24, 0x8)
  const money = await process.read(DataTypes.double, moneyAddress)

  const healthAddress = await process.address(process.processName, 0x2F0DD8, 0xFC, 0x2C, 0x5D0)
  const health = await process.read(DataTypes.double, healthAddress)

  console.log({ money, health })

  setInterval(() => {
    process.write(DataTypes.double, healthAddress, '0')
  }, 100)

  // process.detach()
}
main()
