import { Worker } from 'worker_threads'
import path from 'path'
import { readFileSync, unlinkSync, writeFileSync } from 'fs'
import { EventEmitter } from 'events'
import { out } from '../config'

const server = path.resolve(__dirname, 'debuggerServer.js')

interface IModules {
  baseAddr: number
  endAddr: number
  module: string
  name: string
}

export enum DataTypes {
  byte = 'b',
  byte2 = 'w',
  byte4 = 'd',
  byte8 = 'q',
  dword = 'p',
  float = 'f',
  double = 'D',

  ascii = 'a',
  unicode = 'u'
}

type TDataTypes = keyof typeof DataTypes

type TNumericTypes =
  | 'byte'
  | 'byte2'
  | 'byte4'
  | 'byte8'
  | 'dword'
  | 'float'
  | 'double'

type TStringTypes =
  | 'ascii'
  | 'unicode'

type TNumericDataTypes =
  | DataTypes.byte
  | DataTypes.byte2
  | DataTypes.byte4
  | DataTypes.byte8
  | DataTypes.dword
  | DataTypes.float
  | DataTypes.double

type TStringDataTypes =
  | DataTypes.ascii
  | DataTypes.unicode

type TMemory = {
  [key in TNumericTypes]: (value: number) => Promise<void>
} & {
  [key in TStringTypes]: (value: string) => Promise<void>
} & {
  [key in TNumericTypes]: () => Promise<number>
} & {
  [key in TStringTypes]: () => Promise<string>
}

function isNumericType (type: DataTypes) {
  return ![DataTypes.unicode, DataTypes.ascii].includes(type)
}

function isHexType (type: DataTypes) {
  return ![DataTypes.double, DataTypes.float].includes(type)
}

export class Debugger {
  constructor (
    private readonly server: ReturnType<typeof initServer>,
    private readonly pid: number,
    public processName: string,
    public is64bit: boolean
  ) {}

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

  public readSync (type: TNumericDataTypes, address: number): number
  public readSync (type: TStringDataTypes, address: number): string
  public readSync (type: DataTypes, address: number): string | number
  public readSync (type: DataTypes, address: number) {
    const hexAddress = address.toString(16)

    const text = this.sendCommandSync(`d${type} ${hexAddress} L 1`, [hexAddress])
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

  public async write (type: TNumericDataTypes, address: number, value: number): Promise<string>
  public async write (type: TStringDataTypes, address: number, value: string): Promise<string>
  public async write (type: DataTypes, address: number, value: string | number): Promise<string>
  public async write (type: DataTypes, address: number, value: string | number) {
    const hexAddress = address.toString(16)

    if (isHexType(type)) {
      return await this.sendCommand(`e${type} ${hexAddress} ${value.toString(16)}`)
    }

    return await this.sendCommand(`e${type} ${hexAddress} ${value}`)
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

  public async module (modulename = this.processName) {
    const modules = await this.modules()
    return modules.find(module => module.name === modulename)
  }

  public detach () {
    this.sendCommand('qd', ['quit:']).then(() => {
      this.server.worker.terminate()
      unlinkSync(`${out}_${this.pid}`)
    })
  }

  public async baseAddress (): Promise<number>
  public async baseAddress (moduleName: string): Promise<number | undefined>
  public async baseAddress (moduleName = this.processName) {
    const module = await this.module(moduleName)
    return module?.baseAddr
  }

  private sendCommand (cmd: string, expect?: string[], collect?: true) {
    this.server.worker.postMessage({ cmd, expect, collect })

    return new Promise<string>(resolve => {
      this.server.events.once(cmd, resolve)
    })
  }

  private sendCommandSync (cmd: string, expect?: string[], collect?: true) {
    const io = `${out}_${this.pid}`
    this.server.worker.postMessage({ cmd, expect, collect, sync: true })

    let read = ''
    while (!read) read = readFileSync(io, { encoding: 'ascii' })
    writeFileSync(io, '')
    return read
  }
}

function initServer (processName: string) {
  console.log('called init')
  const worker = new Worker(server, { workerData: processName }).on('error', console.error)

  const events = new EventEmitter()
  worker.on('message', ({ event, data }: { event: string, data: any }) => {
    events.emit(event, data)
  })

  return { worker, events }
}

export async function attach (processName: string) {
  const server = initServer(processName)

  return await new Promise<Debugger>(resolve => {
    server.events.once('init', ({ b64, pid }: { b64: boolean, pid: number }) => {
      resolve(new Debugger(server, pid, processName, b64))
    })
  })
}
