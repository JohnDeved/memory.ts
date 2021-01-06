import { EventEmitter } from 'events'
import { Worker } from 'worker_threads'
import { initDbg } from '../dbg'
import { server } from '../dbg/config'
import { DataTypes, IModules, TMemory } from '../dbg/types'
import { Memory } from './async'

export abstract class MemorySpec {
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

export async function attach (processName: string) {
  const { b64, dbg } = await initDbg(processName)
  return new Memory(dbg, processName, b64)
}

// export function attachSync (processName: string) {
//   const server = initServer(processName)

//   return new Promise<MemorySync>(resolve => {
//     server.events.once('init', ({ b64, pid }: { b64: boolean, pid: number }) => {
//       resolve(new MemorySync(server, pid, processName, b64))
//     })
//   })
// }

function initServer (processName: string) {
  const worker = new Worker(server, { workerData: processName }).on('error', console.error)

  const events = new EventEmitter()
  worker.on('message', ({ event, data }: { event: string, data: any }) => {
    events.emit(event, data)
  })

  return { worker, events }
}
