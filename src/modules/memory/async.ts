import { DataTypes, TNumericDataTypes, TStringDataTypes, IModules, TMemory, TDataTypes, isHexType, isNumericType, TDbg } from '../dbg/types'
import { sendCommand } from '../dbg'
import { MemorySpec } from './spec'

export class Memory extends MemorySpec {
  constructor (
    private readonly dbg: TDbg,
    public processName: string,
    public is64bit: boolean
  ) {
    super()
  }

  public async read (type: TNumericDataTypes, address: number): Promise<number>
  public async read (type: TStringDataTypes, address: number): Promise<string>
  public async read (type: DataTypes, address: number): Promise<string | number>
  public async read (type: DataTypes, address: number) {
    const hexAddress = address.toString(16)

    const text = await this.sendCommand(`d${type} ${hexAddress} L 1`, [hexAddress])
    const regex = new RegExp(`${hexAddress}\\s+(.+?)\\s`)
    const [, res] = regex.exec(text) ?? []

    if (isNumericType(type)) {
      if (isHexType(type)) {
        return parseInt(res.replace(/`/g, ''), 16)
      }

      return Number(res)
    }

    return res
  }

  public async write (type: TNumericDataTypes, address: number, value: number): Promise<void>
  public async write (type: TStringDataTypes, address: number, value: string): Promise<void>
  public async write (type: DataTypes, address: number, value: string | number): Promise<void>
  public async write (type: DataTypes, address: number, value: string | number) {
    const hexAddress = address.toString(16)

    if (isHexType(type)) {
      return void await this.sendCommand(`e${type} ${hexAddress} ${value.toString(16)}`)
    }

    return void await this.sendCommand(`e${type} ${hexAddress} ${value}`)
  }

  public async modules (): Promise<IModules[]> {
    const text = await this.sendCommand('lmn', ['Unloaded', 'modules:'], true)
    return [...text.matchAll(/^(\w{6,16}) (\w{8,16})\s+(\w+) (.+)$/gm)].map(moduleMatch => {
      const [, baseAddr, endAddr, module, name] = moduleMatch
      return {
        baseAddr: parseInt(baseAddr, 16),
        endAddr: parseInt(endAddr, 16),
        module: module.trim(),
        name: name.trim()
      }
    })
  }

  public async module (modulename = this.processName) {
    const modules = await this.modules()
    return modules.find(module => module.name === modulename)
  }

  public async address (startModule: string, ...offsets: number[]): Promise<number>
  public async address (startAddress: number, ...offsets: number[]): Promise<number>
  public async address (startAddress: number | string, ...offsets: number[]) {
    let address = 0

    if (typeof startAddress === 'number') {
      address += startAddress
    }

    if (typeof startAddress === 'string') {
      address += await this.baseAddress(startAddress) ?? 0
    }

    for (const [i, offset] of offsets.entries()) {
      address += offset

      if (i + 1 === offsets.length) {
        break
      }

      address = await this.read(DataTypes.dword, address)
    }

    return address
  }

  public async memory (address: number): Promise<[memory: TMemory, address: number]>
  public async memory (startModule: string, ...offsets: number[]): Promise<[memory: TMemory, address: number]>
  public async memory (startAddress: number, ...offsets: number[]): Promise<[memory: TMemory, address: number]>
  public async memory (addr: number | string, ...offsets: number[]) {
    const address = await this.address(addr as string, ...offsets)

    const proxy = new Proxy<TMemory>({} as any, {
      get: (_, type: TDataTypes) => async (value?: string | number) => {
        if (!DataTypes[type]) return

        if (value) {
          return await this.write(DataTypes[type], address, value)
        }

        return await this.read(DataTypes[type], address)
      }
    })

    return [proxy, address]
  }

  public detach () {
    this.sendCommand('qd', ['quit:'])
  }

  public async baseAddress (): Promise<number>
  public async baseAddress (moduleName: string): Promise<number | undefined>
  public async baseAddress (moduleName = this.processName) {
    const module = await this.module(moduleName)
    return module?.baseAddr
  }

  public sendCommand (command: string, expect?: string[], collect?: boolean) {
    return sendCommand(this.dbg, command, expect, collect)
  }
}
