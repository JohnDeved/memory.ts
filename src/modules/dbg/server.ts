import { writeFileSync } from 'fs-extra'
import { workerData as processName, parentPort } from 'worker_threads'
import { getOutPath, initDbg, sendCommand } from '.'
import { TDbg } from './types'

interface IMessageDate {
  command: string
  expect?: string[]
  collect?: true
  sync?: true
  dbg: TDbg
}

init(processName).then(dbg => {
  parentPort?.on('message', data => handleMessage({ ...data, dbg }))
})

async function init (processName: string) {
  const { b64, dbg } = await initDbg(processName, true)

  parentPort?.postMessage({ event: 'init', data: { b64, pid: dbg.pid } })

  return dbg
}

async function handleMessage ({ dbg, command, expect, collect, sync }: IMessageDate) {
  const respoonse = await sendCommand(dbg, command, expect, collect)

  if (sync) {
    return writeFileSync(getOutPath(dbg.pid), respoonse)
  }

  parentPort?.postMessage({ event: command, data: respoonse })
}
