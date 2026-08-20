import {PlayerEventMap} from '../../types'

/**
 * @brief 渲染运行宿主，区分Worker还是Dom渲染线程
 */
export abstract class RenderContext {
  constructor() {}

  eventCbs?: Partial<Record<keyof PlayerEventMap, (...args: any) => void>>

  on<E extends keyof PlayerEventMap>(event: E, cb?: PlayerEventMap[E]) {
    const cbs = this.eventCbs || (this.eventCbs = {})
    cbs[event] = cb
    return cb
  }

  emit<E extends keyof PlayerEventMap>(event: E, ...args: Parameters<PlayerEventMap[E]>) {
    const cb = this.eventCbs?.[event]
    cb?.(...args)
  }

  log(name: string, ...args: any[]) {
    console.log(name, ...args)
  }

  error(name: string, ...args: any[]) {
    console.error(name, ...args)
  }

  abstract playAudio(props: {id: string; buffer: ArrayBuffer}): void

  abstract stopAudio(id: string): void

  destroy() {
    this.eventCbs = undefined
  }
}
