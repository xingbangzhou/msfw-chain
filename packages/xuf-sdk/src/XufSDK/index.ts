import {XufContextFuncs} from '@xuf/utils/types'
import XufExContext from '../ExContext'
import XufIFrameContext from '../ExContext/FrameContext'

export default class XufSDK {
  constructor() {}

  private _ctx?: XufContextFuncs
  private _ensurePromise: Promise<XufContextFuncs | null> | null = null
  private _ensureResolve?: (ctx: XufContextFuncs | null) => any

  async init(ctx?: XufContextFuncs) {
    if (this._ctx) {
      throw new Error('XufSDK has already been initialized.')
    }
    if (!ctx) {
      if (window.top === window) {
        throw new Error('XufSDK native module need ctx instance.')
      }
      // IFrame扩展
      await this.initEx(XufIFrameContext)
    } else {
      this._ctx = ctx
      this._ensureResolve?.(ctx)
      this._ensureResolve = undefined
    }

    return this._ctx
  }

  async initEx<T extends XufExContext>(className: {new (): T}) {
    const ctx = new className()
    await ctx.ensure()

    this._ctx = ctx
    this._ensureResolve?.(ctx)
    this._ensureResolve = undefined

    ctx.log('XufSDK', 'initEx!')

    return ctx
  }

  async ensure() {
    if (this._ctx) return this._ctx

    if (this._ensurePromise) {
      await this._ensurePromise
      return this._ctx
    }

    this._ensurePromise = new Promise<XufContextFuncs | null>(resolve => {
      this._ensureResolve = resolve
    })

    return this._ensurePromise
  }
}
