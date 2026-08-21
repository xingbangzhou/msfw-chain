export interface BaseEvent<TEventType extends string = string> {
  readonly type: TEventType
}

export interface Event<TEventData, TEventType extends string = string, TTarget = unknown> {
  readonly type: TEventType
  target: TTarget | null
  data: TEventData
}

export type EventListener<TEventData, TEventType extends string, TTarget = unknown> = (
  event: Event<TEventData, TEventType, TTarget>,
) => void

export class EventDispatcher<TEventMap extends object = NonNullable<null>> {
  private _listeners?: Record<string, EventListener<any, any, this>[]>

  addEventListener<T extends Extract<keyof TEventMap, string>>(
    type: T,
    listener: EventListener<TEventMap[T], T, this>,
  ) {
    if (this._listeners === undefined) this._listeners = {}

    const listeners = this._listeners

    if (listeners[type] === undefined) {
      listeners[type] = []
    }

    if (listeners[type].indexOf(listener) === -1) {
      listeners[type].push(listener)
    }
  }

  hasEventListener<T extends Extract<keyof TEventMap, string>>(
    type: T,
    listener: EventListener<TEventMap[T], T, this>,
  ) {
    if (this._listeners === undefined) return false

    const listeners = this._listeners

    return listeners[type] !== undefined && listeners[type].indexOf(listener) !== -1
  }

  removeEventListener<T extends Extract<keyof TEventMap, string>>(
    type: T,
    listener: EventListener<TEventMap[T], T, this>,
  ) {
    if (this._listeners === undefined) return

    const listeners = this._listeners
    const listenerArray = listeners[type]

    if (listenerArray !== undefined) {
      const index = listenerArray.indexOf(listener)

      if (index !== -1) {
        listenerArray.splice(index, 1)
      }
    }
  }

  dispatchEvent<T extends Extract<keyof TEventMap, string>>(type: T, data: TEventMap[T]) {
    if (this._listeners === undefined) return

    const listeners = this._listeners
    const listenerArray = listeners[type]

    if (listenerArray !== undefined) {
      const event: Event<TEventMap[T], T, this> = {
        type: type,
        target: this,
        data: data,
      }

      const array = listenerArray.slice(0)
      for (let i = 0, l = array.length; i < l; i++) {
        array[i].call(this, event)
      }

      event.target = null
    }
  }
}
