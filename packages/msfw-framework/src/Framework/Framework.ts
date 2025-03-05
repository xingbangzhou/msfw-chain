import MsfwModule, {MsfwExModule} from '../Module'
import MsfwFrameworkContext from './FrameworkContext'
import {MsfwDestructor} from '../utils'
import {MsfwModuleContext} from '../Module'

export default class MsfwFramework extends MsfwModule {
  constructor(fwCtx: MsfwFrameworkContext) {
    const destructor = new MsfwDestructor()
    super(new MsfwModuleContext('', fwCtx, destructor), destructor)

    this._fwCtx = fwCtx
  }

  private _fwCtx: MsfwFrameworkContext

  getModule(id: string) {
    const {_fwCtx} = this

    return _fwCtx.modules?.getModule(id)
  }

  loadModule(id: string) {
    this.ctx.logger.log('MsfwFramework', 'loadModule: ', id)
    const {_fwCtx} = this

    const moduleInst = _fwCtx.modules.load(id)

    return moduleInst
  }

  loadExModule<T extends MsfwExModule>(
    className: {new (ctx: MsfwModuleContext, destructor: MsfwDestructor, ...args: any[]): T},
    id: string,
    ...args: any[]
  ) {
    this.ctx.logger.log('MsfwFramework', 'loadExModule: ', id, ...args)
    const {_fwCtx} = this

    const moduleInst = _fwCtx.modules.loadEx(className, id, ...args)

    return moduleInst
  }

  loadFrameModule(id: string, iframeEl: HTMLIFrameElement) {
    this.ctx.logger.log('MsfwFramework', 'loadFrameModule: ', id)
    const {_fwCtx} = this

    const frameModule = _fwCtx.modules.loadFrame(id, iframeEl)

    return frameModule
  }

  unloadModule(id: string) {
    this.ctx.logger.log('MsfwFramework', 'unloadModule: ', id)
    const {_fwCtx} = this

    _fwCtx.modules.unload(id)
  }
}
