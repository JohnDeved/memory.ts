import path from 'path'

export const binDir = path.resolve(__dirname, '..', '..', '..', 'bin')
export const cdb32 = path.resolve(binDir, 'cdb32.exe')
export const cdb64 = path.resolve(binDir, 'cdb64.exe')
export const tlist = path.resolve(binDir, 'tlist.exe')
export const server = path.resolve(__dirname, 'server.js')

export const outputBufferSize = 10000
export const outputBuffer = new SharedArrayBuffer(10000)
