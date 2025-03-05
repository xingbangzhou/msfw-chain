import MsfwModule, {MsfwExModule} from '../../Module'
import MsfwFrameworkContext from '.'
import {MsfwDestructor} from '../../utils'
import MsfwModuleContext from '../../Module/ModuleContext'
import MsfwFrameModule from '../../Module/FrameModule'

class MsfwModuleHolder<T extends MsfwModule> {
  constructor(
    className: {new (ctx: MsfwModuleContext, destructor: MsfwDestructor, ...args: any[]): T},
    fwCtx: MsfwFrameworkContext,
    id: string,
    ...args: any[]
  ) {
    this._module = new className(new MsfwModuleContext(id, fwCtx, this._destructor), this._destructor, ...args)
  }

  private _module: MsfwModule
  private _invalid = false
  private _destructor = new MsfwDestructor()

  get module() {
    return this._module
  }

  unload() {
    if (this._invalid) return
    this._invalid = true
    this._destructor.destruct()
  }
}

export default class MsfwModules {
  constructor(fwCtx: MsfwFrameworkContext) {
    this.fwCtx = fwCtx
  }

  private fwCtx: MsfwFrameworkContext
  private holders: Record<string, MsfwModuleHolder<MsfwModule>> = {}

  getModule(id: string) {
    return this.holders[id]?.module
  }

  load(id: string) {
    if (!id) return
    return this.load0(MsfwModule, id)
  }

  loadEx<T extends MsfwExModule>(
    className: {new (ctx: MsfwModuleContext, destructor: MsfwDestructor, ...args: any[]): T},
    id: string,
    ...args: any[]
  ) {
    if (!id) return
    return this.load0(className, id, ...args)
  }

  loadFrame(id: string, iframeEl: HTMLIFrameElement) {
    if (!id) return
    return this.load0(MsfwFrameModule, id, iframeEl)
  }

  unload(id: string) {
    const holder = this.holders[id]
    if (!holder) return

    holder.unload()
    delete this.holders[id]
  }

  private load0<T extends MsfwModule>(
    className: {new (ctx: MsfwModuleContext, destructor: MsfwDestructor, ...args: any[]): T},
    id: string,
    ...args: any[]
  ) {
    let holder: MsfwModuleHolder<T> | undefined = undefined
    if (!this.holders[id]) {
      holder = new MsfwModuleHolder(className, this.fwCtx, id, ...args)
      this.holders[id] = holder
    }
    return holder?.module
  }
}
