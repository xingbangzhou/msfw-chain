export interface ListenerFn {
  (...args: any[]): void
}

class EE {
  fn: ListenerFn
  context?: any
  once?: boolean
  constructor(fn: ListenerFn, context?: any, once?: boolean) {
    this.fn = fn
    this.context = context
    this.once = once
  }
}

export class ListenerHolder {
  emitter?: EventEmitter
  type?: string
  listener?: EE

  constructor(emitter: EventEmitter, type: string, listener: EE) {
    this.emitter = emitter
    this.type = type
    this.listener = listener
  }

  off() {
    this.type &&
      this.listener &&
      this.emitter?.off(this.type, this.listener.fn, this.listener.context, this.listener.once)
    this.emitter = undefined
    this.type = undefined
    this.listener = undefined
  }
}

export class EventObject<Type extends ListenerFn> {
  constructor(ctx: EventEmitter, name = '') {
    this._ctx = ctx
    this._name = name
  }

  private _ctx: EventEmitter
  private _name: string

  get name() {
    return this._name
  }

  on(fn: Type, context?: any, prepend = false) {
    return this._ctx?.on(this.name, fn, context, prepend)
  }

  off(fn: Type, context?: any, once?: boolean) {
    return this._ctx?.off(this.name, fn, context, once)
  }
}

export default class EventEmitter {
  private _events: Record<string, EE | EE[]> = {}
  private _eventCount = 0

  emit(type: string, ...args: any[]) {
    const listeners = this._events[type]
    if (!listeners) return false

    if (!Array.isArray(listeners)) {
      if (listeners.once) {
        this.off(type, listeners.fn, undefined, true)
      }
      listeners.fn.apply(listeners.context, args)
    } else {
      const length = listeners.length
      for (let i = 0; i < length; i++) {
        if (listeners[i].once) {
          this.off(type, listeners[i].fn, undefined, true)
        }
        listeners[i].fn.apply(listeners[i].context, args)
      }
    }

    return true
  }

  on(type: string, fn: ListenerFn, context?: any, prepend = false): ListenerHolder {
    const listener = this.addListener(type, fn, context, false, prepend)

    const holder = new ListenerHolder(this, type, listener)
    return holder
  }

  once(type: string, fn: ListenerFn, context?: any): ListenerHolder {
    const listener = this.addListener(type, fn, context, true)

    const holder = new ListenerHolder(this, type, listener)
    return holder
  }

  off = EventEmitter.prototype.removeListener

  eventNames() {
    const names: string[] = []
    if (this._eventCount === 0) return names
    for (const name in this._events) {
      if (Object.prototype.hasOwnProperty.call(this._events, name)) names.push(name)
    }
    return names
  }

  /**
   * 分发事件
   * @param event 事件对象
   * @param args 参数列表
   */
  emitEvent<Type extends ListenerFn>(event: EventObject<Type>, ...args: Parameters<Type>) {
    const eventName = event.name

    this.emit(eventName, ...args)
  }
  /**
   * 创建事件对象（分发1个参数）
   * @param name 事件名
   * @returns 事件对象
   */
  createEvent<P1>(name = '') {
    return new EventObject<(p1: P1) => void>(this, name)
  }
  /**
   * 创建事件对象（分发2个参数）
   * @param name 事件名
   * @returns 分发两个参数的信号对象
   */
  createEvent2<P1, P2>(name = '') {
    return new EventObject<(p1: P1, p2: P2) => void>(this, name)
  }
  /**
   * 创建事件对象（分发3个参数）
   * @param name 事件名
   * @returns 分发三个参数的信号对象
   */
  createEvent3<P1, P2, P3>(name = '') {
    return new EventObject<(p1: P1, p2: P2, p3: P3) => void>(this, name)
  }

  private addListener(type: string, fn: ListenerFn, context?: any, once?: boolean, prepend = false) {
    let listener = new EE(fn, context || this, once)
    const event = this._events[type]
    if (!event) {
      this._events[type] = listener
      this._eventCount++
    } else if (Array.isArray(event)) {
      const itr = event.find(
        el => el.fn === listener.fn && el.context === listener.context && (!el.once || listener.once),
      )
      if (itr) listener = itr
      else prepend ? event.unshift(listener) : event.push(listener)
    } else {
      if (event.fn !== listener.fn || event.context !== listener.context || (event.once && !listener.once)) {
        this._events[type] = prepend ? [listener, event] : [event, listener]
      } else listener = event
    }

    return listener
  }

  private removeListener(type: string, fn: ListenerFn, context?: any, once?: boolean) {
    const event = this._events[type]
    if (!event) return

    if (Array.isArray(event)) {
      const accus: EE[] = []
      for (let i = 0, length = event.length; i < length; i++) {
        if (event[i].fn !== fn || (once && !event[i].once) || (context && event[i].context !== context)) {
          accus.push(event[i])
        }
      }
      if (accus.length) this._events[type] = accus.length === 1 ? accus[0] : accus
      else this.clearEvent(type)
    } else if (event.fn === fn && (!once || event.once) && (!context || event.context === context)) {
      this.clearEvent(type)
    }
  }

  private clearEvent(type: string) {
    if (--this._eventCount === 0) this._events = {}
    else delete this._events[type]
  }
}
