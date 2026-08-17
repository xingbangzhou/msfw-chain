import {XufLauncherOption} from '../../types'
import XufFramework from '../Framework'
import XufEvents from './Events'
import XufModules from './Modules'
import XufServices from './Services'

export default class XufFrameworkContext {
  constructor(options?: XufLauncherOption) {
    this.options = options

    this.events = new XufEvents()
    this.modules = new XufModules(this)
    this.services = new XufServices(this)
    this.framework = new XufFramework(this)

    this.init()
  }

  readonly options?: XufLauncherOption

  readonly events: XufEvents

  readonly modules: XufModules

  readonly services: XufServices

  readonly framework: XufFramework

  get logger() {
    return this.framework.ctx.logger
  }

  private init() {
    this.logger.debug = this.options?.debug || false
  }
}
