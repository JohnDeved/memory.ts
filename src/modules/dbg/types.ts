import { ChildProcessWithoutNullStreams } from 'child_process'

export type TDbg = ChildProcessWithoutNullStreams

export interface IModules {
  baseAddr: number
  endAddr: number
  module: string
  name: string
}

export enum DataTypes {
  byte = 'b',
  byte2 = 'w',
  byte4 = 'd',
  byte8 = 'q',
  dword = 'p',
  float = 'f',
  double = 'D',

  ascii = 'a',
  unicode = 'u'
}

export type TDataTypes = keyof typeof DataTypes

export type TNumericTypes =
  | 'byte'
  | 'byte2'
  | 'byte4'
  | 'byte8'
  | 'dword'
  | 'float'
  | 'double'

export type TStringTypes =
  | 'ascii'
  | 'unicode'

export type TNumericDataTypes =
  | DataTypes.byte
  | DataTypes.byte2
  | DataTypes.byte4
  | DataTypes.byte8
  | DataTypes.dword
  | DataTypes.float
  | DataTypes.double

export type TStringDataTypes =
  | DataTypes.ascii
  | DataTypes.unicode

export type TMemory = {
  [key in TNumericTypes]: (value: number) => Promise<void>
} & {
  [key in TStringTypes]: (value: string) => Promise<void>
} & {
  [key in TNumericTypes]: () => Promise<number>
} & {
  [key in TStringTypes]: () => Promise<string>
}

export type TMemorySync = {
  [key in TNumericTypes]: number
} & {
  [key in TStringTypes]: string
}

export function isStringType (type: DataTypes) {
  return [DataTypes.unicode, DataTypes.ascii].includes(type)
}

export function isNumericType (type: DataTypes) {
  return !isStringType(type)
}

export function isHexType (type: DataTypes) {
  return ![DataTypes.double, DataTypes.float].includes(type)
}

export interface IWorkData {
  processName: string
  outputBuffer: SharedArrayBuffer
}

export interface IInputData {
  command: string
  expect?: string[]
  collect?: boolean
}
