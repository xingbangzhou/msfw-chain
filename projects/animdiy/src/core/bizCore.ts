import {MsfwFrameworkLauncher} from '@msfw/framework'

class MsfwCore extends MsfwFrameworkLauncher {
  constructor() {
    super()
  }

  private _initialized = false
  private _initPromise: Promise<void> | null = null

  get fwCtx() {
    return this.framework.ctx
  }

  async init() {
    if (this._initialized) {
      throw new Error('MsfwCore: has already been initialized.')
    }
    if (this._initPromise !== null) {
      return this._initPromise
    }

    this._initPromise = new Promise(async (resolve, reject) => {
      try {
        // TODO: Add initialize codes.
        this._initialized = true
        resolve()
      } catch (error) {
        reject(error)
        return
      }
    })

    return this._initPromise
  }

  async ensure() {
    if (this._initialized) return

    await this.init()
  }
}

const msfwCore = new MsfwCore()

export default msfwCore
