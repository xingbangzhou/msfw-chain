import XufModule, {XufExModule} from '../Module'
import XufFrameworkContext from './FrameworkContext'
import {XufDestructor} from '../utils'
import {XufModuleContext} from '../Module'

export default class XufFramework extends XufModule {
  constructor(fwCtx: XufFrameworkContext) {
    const destructor = new XufDestructor()
    super(new XufModuleContext('', fwCtx, destructor), destructor)

    this._fwCtx = fwCtx
  }

  private _fwCtx: XufFrameworkContext

  getModule(id: string) {
    const {_fwCtx} = this

    return _fwCtx.modules?.getModule(id)
  }

  loadModule(id: string) {
    this.ctx.logger.log('XufFramework', 'loadModule: ', id)
    const {_fwCtx} = this

    const moduleInst = _fwCtx.modules.load(id)

    return moduleInst
  }

  loadExModule<T extends XufExModule>(
    className: {new (ctx: XufModuleContext, destructor: XufDestructor, ...args: any[]): T},
    id: string,
    ...args: any[]
  ) {
    this.ctx.logger.log('XufFramework', 'loadExModule: ', id, ...args)
    const {_fwCtx} = this

    const moduleInst = _fwCtx.modules.loadEx(className, id, ...args)

    return moduleInst
  }

  loadFrameModule(id: string, iframeEl: HTMLIFrameElement) {
    this.ctx.logger.log('XufFramework', 'loadFrameModule: ', id)
    const {_fwCtx} = this

    const frameModule = _fwCtx.modules.loadFrame(id, iframeEl)

    return frameModule
  }

  unloadModule(id: string) {
    this.ctx.logger.log('XufFramework', 'unloadModule: ', id)
    const {_fwCtx} = this

    _fwCtx.modules.unload(id)
  }
}
