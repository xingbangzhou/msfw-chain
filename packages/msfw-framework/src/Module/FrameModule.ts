import MsfwModuleContext from './ModuleContext'
import {MsfwDestructor} from '../utils'
import MsfwExModule from './ExModule'

class MsfwFrameChannel {
  constructor() {
    window.addEventListener('message', this.onMessage)
  }

  private _modules?: MsfwFrameModule[]

  attach(frameModule: MsfwFrameModule) {
    if (!this._modules) this._modules = [frameModule]
    else if (!this._modules.includes(frameModule)) {
      this._modules.push(frameModule)
    }
  }

  detach(frameModule: MsfwFrameModule) {
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
      frameModule.ctx.logger.error('MsfwFrameChannel', 'onMesssage, error: ', error)
    }
  }
}

const channel = new MsfwFrameChannel()

export default class MsfwFrameModule extends MsfwExModule {
  constructor(ctx: MsfwModuleContext, destructor: MsfwDestructor, container: HTMLIFrameElement) {
    super(ctx, destructor)

    this._container = container
    channel.attach(this)

    this.imReady()
  }

  private _container?: HTMLIFrameElement

  get window() {
    return this._container?.contentWindow
  }

  resize(width: number, height: number) {
    this._container && Object.assign(this._container.style, {width: `${width}px`, height: `${height}px`})
  }

  protected postMessage(cmd: string, ...args: any[]) {
    this.window?.postMessage({cmd, args}, '*')
  }

  protected unload() {
    super.unload()
    channel.detach(this)
    this._container = undefined
  }
}
