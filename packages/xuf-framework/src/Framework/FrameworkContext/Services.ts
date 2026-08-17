import XufFrameworkContext from '.'
import {XufLinkFn, XufSlotFn, XufService} from '@xuf/utils/types'
import XufModuleContext from '../../Module/ModuleContext'
import EventEmitter from '@xuf/utils/EventEmitter'

interface XufRegistration {
  ctx: XufModuleContext
  service: XufService
}

export default class XufServices {
  constructor(fwCtx: XufFrameworkContext) {
    fwCtx
  }

  private _emitter = new EventEmitter()
  private _regns: Record<string, XufRegistration> = {}
  private _slots: Record<string, [string, XufSlotFn][]> = {}

  getService(clazz: string) {
    return this._regns[clazz]?.service
  }

  register(ctx: XufModuleContext, service: XufService) {
    const clazz = service.clazz

    if (this._regns[clazz]) {
      return false
    }

    this._regns[clazz] = {ctx, service}

    // Signal
    const l = this._slots[clazz]
    l?.forEach(el => {
      service.connectSignal(el[0], el[1])
    })

    this._emitter.emit(clazz, true, clazz)

    return true
  }

  unregister(ctx: XufModuleContext, service: XufService) {
    const clazz = service.clazz
    const regn = this._regns[clazz]
    if (regn?.ctx !== ctx || regn?.service !== service) return

    // Signal
    const l = this._slots[clazz]
    l?.forEach(el => {
      service.disconnectSignal(el[0], el[1])
    })

    delete this._regns[clazz]
    this._emitter.emit(clazz, false, clazz)
  }

  unregisterAll(ctx: XufModuleContext) {
    const regns = {...this._regns}

    for (const clazz in regns) {
      if (regns[clazz].ctx === ctx) {
        const service = regns[clazz].service
        this.unregister(ctx, service)
      }
    }
  }

  link(clazz: string, connn: XufLinkFn) {
    return this._emitter.on(clazz, connn)
  }

  unlink(clazz: string, connn: XufLinkFn) {
    this._emitter.off(clazz, connn)
  }

  async invoke(clazz: string, name: string, ...args: any[]) {
    const service = this.getService(clazz)

    if (!service) {
      return undefined
    }

    const result = await service.invoke(name, ...args)
    return result
  }

  connectSignal(clazz: string, signal: string, slot: XufSlotFn) {
    const ss = this._slots[clazz] || []
    if (!ss.find(el => el[0] === signal && el[1] === slot)) {
      ss.push([signal, slot])
    }
    this._slots[clazz] = ss

    const service = this.getService(clazz)
    if (service) {
      service.connectSignal(signal, slot)
    }

    return true
  }

  disconnectSignal(clazz: string, signal: string, slot: XufSlotFn) {
    const ss = this._slots[clazz]
    if (!ss?.length) return

    const idx = ss.findIndex(el => el[0] === signal && el[1] === slot)
    if (idx !== -1) {
      ss.splice(idx, 1)
      if (!ss.length) {
        delete this._slots[clazz]
      }
    }

    const service = this.getService(clazz)
    service?.disconnectSignal(signal, slot)
  }
}
