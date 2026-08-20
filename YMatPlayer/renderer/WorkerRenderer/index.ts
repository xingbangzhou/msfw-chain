import {
  LayerProps,
  LayerType,
  PlayerEventMap,
  PlayerParameters,
  PlayInfo,
  PlayState,
  SvgaSwapItemInfo,
  TransformProps,
  YMatKeyInfo,
  YMatKeyProps,
  YMatPlayProps,
} from '../../types'
import {RenderContext} from '../common/RenderContext'
import Renderer from '../Renderer'
import _Worker from './_.worker.inline'
import {MessageParameterMap, WorkerParameterMap} from './types'

export default class WorkerRenderer implements Renderer {
  constructor(ctx: RenderContext, canvas: HTMLCanvasElement, parameters: PlayerParameters = {}) {
    this.ctx = ctx
    this.canvas = canvas
    this.parameters = parameters

    const id = createRendererId()
    this.id = id
    _mapRenderer[this.id] = this

    const offscreenCanvas = canvas.transferControlToOffscreen()

    postMessage('create', {id, canvas: offscreenCanvas, parameters}, [offscreenCanvas] as any[])
  }

  readonly id: number
  readonly ctx: RenderContext
  readonly parameters: PlayerParameters

  public canvas: HTMLCanvasElement | null = null

  private _playState = PlayState.None

  private _resolveFns?: Record<number, {resolve: any; reject: any}> = undefined
  private _resolveId = 0

  on<E extends keyof PlayerEventMap>(event: E, cb?: PlayerEventMap[E]) {
    return this.ctx.on(event, cb)
  }

  isInvalid() {
    return this._playState === PlayState.Destroy
  }

  async load(props: {
    file: ArrayBufferLike | string
    keys?: YMatKeyProps | YMatKeyProps[]
    mockJson?: YMatPlayProps
    isPreview?: boolean
  }) {
    if (this.isInvalid()) return

    this.resizeCanvasToDisplaySize()

    return this.asyncInvoke('load', props) as Promise<
      | {
          keys: YMatKeyInfo[] | undefined
          info: PlayInfo
          previewProps?: YMatPlayProps | undefined
        }
      | undefined
    >
  }

  async loadJson(mockJson: YMatPlayProps) {
    if (this.isInvalid()) return

    this.resizeCanvasToDisplaySize()

    return this.asyncInvoke('loadJson', mockJson) as Promise<
      | {
          keys: YMatKeyInfo[] | undefined
          info: PlayInfo
        }
      | undefined
    >
  }

  async loadEva(props: {
    file: string | Blob
    effects?: {[k: string]: any; fontColor?: string; fontSize?: number; fontStyle?: string}
  }): Promise<{keys: YMatKeyInfo[] | undefined; info: PlayInfo} | undefined> {
    if (this.isInvalid()) return

    this.resizeCanvasToDisplaySize()

    return this.asyncInvoke('loadEva', props) as Promise<
      | {
          keys: YMatKeyInfo[] | undefined
          info: PlayInfo
        }
      | undefined
    >
  }

  async loadSvga(props: {file: string | Blob; effects?: Record<string, SvgaSwapItemInfo[]>}) {
    if (this.isInvalid()) return

    this.resizeCanvasToDisplaySize()

    return this.asyncInvoke('loadSvga', props) as Promise<
      | {
          keys: YMatKeyInfo[] | undefined
          info: PlayInfo
        }
      | undefined
    >
  }

  play() {
    if (this.isInvalid()) return

    this.invoke('play')
  }

  replay() {
    if (this.isInvalid()) return

    this.invoke('replay')
  }

  pause() {
    if (this.isInvalid()) return

    this.invoke('pause')
  }

  resizeCanvasToDisplaySize() {
    const canvas = this.canvas
    if (!canvas) return

    const width = canvas.clientWidth
    const height = canvas.clientHeight

    this.invoke('resizeCanvasToDisplaySize', width, height)
  }

  destroy() {
    if (this.isInvalid()) return

    this.invoke('destroy')

    this.handleDestroy()
  }

  setKeys(keys: YMatKeyProps | YMatKeyProps[]) {
    if (this.isInvalid()) return

    this.invoke('setKeys', keys)
  }

  insertItem(layerInfo: LayerProps) {
    if (this.isInvalid()) return

    this.invoke('insertItem', layerInfo)
  }

