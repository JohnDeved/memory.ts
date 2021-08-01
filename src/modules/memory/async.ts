import { DataTypes, TNumericDataTypes, TStringDataTypes, IModule, TMemory, TDataTypes, TDbg } from '../dbg/types'
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

  public pid = this.dbg.pid

  public async read (type: TNumericDataTypes, address: number): Promise<number>
  public async read (type: TStringDataTypes, address: number): Promise<string>
  public async read (type: DataTypes, address: number): Promise<string | number>
  public async read (type: DataTypes, address: number) {
    const hexAddress = this._readPreProcess(address)
    const text = await this.sendCommand(...this._readCommand(type, hexAddress))
    return this._readPostProcess(type, hexAddress, text)
  }

  public async write (type: TNumericDataTypes, address: number, value: number): Promise<void>
  public async write (type: TStringDataTypes, address: number, value: string): Promise<void>
  public async write (type: DataTypes, address: number, value: string | number): Promise<void>
  public async write (type: DataTypes, address: number, value: string | number) {
    return void await this.sendCommand(...this._writeCommand(type, address, value))
  }

  public async readBuffer (address: number, length: number) {
    const text = await this.sendCommand(...this._readBufferCommand(address, length))
    return this._readBufferPostProcess(text, length)
  }

  public async writeBuffer (address: number, value: Buffer) {
    return void await this.sendCommand(...this._writeBufferCommand(address, value))
  }

  public async alloc (size?: number) {
    const text = await this.sendCommand(...this._allocCommand(size))
    return this._allocPostProcess(text)
  }

  public async free (address: number, size?: number) {
    return void await this.sendCommand(...this._freeCommand(address, size))
  }

  public async modules (): Promise<IModule[]> {
    const text = await this.sendCommand(...this._modulesCommand())
    return this._modulesPostProcess(text)
  }

  public async module (modulename = this.processName) {
    const modules = await this.modules()
    return this._modulePostProcess(modulename, modules)
  }

  public async address (startModule: string, ...offsets: number[]): Promise<number>
  public async address (startAddress: number | string, ...offsets: number[]): Promise<number>
  public async address (startAddress: number | string, ...offsets: number[]) {
    let address = 0

    if (typeof startAddress === 'number') {
      address += await this.read(DataTypes.dword, startAddress)
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
    const address = await this.address(addr, ...offsets)

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
    this.sendCommand(...this._detachCommand())
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
