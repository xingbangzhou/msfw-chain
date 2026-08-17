import {XufEventListener} from '@xuf/utils/types'
import EventEmitter from '@xuf/utils/EventEmitter'

export default class XufEvents {
  constructor() {}

  private _emitter = new EventEmitter()

  postEvent(event: string, ...args: any[]) {
    this._emitter.emit(event, ...args, event)
  }

  addListener(event: string, listener: XufEventListener) {
    return this._emitter.on(event, listener)
  }

  removeListener(event: string, listener: XufEventListener) {
    this._emitter.off(event, listener)
  }
}
