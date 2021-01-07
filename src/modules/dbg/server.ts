import { workerData as processName, parentPort } from 'worker_threads'
import { initDbg, sendCommand } from '.'
import { TDbg } from './types'

interface IMessageDate {
  command: string
  expect?: string[]
  collect?: true
  sync?: true
  dbg: TDbg
  sharedMemory: SharedArrayBuffer
}

init(processName).then(dbg => {
  parentPort?.on('message', data => handleMessage({ ...data, dbg }))
})

async function init (processName: string) {
  const { b64, dbg } = await initDbg(processName)

  parentPort?.postMessage({ event: 'init', data: { b64, pid: dbg.pid } })

  return dbg
}

async function handleMessage ({ dbg, command, expect, collect, sync, sharedMemory }: IMessageDate) {
  const respoonse = await sendCommand(dbg, command, expect, collect)

  Buffer.from(respoonse).copy(Buffer.from(sharedMemory))
}
