import { DataTypes, IModules, isHexType, isNumericType, TMemory } from '../dbg/types'

export abstract class MemorySpec {
  public version = 0.1

  /**
   * read
   */
  public abstract read (type: DataTypes, address: number): Promise<string> | string

  protected _readPreProcess (address: number) {
    return address.toString(16)
  }

  protected _readPostProcess (type: DataTypes, hexAddress: string, text: string) {
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

  /**
   * write
   */
  public abstract write (type: DataTypes, address: number, value: string | number): Promise<void> | void
  protected _writePreProcess = this._readPreProcess

  /**
   * modules
   */
  public abstract modules (): Promise<IModules[]> | IModules[]
  protected _modulesPostProcess (text: string) {
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

  /**
   * module
   */
  public abstract module (modulename?: string): Promise<IModules | undefined> | IModules | undefined
  protected _modulePostProcess (modulename: string, modules: IModules[]) {
    return modules.find(module => module.name === modulename)
  }

  /**
   * address
   */
  public abstract address (startAddress: number | string, ...offsets: number[]): Promise<number> | number

  /**
   * memory
   */
  public abstract memory (addr: number | string, ...offsets: number[]): Promise<[memory: TMemory, address: number]> | [memory: TMemory, address: number]

  /**
   * detach
   */
  public abstract detach (): void

  /**
   * baseAddress
   */
  public abstract baseAddress (moduleName?: string): Promise<number | undefined> | number | undefined

  /**
   * sendCommand
   */
  public abstract sendCommand (command: string, expect?: string[], collect?: boolean): Promise<string> | string
}
