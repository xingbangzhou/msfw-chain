import XufContext from '.'

export default class XufFrameContext extends XufContext {
  constructor() {
    super()

    window.addEventListener('message', this.onMessage, false)

    this.imReady()
  }

  private static instance_?: XufFrameContext

  static instance() {
    if (!XufFrameContext.instance_) {
      XufFrameContext.instance_ = new XufFrameContext()
    }

    return XufFrameContext.instance_
  }

  protected postMessage(cmd: string, ...args: any[]) {
    window.top?.postMessage({cmd, args}, '*')
  }

  private onMessage = (ev: MessageEvent<any>) => {
    const {source, data} = ev
    if (source !== window.top) return

    try {
      const cmd = data.cmd
      const args = data.args
      if (Array.isArray(args)) {
        this.onCommand(cmd, ...args)
      }
    } catch (error) {
      console.error('XufFrameContext', 'onMessage, error: ', error)
    }
  }
}
