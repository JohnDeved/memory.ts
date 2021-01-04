import { ChildProcessWithoutNullStreams, execFile, spawn } from 'child_process'
import path from 'path'

const cdb32 = path.resolve(__dirname, '..', '..', 'bin', 'cdb32.exe')
const cdb64 = path.resolve(__dirname, '..', '..', 'bin', 'cdb64.exe')
const tlist = path.resolve(__dirname, '..', '..', 'bin', 'tlist.exe')

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
  constructor (private readonly dbg: ChildProcessWithoutNullStreams, public processName: string, public is64bit: boolean) {}

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
    let address = 0

    if (typeof addr === 'string' || offsets.length > 0) {
      address = await this.address(addr as string, ...offsets)
    } else {
      address = addr
    }

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
    this.sendCommand('qd')
  }

  public async baseAddress (): Promise<number>
  public async baseAddress (moduleName: string): Promise<number | undefined>
  public async baseAddress (moduleName = this.processName) {
    const module = await this.module(moduleName)
    return module?.baseAddr
  }

  private async sendCommand (cmd: string, expect: string[] = ['0:000>'], collect?: true) {
    this.dbg.stdin.write(`${cmd}\n`)

    return await new Promise<string>(resolve => {
      const listen = (exp: string[], collection = '') => {
        this.dbg.stdout.once('data', (data: Buffer) => {
          collection += data.toString()

          if (exp.map(e => !collection.includes(e)).filter(Boolean).length === 0) {
            return resolve(collection)
          }

          if (collect) {
            return listen(exp, collection)
          }

          listen(exp)
        })
      }
      listen(expect)
    })
  }
}

async function is64Bit (processName: string) {
  return await new Promise<boolean>(resolve => {
    execFile(tlist, ['-w', processName], (_, stdout) => {
      const [, platform] = stdout.match(/^(\d{2})/) ?? []

      resolve(platform === '64')
    })
  })
}

export async function attach (processName: string) {
  const b64 = await is64Bit(processName)
  const dbg = spawn(b64 ? cdb64 : cdb32, ['-pvr', '-pn', processName])

  return await new Promise<Debugger>(resolve => {
    dbg.stdout.on('data', (data: Buffer) => {
      const text = data.toString()
      if (text.includes('0:000>')) {
        dbg.stdout.removeAllListeners('data')
        resolve(new Debugger(dbg, processName, b64))
      }
    })
  })
}
