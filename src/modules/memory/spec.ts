import { DataTypes, IModules, isHexType, isNumericType, isStringType, TMemory, TMemorySync } from '../dbg/types'

export abstract class MemorySpec {
  public version = 0.1

  /**
   * read
   */
  public abstract read (type: DataTypes, address: number): Promise<string | number> | string | number

  protected _readPreProcess (address: number) {
    return address.toString(16)
  }

  protected _readCommand (type: DataTypes, hexAddress: string): Parameters<MemorySpec['sendCommand']> {
    return [`d${type} ${hexAddress} ${isNumericType(type) ? 'L1' : ''}`, [hexAddress]]
  }

  protected _readPostProcess (type: DataTypes, hexAddress: string, text: string) {
    const regex = new RegExp(`${hexAddress}\\s+(.+?)\\s`)
    const [, res] = regex.exec(text) ?? []

    if (!res) {
      return ''
    }

    if (isNumericType(type)) {
      if (isHexType(type)) {
        return parseInt(res, 16)
      }

      return parseFloat(res)
    }

    if (isStringType(type)) {
      return res.slice(1, -1)
    }

    return res
  }

  /**
   * write
   */
  public abstract write (type: DataTypes, address: number, value: string | number): Promise<void> | void

  protected _writeCommand (type: DataTypes, address: number, value: string | number): Parameters<MemorySpec['sendCommand']> {
    if (isHexType(type)) {
      return [`e${type} ${address.toString(16)} ${value.toString(16)}`]
    }

    return [`e${type} ${address.toString(16)} ${value}`]
  }

  /**
   * readBuffer
   */
  public abstract readBuffer (address: number, length: number): Promise<Buffer> | Buffer

  protected _readBufferCommand (address: number, length: number): Parameters<MemorySpec['sendCommand']> {
    return [`db ${address.toString(16)} L ${length}`, undefined, true]
  }

  protected _readBufferPostProcess (text: string, length: number) {
    const bytes = text
      .replace(/^\w{8,16} {2}(.+) {2}.{0,20}(?=$)/gm, '$1') // extract bytes from result
      .replace(/([-\n]|0:000>)/g, ' ') // remove non bytes from string
      .trim().split(' ') // bytes to string array
      .map(n => parseInt(n, 16)) // to number array
      .filter(n => !isNaN(n)) // filter out bad bytes
      .slice(0, length) // remove excesive bytes

    return Buffer.from(bytes)
  }

  /**
   * writeBuffer
   */
  public abstract writeBuffer (address: number, value: Buffer): Promise<void> | void

  protected _writeBufferCommand (address: number, value: Buffer): Parameters<MemorySpec['sendCommand']> {
    const input = [...value].map(n => n.toString(16)).join(' ')
    return [`eb ${address.toString(16)} ${input}`]
  }

  /**
   * alloc
   */
  public abstract alloc (size?: number): Promise<number> | number

  protected _allocCommand (size = 1000): Parameters<MemorySpec['sendCommand']> {
    return [`.dvalloc ${size}`]
  }

  protected _allocPostProcess (text: string) {
    const [, addr] = text.match(/starting at (\w+)/) ?? []

    return parseInt(addr, 16)
  }

  /**
   * free
   */
  public abstract free (address: number, size?: number): Promise<void> | void

  protected _freeCommand (address: number, size = 1000): Parameters<MemorySpec['sendCommand']> {
    return [`.dvfree -d ${address.toString(16)} ${size}`]
  }

  /**
   * modules
   */
  public abstract modules (): Promise<IModules[]> | IModules[]

  protected _modulesCommand (): Parameters<MemorySpec['sendCommand']> {
    return ['lmn', undefined, true]
  }

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
  public abstract memory (addr: number | string, ...offsets: number[]): Promise<[memory: TMemory, address: number]> | [memory: TMemorySync, address: number]

  /**
   * detach
   */
  public abstract detach (): void

  protected _detachCommand (): Parameters<MemorySpec['sendCommand']> {
    return ['qd', ['quit:']]
  }

  /**
   * baseAddress
   */
  public abstract baseAddress (moduleName?: string): Promise<number | undefined> | number | undefined

  /**
   * sendCommand
   */
  public abstract sendCommand (command: string, expect?: string[], collect?: boolean): Promise<string> | string
}
