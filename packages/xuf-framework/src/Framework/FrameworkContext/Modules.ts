import XufModule, {XufExModule} from '../../Module'
import XufFrameworkContext from '.'
import {XufDestructor} from '../../utils'
import XufModuleContext from '../../Module/ModuleContext'
import XufFrameModule from '../../Module/FrameModule'

class XufModuleHolder<T extends XufModule> {
  constructor(
    className: {new (ctx: XufModuleContext, destructor: XufDestructor, ...args: any[]): T},
    fwCtx: XufFrameworkContext,
    id: string,
    ...args: any[]
  ) {
    this._module = new className(new XufModuleContext(id, fwCtx, this._destructor), this._destructor, ...args)
  }

  private _module: XufModule
  private _invalid = false
  private _destructor = new XufDestructor()

  get module() {
    return this._module
  }

  unload() {
    if (this._invalid) return
    this._invalid = true
    this._destructor.destruct()
  }
}

export default class XufModules {
  constructor(fwCtx: XufFrameworkContext) {
    this.fwCtx = fwCtx
  }

  private fwCtx: XufFrameworkContext
  private holders: Record<string, XufModuleHolder<XufModule>> = {}

  getModule(id: string) {
    return this.holders[id]?.module
  }

  load(id: string) {
    if (!id) return
    return this.load0(XufModule, id)
  }

  loadEx<T extends XufExModule>(
    className: {new (ctx: XufModuleContext, destructor: XufDestructor, ...args: any[]): T},
    id: string,
    ...args: any[]
  ) {
    if (!id) return
    return this.load0(className, id, ...args)
  }

  loadFrame(id: string, iframeEl: HTMLIFrameElement) {
    if (!id) return
    return this.load0(XufFrameModule, id, iframeEl)
  }

  unload(id: string) {
    const holder = this.holders[id]
    if (!holder) return

    holder.unload()
    delete this.holders[id]
  }

  private load0<T extends XufModule>(
    className: {new (ctx: XufModuleContext, destructor: XufDestructor, ...args: any[]): T},
    id: string,
    ...args: any[]
  ) {
    let holder: XufModuleHolder<T> | undefined = undefined
    if (!this.holders[id]) {
      holder = new XufModuleHolder(className, this.fwCtx, id, ...args)
      this.holders[id] = holder
    }
    return holder?.module
  }
}