  transformItem(transformInfo: TransformProps, itemId: number) {
    if (this.isInvalid()) return

    this.invoke('transformItem', transformInfo, itemId)
  }

  async grap(x: number, y: number) {
    return this.asyncInvoke('grap', x, y) as Promise<{id: number; name: string; type: LayerType} | null>
  }

  private handleDestroy() {
    if (this.isInvalid()) return

    this._playState = PlayState.Destroy
    this.canvas = null

    // 清理索引
    delete _mapRenderer[this.id]
    const resolveFns = this._resolveFns
    this._resolveFns = undefined

    this.ctx.emit('destroy')
    this.ctx.destroy()

    if (resolveFns) {
      Object.values(resolveFns).forEach(({resolve, reject}) => {
        resolve(undefined)
      })
    }
  }

  protected invoke<Fn extends keyof Renderer>(fnName: Fn, ...args: Parameters<Renderer[Fn]>) {
    postMessage('invoke', {id: this.id, fnName, args})
  }

  protected async asyncInvoke<Fn extends keyof Renderer>(fnName: Fn, ...args: Parameters<Renderer[Fn]>) {
    const resolveId = this.createResolveId()
    postMessage('invoke', {id: this.id, fnName, args, resolveId})

    return new Promise<any>((resolve, reject) => {
      this._resolveFns = this._resolveFns || {}
      this._resolveFns[resolveId] = {resolve, reject}
    })
  }

  onLog({name, args}: WorkerParameterMap['log']) {
    this.ctx.log(name, ...args)
  }

  onError({name, args}: WorkerParameterMap['error']) {
    this.ctx.error(name, ...args)
  }

  onInvokeReturn({resolveId, data}: WorkerParameterMap['invokeReturn']) {
    if (!this._resolveFns) return
    const resovleFn = this._resolveFns[resolveId]?.resolve
    if (resovleFn) {
      resovleFn(data)
      delete this._resolveFns[resolveId]
    }
  }

  onEmitEvent({event, args}: WorkerParameterMap['emitEvent']) {
    switch (event) {
      case 'play':
        this._playState = PlayState.Play
        this.ctx.emit('play')
        break
      case 'frame':
        this.ctx.emit('frame', args[0])
        break
      case 'pause':
        this._playState = PlayState.Pause
        this.ctx.emit('pause')
        break
      case 'end':
        this._playState = PlayState.End
        this.ctx.emit('end')
        break
      case 'destroy':
        {
          this.handleDestroy()
        }
        break
    }
  }

  onPlayAudio(props: WorkerParameterMap['playAudio']) {
    this.ctx.playAudio(props)
  }

  onStopAudio(props: WorkerParameterMap['stopAudio']) {
    this.ctx.stopAudio(props)
  }

  createResolveId() {
    this._resolveId++
    if (this._resolveId >= 2100000000) {
      this._resolveId = 1
    }
    return this._resolveId
  }
}

// 全局定义
const _mapRenderer: Record<number, WorkerRenderer> = {}

let _rendererId = 0
function createRendererId() {
  _rendererId++
  if (_rendererId >= 21000000) {
    _rendererId = 1
  }

  return _rendererId
}

// 工作线程
let _worker: Worker | null = null
function worker() {
  if (_worker) return _worker

  _worker = new _Worker() as Worker
  _worker.onmessage = onWorkerMessage

  return _worker
}

function postMessage<F extends keyof MessageParameterMap>(
  fn: F,
  params: MessageParameterMap[F],
  transfer?: Transferable[],
) {
  worker().postMessage({fn, params}, transfer)
}

function onWorkerMessage<M extends keyof WorkerParameterMap>(
  event: MessageEvent<{id: number; message: M; params: unknown}>,
) {
  const {id, message, params} = event.data
  const renderer = _mapRenderer[id]
  if (!renderer) return

  switch (message) {
    case 'log':
      renderer.onLog(params as WorkerParameterMap['log'])
      break
    case 'error':
      renderer.onError(params as WorkerParameterMap['error'])
      break
    case 'invokeReturn':
      renderer.onInvokeReturn(params as WorkerParameterMap['invokeReturn'])
      break
    case 'emitEvent':
      renderer.onEmitEvent(params as WorkerParameterMap['emitEvent'])
      break
    case 'playAudio':
      renderer.onPlayAudio(params as WorkerParameterMap['playAudio'])
      break
    case 'stopAudio':
      renderer.onStopAudio(params as WorkerParameterMap['stopAudio'])
      break
  }
}
