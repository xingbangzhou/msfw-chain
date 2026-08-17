import {
  XufEventListener,
  XufLinkFn,
  XufSlotFn,
  XufExtHandler,
  XufService,
  XufContextFuncs,
} from '@xuf/utils/types'
import {XufSdkCommand, XufFrameworkCommand} from '@xuf/utils/constants'
import InvokePool from './InvokePool'

export default abstract class XufExContext implements XufContextFuncs {
  constructor() {}

  private _fwReady = false
  private _ensurePromise: Promise<void> | null = null
  private _ensureResolve?: () => void

  private _clazzLinks: Record<string, XufLinkFn[]> = {}
  private _clazzSlots: [string, string, XufSlotFn[]][] = []
  private _eventListeners: Record<string, XufEventListener[]> = {}
  private _extEventListeners: Record<string, XufEventListener[]> = {}
  private _invokePool = new InvokePool()

  async ensure(overMs = 800) {
    if (this._fwReady) return

    if (this._ensurePromise) {
      return this._ensurePromise
    }

    this._ensurePromise = new Promise<void>(resolve => {
      this._ensureResolve = resolve

      setTimeout(() => {
        this._ensureResolve = undefined
        resolve()
      }, overMs)
    })

    return this._ensurePromise
  }

  log(name: string, ...args: any[]) {
    this.command(XufSdkCommand.Log, name, ...args)
  }

  register(service: XufService): void {
    service
    console.error("[MfxExContext]: don't realize registerService")
  }

  unregister(service: XufService): void {
    service
    console.error("[MfxExContext]: don't realize unregisterService")
  }

  link(clazz: string, linker: XufLinkFn) {
    const links = this._clazzLinks[clazz]
    if (links?.length) {
      links.includes(linker) || links.push(linker)
      return
    }

    this._clazzLinks[clazz] = [linker]
    this.command(XufSdkCommand.Link, clazz)
  }

  unlink(clazz: string, linker: XufLinkFn) {
    const links = this._clazzLinks[clazz]
    if (!links) return
    const idx = links.indexOf(linker)
    if (idx !== -1) {
      links.splice(idx, 1)
      if (!links.length) {
        delete this._clazzLinks[clazz]
        this.command(XufSdkCommand.Unlink, clazz)
      }
    }
  }

  async invoke(clazz: string, name: string, ...args: any[]) {
    const result = await this.invoke0(XufSdkCommand.Invoke, clazz, name, ...args)
    return result
  }

  connectSignal(clazz: string, signal: string, slot: XufSlotFn) {
    const slots = this._clazzSlots.find(el => el[0] === clazz && el[1] === signal)?.[2]
    if (slots?.length) {
      slots.push(slot)
      return
    }

    this._clazzSlots.push([clazz, signal, [slot]])
    this.command(XufSdkCommand.ConnectSignal, clazz, signal)
  }

  disconnectSignal(clazz: string, signal: string, slot: XufSlotFn) {
    const clazzSlots: [string, string, XufSlotFn[]][] = []

    for (let i = 0, l = this._clazzSlots.length; i < l; i++) {
      const si = this._clazzSlots[i]
      if (si[0] === clazz && si[1] === signal) {
        const sl = si[2]
        const idx = sl.indexOf(slot)
        if (idx !== -1) {
          sl.splice(idx, 1)
          if (!sl.length) {
            this.command(XufSdkCommand.DisconnectSignal, clazz, signal)
            continue
          }
        }
      }
      clazzSlots.push(si)
    }

    this._clazzSlots = clazzSlots
  }

  addEventListener(event: string, listener: XufEventListener) {
    const listeners = this._eventListeners[event]
    if (listeners?.length) {
      listeners.push(listener)
      return
    }

    this._eventListeners[event] = [listener]
    this.command(XufSdkCommand.AddEventListener, event)
  }

