import { Worker } from 'worker_threads'
import { initDbg } from '../dbg'
import { inputBuffer, outputBuffer, server } from '../dbg/config'
import { IWorkData } from '../dbg/types'
import { Memory } from './async'
import { MemorySync } from './sync'

export async function attach (processName: string) {
  const { b64, dbg } = await initDbg(processName)
  return new Memory(dbg, processName, b64)
}

export function attachSync (processName: string) {
  const workerData: IWorkData = { processName, inputBuffer, outputBuffer }
  const worker = new Worker(server)
  return new Promise<MemorySync>(resolve => {
    worker.postMessage(workerData)
    worker.once('message', ({ b64, pid }: { b64: boolean, pid: number }) => {
      const iBuffer = Buffer.from(inputBuffer)
      const oBuffer = Buffer.from(outputBuffer)
      const memory = new MemorySync(worker, iBuffer, oBuffer, pid, processName, b64)
      resolve(memory)
    })
  })
}
