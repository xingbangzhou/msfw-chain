import XufModule from './Module'
import XufModuleContext from './ModuleContext'
import {XufDestructor} from '../utils'
import {XufSdkCommand, XufFrameworkCommand} from '@xuf/utils/constants'

export default abstract class XufExModule extends XufModule {
  constructor(ctx: XufModuleContext, destructor: XufDestructor) {
    super(ctx, destructor)
  }

  private _enabled = false

  get enabled() {
    return this._enabled
  }

  onCommand(cmd: XufSdkCommand, ...args: any[]) {
    this.ctx.logger.log('XufExModule', 'onCommand: ', cmd, ...args)

    switch (cmd) {
      case XufSdkCommand.Ready:
        this._enabled = true
        this.imReady()
        break
      case XufSdkCommand.Log:
        {
          const [name, ...params] = args
          this.ctx.log(name, ...params)
        }
        break
      case XufSdkCommand.Link:
        {
          const [clazz] = args
          this.ctx.link(clazz, this.onLinkStatus)
        }
        break
      case XufSdkCommand.Unlink:
        {
          const [clazz] = args
          this.ctx.unlink(clazz, this.onLinkStatus)
        }
        break
      case XufSdkCommand.Invoke:
        {
          const [id, clazz, name, ...params] = args
          this.onInvoke(id, clazz, name, ...params)
        }
        break
      case XufSdkCommand.ConnectSignal:
        {
          const [clazz, signal] = args
          this.ctx.connectSignal(clazz, signal, this.onSignal)
        }
        break
      case XufSdkCommand.DisconnectSignal:
        {
          const [clazz, signal] = args
          this.ctx.disconnectSignal(clazz, signal, this.onSignal)
        }
        break
      case XufSdkCommand.AddEventListener:
        {
          const [event] = args
          this.ctx.addEventListener(event, this.handleEvent)
        }
        break
      case XufSdkCommand.RemoveEventListener:
        {
          const [event] = args
          this.ctx.removeEventListener(event, this.handleEvent)
        }
        break
      case XufSdkCommand.PostEvent:
        {
          const [event, ...params] = args
          this.ctx.postEvent(event, ...params)
        }
        break
      case XufSdkCommand.InvokeExt:
        {
          const [id, name, ...params] = args
          this.onInvokeExt(id, name, ...params)
        }
        break
      case XufSdkCommand.OnExtEvent:
        {
          const [event] = args
          this.ctx.onExtEvent(event, this.handleExtEvent)
        }
        break
      case XufSdkCommand.OffExtEvent:
        {
          const [event] = args
          this.ctx.offExtEvent(event, this.handleExtEvent)
        }
        break
      case XufSdkCommand.EmitExtEvent:
        {
          const [event, ...params] = args
          this.ctx.emitExtEvent(event, ...params)
        }
        break
    }
  }

  protected imReady() {
    this.postMessage(XufFrameworkCommand.Ready)
  }

  protected abstract postMessage(cmd: string, ...args: any[]): void

  private async onInvoke(id: string, clazz: string, name: string, ...args: any[]) {
    const result = await this.ctx.invoke(clazz, name, ...args)
    this.postMessage(XufFrameworkCommand.InvokeResult, id, result)
  }

  private onLinkStatus = (on: boolean, clazz: string) => {
    this.postMessage(XufFrameworkCommand.LinkStatus, on, clazz)
  }

  private onSignal = (...args: any[]) => {
    this.postMessage(XufFrameworkCommand.Signal, ...args)
  }

  private handleEvent = (...args: any[]) => {
    this.ctx.logger.log('XufExModule', 'onEvent: ', ...args)

    this.postMessage(XufFrameworkCommand.Event, ...args)
  }

  private async onInvokeExt(id: string, name: string, ...args: any[]) {
    const result = await this.ctx.invokeExt(name, ...args)
    this.postMessage(XufFrameworkCommand.InvokeResult, id, result)
  }

  private handleExtEvent = (...args: any[]) => {
    this.ctx.logger.log('XufExModule', 'handleCtxEvent: ', ...args)

    this.postMessage(XufFrameworkCommand.ExtEvent, ...args)
  }

  protected unload() {
    super.unload()
    this._enabled = false
  }
}