  removeEventListener(event: string, listener: XufEventListener) {
    const listeners = this._eventListeners[event]
    if (!listeners) return
    const idx = listeners.indexOf(listener)
    if (idx !== -1) {
      listeners.splice(idx, 1)
      if (!listeners.length) {
        delete this._eventListeners[event]
        this.command(XufSdkCommand.RemoveEventListener, event)
      }
    }
  }

  postEvent(event: string, ...args: any[]) {
    this.command(XufSdkCommand.PostEvent, event, ...args)
  }

  setExtHandler(name: string, fn?: XufExtHandler) {
    name
    fn
    console.error("[MfxExContext]: don't realize ctxSetHandler")
  }

  async invokeExt(name: string, ...args: any[]) {
    const fn = (this as any)[name]
    if (typeof fn === 'function') {
      return await fn.call(this, ...args)
    }

    return await this.invoke0(XufSdkCommand.InvokeExt, name, ...args)
  }

  onExtEvent(event: string, listener: XufEventListener) {
    const listeners = this._extEventListeners[event]
    if (listeners?.length) {
      listeners.push(listener)
      return
    }

    this._extEventListeners[event] = [listener]
    this.command(XufSdkCommand.OnExtEvent, event)
  }

  offExtEvent(event: string, listener: XufEventListener) {
    const listeners = this._extEventListeners[event]
    if (!listeners) return
    const idx = listeners.indexOf(listener)
    if (idx !== -1) {
      listeners.splice(idx, 1)
      if (!listeners.length) {
        delete this._extEventListeners[event]
        this.command(XufSdkCommand.OffExtEvent, event)
      }
    }
  }

  emitExtEvent(event: string, ...args: any[]) {
    this.command(XufSdkCommand.EmitExtEvent, event, ...args)
  }

  protected abstract postMessage(cmd: string, ...args: any[]): void

  protected imReady() {
    this.postMessage(XufSdkCommand.Ready)
  }

  protected onCommand = (cmd: string, ...args: any[]) => {
    switch (cmd) {
      case XufFrameworkCommand.Ready:
        this.onFwReady()
        break
      case XufFrameworkCommand.LinkStatus:
        const [on, clazz] = args
        this.onLinkStatus(on, clazz)
        break
      case XufFrameworkCommand.InvokeResult:
        const [id, result] = args
        this.onInvokeResult(id, result)
        break
      case XufFrameworkCommand.Signal:
        this.onSignal(...args)
        break
      case XufFrameworkCommand.Event:
        this.handleEvent(...args)
        break
      case XufFrameworkCommand.ExtEvent:
        this.handleExtEvent(...args)
        break
      default:
        break
    }
  }

  private command(cmd: string, ...args: any[]) {
    if (this._fwReady) {
      this.postMessage(cmd, ...args)
      return
    }
  }

  private onFwReady() {
    if (this._fwReady) return
    this._fwReady = true

    this.log('XufSDK', 'MfxExContext.onFwReady is runned')

    // handle ensures
    this._ensureResolve?.()
  }

  private onLinkStatus(on: boolean, clazz: string) {
    const links = this._clazzLinks?.[clazz]
    links?.forEach(el => el(on, clazz))
  }

  private onInvokeResult(id: string, result: any) {
    this._invokePool.resolve(id, result)
  }

  private onSignal(...args: any[]) {
    const [clazz, signal] = args.slice(-2)
    const slots = this._clazzSlots.find(el => el[0] === clazz && el[1] === signal)?.[2]
    slots?.forEach(el => el(...args))
  }

  private handleEvent(...args: any[]) {
    const [event] = args.slice(-1)
    const listeners = this._eventListeners[event]
    listeners?.forEach(el => el(...args))
  }

  private handleExtEvent(...args: any[]) {
    const [event] = args.slice(-1)
    const listeners = this._extEventListeners[event]
    listeners?.forEach(el => el(...args))
  }

  private async invoke0(cmd: string, ...args: any[]) {
    const {id, result} = this._invokePool.invoke(...args)
    this.command(cmd, id, ...args)

    return result
  }
}
