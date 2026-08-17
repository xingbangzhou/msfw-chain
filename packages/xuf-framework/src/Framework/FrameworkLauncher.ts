import XufFrameworkContext from './FrameworkContext'
import {XufLauncherOption} from '../types'

export default class XufFrameworkLauncher {
  constructor(options?: XufLauncherOption) {
    this._fwCtx = new XufFrameworkContext(options)
  }

  private _fwCtx: XufFrameworkContext

  get framework() {
    return this._fwCtx.framework
  }
}
