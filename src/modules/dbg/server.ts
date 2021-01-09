import { parentPort } from 'worker_threads'
import { initDbg, sendCommand } from '.'
import { IInputData, IWorkData, TDbg } from './types'

class DebugServer {
  constructor (
    private readonly dbg: TDbg,
    private readonly outputBuffer: Buffer
  ) {
    parentPort?.on('message', this.onRequest.bind(this))
  }

  private async onRequest ({ command, expect, collect }: IInputData) {
    const respoonse = await sendCommand(this.dbg, command, expect, collect)
    this.sendResponse(respoonse)
  }

  private sendResponse (respoonse: string) {
    Buffer.from(respoonse).copy(this.outputBuffer)
  }
}

parentPort?.once('message', async ({ processName, outputBuffer }: IWorkData) => {
  const { b64, dbg } = await initDbg(processName)

  parentPort?.postMessage({ b64, pid: dbg.pid })
  new DebugServer(dbg, Buffer.from(outputBuffer))
})
