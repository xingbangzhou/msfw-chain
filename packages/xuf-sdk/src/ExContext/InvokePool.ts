interface ResolveFn {
  (result: any): void
}

interface RejectFn {
  (reason: any): void
}

interface BlockPromProps {
  resolve: ResolveFn
  reject: RejectFn
  time: number
  args: any[]
}

export default class InvokePool {
  constructor(overMs = 5000) {
    this.overMs = overMs
    this.lastTime = new Date().getTime()
    this.lastIdx = 0
  }

  private overMs: number
  private overTimerId?: number
  private lastTime: number
  private lastIdx: number
  private mapBlockProms?: Record<string, BlockPromProps>

  invoke(...args: any[]) {
    const id = this.getInvokeId()
    const result = new Promise<any>((resolve, reject) => {
      if (!this.mapBlockProms) this.mapBlockProms = {}
      this.mapBlockProms[id] = {resolve, reject, time: new Date().getTime(), args}
      if (!this.overTimerId) {
        this.overTimerId = window.setInterval(this.onIntervalCheck, this.overMs)
      }
    })

    return {id, result}
  }

  resolve(id: string, result: any) {
    const exec = this.mapBlockProms?.[id]
    if (!exec) return

    exec.resolve(result)
    delete this.mapBlockProms?.[id]
  }

  private getInvokeId() {
    const curTime = new Date().getTime()
    if (curTime !== this.lastTime) {
      this.lastTime = curTime
      this.lastIdx = 0
    } else {
      this.lastIdx++
    }
    return `${this.lastTime}#${this.lastIdx}`
  }

  private onIntervalCheck = () => {
    const curTime = new Date().getTime()
    let count = 0
    for (const id in this.mapBlockProms) {
      count++
      const exec = this.mapBlockProms[id]
      if (curTime - exec.time < this.overMs) continue
      exec.reject({id: id, message: 'Invoke overtime!', args: exec.args})
      delete this.mapBlockProms[id]
      count--
    }
    if (!count) {
      window.clearInterval(this.overTimerId)
      this.overTimerId = undefined
    }
  }
}
