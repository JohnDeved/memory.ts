import { execFile, spawn } from 'child_process'
import { workerData as processName, parentPort } from 'worker_threads'
import { ensureFile, writeFileSync } from 'fs-extra'
import { cdb32, cdb64, out, tlist } from '../config'

init(processName).then(dbg => {
  parentPort?.on('message', ({ cmd, expect = ['0:000>'], collect, sync }: { cmd: string, expect?: string[], collect?: true, sync?: true }) => {
    dbg.stdin.write(`${cmd}\n`)

    const listen = (exp: string[], collection = '') => {
      dbg.stdout.once('data', (data: Buffer) => {
        collection += data.toString()

        if (exp.map(e => !collection.includes(e)).filter(Boolean).length === 0) {
          if (sync) {
            return writeFileSync(`${out}_${dbg.pid}`, collection)
          }

          return parentPort?.postMessage({ event: cmd, data: collection })
        }

        if (collect) {
          return listen(exp, collection)
        }

        listen(exp)
      })
    }
    listen(expect)
  })
})

async function is64Bit (processName: string) {
  return await new Promise<boolean>(resolve => {
    execFile(tlist, ['-w', processName], (_, stdout) => {
      const [, platform] = stdout.match(/^(\d{2})/) ?? []

      resolve(platform === '64')
    })
  })
}

async function init (processName: string) {
  const b64 = await is64Bit(processName)
  const dbg = spawn(b64 ? cdb64 : cdb32, ['-pvr', '-pn', processName])
  console.log('init called')
  await ensureFile(`${out}_${dbg.pid}`)

  return await new Promise<typeof dbg>(resolve => {
    dbg.stdout.on('data', (data: Buffer) => {
      const text = data.toString()
      if (text.includes('0:000>')) {
        dbg.stdout.removeAllListeners('data')
        parentPort?.postMessage({ event: 'init', data: { b64, pid: dbg.pid } })
        resolve(dbg)
      }
    })
  })
}
