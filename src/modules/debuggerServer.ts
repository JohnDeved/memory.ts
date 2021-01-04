import { execFile, spawn } from 'child_process'
import { workerData as processName, parentPort } from 'worker_threads'
import path from 'path'

const binDir = path.resolve(__dirname, '..', '..', 'bin')
const cdb32 = path.resolve(binDir, 'cdb32.exe')
const cdb64 = path.resolve(binDir, 'cdb64.exe')
const tlist = path.resolve(binDir, 'tlist.exe')
const out = path.resolve(binDir, 'out')

init(processName).then(dbg => {
  parentPort?.on('message', ({ cmd, expect = ['0:000>'], collect }: { cmd: string, expect?: string[], collect?: true }) => {
    dbg.stdin.write(`${cmd}\n`)

    const listen = (exp: string[], collection = '') => {
      dbg.stdout.once('data', (data: Buffer) => {
        collection += data.toString()

        if (exp.map(e => !collection.includes(e)).filter(Boolean).length === 0) {
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

  return await new Promise<typeof dbg>(resolve => {
    dbg.stdout.on('data', (data: Buffer) => {
      const text = data.toString()
      if (text.includes('0:000>')) {
        dbg.stdout.removeAllListeners('data')
        parentPort?.postMessage({ event: 'init', data: b64 })
        resolve(dbg)
      }
    })
  })
}
