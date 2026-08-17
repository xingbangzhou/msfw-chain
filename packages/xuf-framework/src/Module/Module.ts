import {XufDestructor} from '../utils'
import XufModuleContext from './ModuleContext'

export default class XufModule {
  constructor(ctx: XufModuleContext, destructor: XufDestructor) {
    this.ctx = ctx
    destructor.push(() => this.unload())
  }

  readonly ctx: XufModuleContext

  get id() {
    return this.ctx.moduleId
  }

  protected unload() {}
}
