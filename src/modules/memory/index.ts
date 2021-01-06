import { initDbg } from '../dbg'
import { Memory } from './async'

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

// function initServer (processName: string) {
//   const worker = new Worker(server, { workerData: processName }).on('error', console.error)

//   const events = new EventEmitter()
//   worker.on('message', ({ event, data }: { event: string, data: any }) => {
//     events.emit(event, data)
//   })

//   return { worker, events }
// }
