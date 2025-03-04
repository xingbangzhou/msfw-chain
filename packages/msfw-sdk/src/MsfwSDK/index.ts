import {MsfwContextFuncs} from '@msfw/utils/types'
import MsfwExContext from '../ExContext'
import MsfwIFrameContext from '../ExContext/FrameContext'

export default class MsfwSDK {
  constructor() {}

  private _ctx?: MsfwContextFuncs
  private _ensurePromise: Promise<MsfwContextFuncs | null> | null = null
  private _ensureResolve?: (ctx: MsfwContextFuncs | null) => any

  async init(ctx?: MsfwContextFuncs) {
    if (this._ctx) {
      throw new Error('MsfwSDK has already been initialized.')
    }
    if (!ctx) {
      if (window.top === window) {
        throw new Error('MsfwSDK native module need ctx instance.')
      }
      // IFrame扩展
      await this.initEx(MsfwIFrameContext)
    } else {
      this._ctx = ctx
      this._ensureResolve?.(ctx)
      this._ensureResolve = undefined
    }

    return this._ctx
  }

  async initEx<T extends MsfwExContext>(className: {new (): T}) {
    const ctx = new className()
    await ctx.ensure()

    this._ctx = ctx
    this._ensureResolve?.(ctx)
    this._ensureResolve = undefined

    ctx.log('MsfwSDK', 'initEx!')

    return ctx
  }

  async ensure() {
    if (this._ctx) return this._ctx

    if (this._ensurePromise) {
      await this._ensurePromise
      return this._ctx
    }

    this._ensurePromise = new Promise<MsfwContextFuncs | null>(resolve => {
      this._ensureResolve = resolve
    })

    return this._ensurePromise
  }
}
