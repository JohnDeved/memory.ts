import { parentPort } from 'worker_threads'
import { initDbg, sendCommand } from '.'
import { inputBufferSize } from './config'
import { IInputData, IWorkData, TDbg } from './types'

class DebugServer {
  constructor (
    private readonly dbg: TDbg,
    private readonly inputBuffer: Buffer,
    private readonly outputBuffer: Buffer
  ) {
    this.requestListener()
  }

  private readonly compareBuffer = Buffer.alloc(inputBufferSize)

  public async requestListener () {
    while (true) {
      while (this.compareBuffer.compare(this.inputBuffer) === 0) {}
      const input = this.inputBuffer.toString().replace(/\0/g, '')
      this.inputBuffer.fill(0)
      await this.onRequest(JSON.parse(input))
    }
  }

  private async onRequest ({ command, expect, collect }: IInputData) {
    const respoonse = await sendCommand(this.dbg, command, expect, collect)
    this.sendResponse(respoonse)
  }

  private sendResponse (respoonse: string) {
    Buffer.from(respoonse).copy(this.outputBuffer)
  }
}

parentPort?.once('message', async ({ processName, inputBuffer, outputBuffer }: IWorkData) => {
  const { b64, dbg } = await initDbg(processName)

  const iBuffer = Buffer.from(inputBuffer)
  const oBuffer = Buffer.from(outputBuffer)
  parentPort?.postMessage({ b64, pid: dbg.pid })
  new DebugServer(dbg, iBuffer, oBuffer)
})
