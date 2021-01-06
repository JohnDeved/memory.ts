import { DataTypes, IModules, TMemory } from '../dbg/types'

export abstract class MemorySpec {
  public version = 0.1

  public abstract read (type: DataTypes, address: number): Promise<string> | string
  public abstract write (type: DataTypes, address: number, value: string | number): Promise<void> | void
  public abstract modules (): Promise<IModules[]> | IModules[]
  public abstract module (modulename?: string): Promise<IModules | undefined> | IModules | undefined
  public abstract address (startAddress: number | string, ...offsets: number[]): Promise<number> | number
  public abstract memory (addr: number | string, ...offsets: number[]): Promise<[memory: TMemory, address: number]> | [memory: TMemory, address: number]
  public abstract detach (): void
  public abstract baseAddress (moduleName?: string): Promise<number | undefined> | number | undefined
  public abstract sendCommand (command: string, expect?: string[], collect?: boolean): Promise<string> | string
}
