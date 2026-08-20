import {PlayerEventMap, PlayerParameters} from '../../types'

export class MessageParameterMap {
  create: {id: number; canvas: OffscreenCanvas; parameters: PlayerParameters} = null as any

  invoke: {id: number; fnName: string; args: any[]; resolveId?: number} = null as any

  destroy: {id: number} = null as any
}

export class WorkerParameterMap {
  log: {name: string; args: any[]} = null as any
  error: {name: string; args: any[]} = null as any

  invokeReturn: {resolveId: number; data: any} = null as any

  emitEvent: {event: keyof PlayerEventMap; args: any[]} = null as any

  playAudio: {id: string; buffer: ArrayBuffer} = null as any
  stopAudio: string = null as any
}
