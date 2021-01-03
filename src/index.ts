import { attach, DataTypes } from "./modules/dbg"


async function main () {
  const memory = await attach('Tap Dungeon.exe')
  const baseAddress = await memory.baseAddress()

  const pointer = await memory.read(DataTypes.dword, baseAddress + 0x2F0DD8)
  const moneyAddress = await memory.read(DataTypes.dword, pointer + 0x24)
  const money = await memory.read(DataTypes.double, moneyAddress + 0x8)
  console.log(pointer.toString(16), moneyAddress.toString(16), money)

  memory.detach()
}
main()