import { execFile, spawn } from 'child_process'
import { cdb32, cdb64, tlist } from './config'
import { TDbg } from './types'

export async function is64Bit (processName: string) {
  return await new Promise<boolean>(resolve => {
    execFile(tlist, ['-w', processName], (_, stdout) => {
      const [, platform] = stdout.match(/^(\d{2})/) ?? []

      resolve(platform === '64')
    })
  })
}

export async function initDbg (processName: string) {
  const b64 = await is64Bit(processName)
  const dbg = spawn(b64 ? cdb64 : cdb32, ['-pvr', '-pn', processName])
  dbg.stderr.pipe(process.stdout)

  return await new Promise<{ dbg: typeof dbg, b64: typeof b64 }>((resolve) => {
    dbg.stdout.on('data', (data: Buffer) => {
      const text = data.toString()
      if (text.includes('0:000>')) {
        dbg.stdout.removeAllListeners('data')
        resolve({ dbg, b64 })
      }
    })
  })
}

export function sendCommand (dbg: TDbg, command: string, expect = ['0:000>'], collect = false) {
  dbg.stdin.write(`${command}\n`)

  return fetchResults(dbg, expect, collect)
}

function fetchResults (dbg: TDbg, expect: string[], collect: boolean) {
  return new Promise<string>(resolve => {
    const listen = (exp: string[], collection = '') => {
      dbg.stdout.once('data', (data: Buffer) => {
        collection += data.toString().replace(/([0-9a-f]{8})`([0-9a-f]{8})/gi, '$1$2')

        if (exp.map(e => !collection.includes(e)).filter(Boolean).length === 0) {
          return resolve(collection)
        }

        if (collect) {
          return listen(exp, collection)
        }

        listen(exp)
      })
    }

    listen(expect)
  })
}
