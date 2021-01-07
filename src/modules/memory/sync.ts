import { DataTypes, TNumericDataTypes, TStringDataTypes, IModules, TDataTypes, TMemorySync } from '../dbg/types'
import { MemorySpec } from './spec'
import { Worker } from 'worker_threads'
import { EventEmitter } from 'events'

export class MemorySync extends MemorySpec {
  constructor (
    private readonly server: { worker: Worker, events: EventEmitter },
    public pid: number,
    public processName: string,
    public is64bit: boolean
  ) {
    super()
  }

  public read (type: TNumericDataTypes, address: number): number
  public read (type: TStringDataTypes, address: number): string
  public read (type: DataTypes, address: number): string | number
  public read (type: DataTypes, address: number) {
    const hexAddress = this._readPreProcess(address)
    const text = this.sendCommand(...this._readCommand(type, hexAddress))
    return this._readPostProcess(type, hexAddress, text)
  }

  public write (type: TNumericDataTypes, address: number, value: number): void
  public write (type: TStringDataTypes, address: number, value: string): void
  public write (type: DataTypes, address: number, value: string | number): void
  public write (type: DataTypes, address: number, value: string | number) {
    const hexAddress = this._writePreProcess(address)
    return void this.sendCommand(...this._writeCommand(type, hexAddress, value))
  }

  public modules (): IModules[] {
    const text = this.sendCommand(...this._modulesCommand())
    return this._modulesPostProcess(text)
  }

  public module (modulename = this.processName) {
    const modules = this.modules()
    return this._modulePostProcess(modulename, modules)
  }

  public address (startModule: string, ...offsets: number[]): number
  public address (startAddress: number | string, ...offsets: number[]): number
  public address (startAddress: number | string, ...offsets: number[]) {
    let address = 0

    if (typeof startAddress === 'number') {
      address += startAddress
    }

    if (typeof startAddress === 'string') {
      address += this.baseAddress(startAddress) ?? 0
    }

    for (const [i, offset] of offsets.entries()) {
      address += offset

      if (i + 1 === offsets.length) {
        break
      }

      address = this.read(DataTypes.dword, address)
    }

    return address
  }

  public memory (address: number): [memory: TMemorySync, address: number]
  public memory (startModule: string, ...offsets: number[]): [memory: TMemorySync, address: number]
  public memory (startAddress: number, ...offsets: number[]): [memory: TMemorySync, address: number]
  public memory (addr: number | string, ...offsets: number[]) {
    const address = this.address(addr, ...offsets)

    const proxy = new Proxy<TMemorySync>({} as any, {
      get: (_, type: TDataTypes) => {
        if (!DataTypes[type]) return
        return this.read(DataTypes[type], address)
      },
      set: (_, type: TDataTypes, value: string | number) => {
        if (!DataTypes[type]) return false
        this.write(DataTypes[type], address, value)
        return true
      }
    })

    return [proxy, address]
  }

  public detach () {
    this.sendCommand(...this._detachCommand())
    this.server.worker.terminate()
  }

  public baseAddress (): number
  public baseAddress (moduleName: string): number | undefined
  public baseAddress (moduleName = this.processName) {
    const module = this.module(moduleName)
    return module?.baseAddr
  }

  public sendCommand (command: string, expect?: string[], collect?: boolean) {
    const size = 50000
    const sharedMemory = new SharedArrayBuffer(size)
    const memory = Buffer.from(sharedMemory)
    const comp = Buffer.alloc(size)

    this.server.worker.postMessage({ command, expect, collect, sync: true, sharedMemory })

    while (comp.compare(memory) === 0) {}

    const read = memory.toString()
    return read
  }
}
