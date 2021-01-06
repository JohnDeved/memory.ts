import path from 'path'
import os from 'os'

export const binDir = path.resolve(__dirname, '..', '..', '..', 'bin')
export const cdb32 = path.resolve(binDir, 'cdb32.exe')
export const cdb64 = path.resolve(binDir, 'cdb64.exe')
export const tlist = path.resolve(binDir, 'tlist.exe')
export const out = path.resolve(os.tmpdir(), 'out')
export const server = path.resolve(__dirname, 'server.js')
