import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { endianness } from "os";
import path from "path";

const cdb32 = path.resolve(__dirname, '..', '..', 'bin', 'cdb32.exe')

interface IModules {
  baseAddr: number
  endAddr: number
  module: string
  name: string
}

export enum DataTypes {
  ascii = 'a',
  byte = 'b',
  byte2 = 'w',
  byte4 = 'd',
  byte8 = 'q',
  dword = 'p',
  double = 'D',
  float = 'f',
  unicode = 'u'
}

class Memory {
  constructor (private dbg: ChildProcessWithoutNullStreams, private processName: string) {}

  public read (type: DataTypes.dword, address: number): Promise<number>
  public read (type: DataTypes.double, address: number): Promise<number>
  public read (type: DataTypes, address: number): Promise<string>
  public async read (type: DataTypes, address: number) {
    const hexAddress = address.toString(16)
  
    const text = await this.sendCommand(`d${type} ${hexAddress} L 1`, [hexAddress])
    const regex = new RegExp(`${hexAddress}\\s+(.+?)\\s`)
    const [, res] = regex.exec(text) ?? []

    if (type === DataTypes.double) {
      return Number(res)
    }

    if (type === DataTypes.dword) {
      return parseInt(res, 16)
    }

    return res
  }
  
  public async write (type: DataTypes, address: number, value: string) {
    const hexAddress = address.toString(16)
  
    await this.sendCommand(`e${type} ${hexAddress} ${value}`)
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
  
  public detach () {
    this.sendCommand('.detach')
    this.sendCommand('q')
  }

  public async module (modulename = this.processName) {
    const modules = await this.modules()
    console.log(modules)
    return modules.find(module => module.name === modulename)
  }

  public async baseAddress (): Promise<number>
  public async baseAddress (moduleName: string): Promise<number | undefined>
  public async baseAddress (moduleName = this.processName) {
    const module = await this.module(moduleName)
    return module?.baseAddr
  }

  private sendCommand (cmd: string, expect: string[] = ['0:000>'], collect?: true) {
    this.dbg.stdin.write(cmd + '\n')

    return new Promise<string>(resolve => {
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

export function attach (processName: string) {  
  const dbg = spawn(cdb32, ['-pvr', '-pn', processName])

  return new Promise<Memory> (resolve => {
    dbg.stdout.on('data', (data: Buffer) => {
      const text = data.toString()
      if (text.includes('0:000>')) {
        dbg.stdout.removeAllListeners('data')
        resolve(new Memory(dbg, processName))
      }
    })
  })
}