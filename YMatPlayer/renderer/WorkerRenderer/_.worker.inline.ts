import {PlayerEventMap} from 'src/components/YMatPlayer/types'
import {RenderContext} from '../common/RenderContext'
import WebGLRenderer from '../WebGLRenderer'
import {MessageParameterMap, WorkerParameterMap} from './types'

const mapRenderer: Record<number, WebGLRenderer> = {}

class WorkerContext extends RenderContext {
  constructor(id: number) {
    super()
    this.id = id
  }

  readonly id: number

  log(name: string, ...args: any[]) {
    postMainMessage(this.id, 'log', {name, args})
  }

  error(name: string, ...args: any[]) {
    postMainMessage(this.id, 'error', {name, args})
  }

  emit<E extends keyof PlayerEventMap>(event: E, ...args: Parameters<PlayerEventMap[E]>): void {
    super.emit(event, ...args)

    postMainMessage(this.id, 'emitEvent', {event, args})
  }

  playAudio(props: {id: string; buffer: ArrayBuffer}) {
    postMainMessage(this.id, 'playAudio', props, [props.buffer])
  }

  stopAudio(id: string) {
    postMainMessage(this.id, 'stopAudio', id)
  }

  destroy() {
    super.destroy()

    delete mapRenderer[this.id]
  }
}

const postMainMessage = <M extends keyof WorkerParameterMap>(
  id: number,
  message: M,
  params: WorkerParameterMap[M],
  transfer?: Transferable[],
) => {
  ;(self as any).postMessage({id, message, params}, transfer)
}

self.onmessage = async <F extends keyof MessageParameterMap>(
  event: MessageEvent<{fn: F; params: MessageParameterMap[F]}>,
) => {
  const eventData = event.data
  const {fn, params} = eventData

  switch (fn) {
    case 'create':
      {
        const {id, canvas, parameters} = params as MessageParameterMap['create']
        const workerContext = new WorkerContext(id)
        const renderer = new WebGLRenderer(workerContext, canvas, parameters)
        mapRenderer[id] = renderer
      }
      break
    case 'invoke':
      {
        const {id, fnName, args, resolveId} = params as MessageParameterMap['invoke']
        const renderer = mapRenderer[id] as any

        const data = await renderer?.[fnName]?.(...args)
        if (resolveId) {
          postMainMessage(id, 'invokeReturn', {resolveId, data})
        }
      }
      break
    case 'destroy':
      {
        const {id} = params as MessageParameterMap['destroy']

        const renderer = mapRenderer[id]
        if (renderer) {
          renderer.destroy()
        }
      }
      break
  }
}

export default self as any
