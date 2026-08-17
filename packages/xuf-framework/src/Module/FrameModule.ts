import XufModuleContext from './ModuleContext'
import {XufDestructor} from '../utils'
import XufExModule from './ExModule'

class XufFrameChannel {
  constructor() {
    window.addEventListener('message', this.onMessage)
  }

  private _modules?: XufFrameModule[]

  attach(frameModule: XufFrameModule) {
    if (!this._modules) this._modules = [frameModule]
    else if (!this._modules.includes(frameModule)) {
      this._modules.push(frameModule)
    }
  }

  detach(frameModule: XufFrameModule) {
    this._modules = this._modules?.filter(el => el !== frameModule)
  }

  private onMessage = (ev: MessageEvent<any>) => {
    const {source, data} = ev
    if (source === window) return
    const frameModule = this._modules?.find(el => el.window === source)
    if (!frameModule) return

    try {
      const cmd = data.cmd
      const args = data.args
      if (Array.isArray(args)) {
        frameModule.onCommand(cmd, ...args)
      }
    } catch (error) {
      frameModule.ctx.logger.error('XufFrameChannel', 'onMesssage, error: ', error)
    }
  }
}

const channel = new XufFrameChannel()

export default class XufFrameModule extends XufExModule {
  constructor(ctx: XufModuleContext, destructor: XufDestructor, iframeEl: HTMLIFrameElement) {
    super(ctx, destructor)

    this._iframeRef = new WeakRef(iframeEl)
    channel.attach(this)

    this.imReady()
  }

  private _iframeRef: WeakRef<HTMLIFrameElement> | null = null

  get window() {
    return this._iframeRef?.deref()?.contentWindow
  }

  resize(width: number, height: number) {
    const iframeEl = this._iframeRef?.deref()
    if (!iframeEl) {
      this.ctx.log('FrameModule', 'resize, error: iframe has been garbage-collected.')
      return
    }
    Object.assign(iframeEl.style, {width: `${width}px`, height: `${height}px`})
  }

  protected postMessage(cmd: string, ...args: any[]) {
    this.window?.postMessage({cmd, args}, '*')
  }

  protected unload() {
    super.unload()
    channel.detach(this)
    this._iframeRef = null
  }
}
