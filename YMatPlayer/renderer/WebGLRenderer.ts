import {isInstanceOf, WebGLRendererContext} from '../utils/shims'
import {
  LayerProps,
  PlayerEventMap,
  PlayerParameters,
  PlayState,
  SvgaSwapItemInfo,
  TransformProps,
  YMatKeyProps,
  YMatPlayProps,
} from '../types'
import RenderStore from './common/RenderStore'
import {RenderContext} from './common/RenderContext'
import RenderImpl from './common/RenderImpl'
import RenderYMat from './common/RenderYMat'
import Renderer from './Renderer'
import RenderEva from './common/RenderEva'
import RenderSvga from './common/RenderSvga'
import {parseSvga} from './common/RenderSvga/parser'
import {EndMode} from './common/RenderYMat/types'

export default class WebGLRenderer implements Renderer {
  constructor(ctx: RenderContext, canvas: OffscreenCanvas | HTMLCanvasElement, parameter: PlayerParameters = {}) {
    this.ctx = ctx
    this.canvas = canvas
    this.store = new RenderStore(parameter, ctx)

    canvas.addEventListener('webglcontextlost', this.onContextLost, false)
    canvas.addEventListener('webglcontextrestored', this.onContextRestore, false)
    canvas.addEventListener('webglcontextcreationerror', this.onContextCreationError, false)
  }

  readonly ctx: RenderContext
  readonly canvas: OffscreenCanvas | HTMLCanvasElement
  readonly store: RenderStore

  private _gl?: WebGLRendererContext
  protected _isContextLost = false

  private _playState = PlayState.None
  private _renderImpl: RenderImpl | null = null
  private _frameAnimId: any | null = null

  private _delayDestroyTimer?: any

  on<E extends keyof PlayerEventMap>(event: E, cb?: PlayerEventMap[E]) {
    return this.ctx.on(event, cb)
  }

  isInvalid() {
    return this._playState === PlayState.Destroy || !!this._delayDestroyTimer
  }

  play() {
    if (this.isInvalid()) return

    if (this._playState !== PlayState.Play) {
      this.play0()
    }
  }

  replay() {
    if (this.isInvalid()) return

    this.replay0()
  }

  pause() {
    if (this.isInvalid()) return

    this.cancelFrameAnim()

    this._playState = PlayState.Pause
    this.ctx.emit('pause')
  }

  resizeCanvasToDisplaySize(width?: number, height?: number) {
    const canvas = this.canvas

    if (!width && (canvas as HTMLCanvasElement).clientWidth) {
      width = (canvas as HTMLCanvasElement).clientWidth
    }
    if (!height && (canvas as HTMLCanvasElement).clientHeight) {
      height = (canvas as HTMLCanvasElement).clientHeight
    }

    if (width) canvas.width = width
    if (height) canvas.height = height

    this.ctx.log('WebGLRenderer', 'resizeCanvasToDisplaySize: ', width, height)

    if (width && height) {
      this._renderImpl?.onResize(width, height)
    }
  }

  destroy() {
    if (this._playState === PlayState.Destroy) return

    this.clearAll()

    // 事件通知
    this.ctx.emit('destroy')
    this.ctx.destroy()
  }

  async load(props: {
    file: ArrayBufferLike | string
    keys?: YMatKeyProps | YMatKeyProps[]
    mockJson?: YMatPlayProps
    isPreview?: boolean
  }) {
    const gl = this.initContext()
    const invalid = this.isInvalid()
    if (invalid || !gl) {
      // 环境异常
      this.ctx.error('load', `check-error: isinvalid(${invalid}) or gl(${!!gl})!`)
      return
    }

    if (this._renderImpl && !(this._renderImpl as any).isRenderYMat) {
      this._renderImpl.destroy()
      this._renderImpl = null
    }

    this.resizeCanvasToDisplaySize()

    const renderImpl = (this._renderImpl || (this._renderImpl = new RenderYMat(this.store, gl))) as RenderYMat
    try {
      const result = await renderImpl.load(props)
      // 判断是否自动播放
      if (this._playState === PlayState.Play || this.store.playAfterLoad) {
        this.play0()
      }

      return result
    } catch (err) {
      this.ctx.error('load', 'catch-error: ', String(err), this._playState)

      if (this._playState === PlayState.Destroy) {
        this.clearAll()
      }
    }

    return undefined
  }

  async loadJson(mockJson: YMatPlayProps) {
    const gl = this.initContext()
    const invalid = this.isInvalid()
    if (invalid || !gl) {
      // 环境异常
      this.ctx.error('loadJson', `check-error: isinvalid(${invalid}) or gl(${!!gl})!`)
      return
    }

    if (!isInstanceOf(this._renderImpl, RenderYMat)) {
      this._renderImpl?.destroy()
      this._renderImpl = null
    }

    this.resizeCanvasToDisplaySize()

    const renderImpl = (this._renderImpl || (this._renderImpl = new RenderYMat(this.store, gl))) as RenderYMat
    try {
      const result = await renderImpl.loadJson(mockJson)
      // 判断是否自动播放
      if (this._playState === PlayState.Play || this.store.playAfterLoad) {
        this.play0()
      }

      return result
    } catch (err) {
      this.ctx.error('loadJson', 'catch-error: ', String(err))
    }

    return undefined
  }

  async loadEva(props: {
    file: string | Blob
    effects?: {[k: string]: any; fontColor?: string; fontSize?: number; fontStyle?: string}
  }) {
    if (!isInstanceOf(this._renderImpl, RenderEva)) {
      this._renderImpl?.destroy()
      this._renderImpl = null
    }

    const gl = this.initContext()
    const renderImpl = (this._renderImpl ||
      (this._renderImpl = new RenderEva(this.store, this.canvas, gl))) as RenderEva

    this.resizeCanvasToDisplaySize()

    try {
      const result = await renderImpl.load(props)
      // 判断是否自动播放
      if (this._playState === PlayState.Play || this.store.playAfterLoad) {
        this.play0()
      }

      return result
    } catch (err) {
      this.ctx.error('loadEva', 'catch-error: ', String(err))

      if (this._playState === PlayState.Destroy) {
        this.clearAll()
      }
    }

    return undefined
  }

  async loadSvga(props: {file: string | Blob; effects?: Record<string, SvgaSwapItemInfo[]>}) {
    if (!isInstanceOf(this._renderImpl, RenderSvga)) {
      this._renderImpl?.destroy()
      this._renderImpl = null
    }

    const playInfo = await parseSvga(props.file)
    if (!playInfo.withShape) {
      this.initContext()
    }

    const gl = this._gl
    const renderImpl = (this._renderImpl ||
      (this._renderImpl = new RenderSvga(this.store, this.canvas, gl))) as RenderSvga

    this.resizeCanvasToDisplaySize()

    try {
      const result = await renderImpl.load({playInfo, effects: props.effects})
      // 判断是否自动播放
      if (this._playState === PlayState.Play || this.store.playAfterLoad) {
        this.play0()
      }

      return result
    } catch (err) {
      this.ctx.error('loadSvga', 'catch-error: ', String(err))

      if (this._playState === PlayState.Destroy) {
        this.clearAll()
      }
    }

    return undefined
  }

  setKeys(keys: YMatKeyProps | YMatKeyProps[]) {
    this._renderImpl?.setKeys(keys)
  }

  insertItem(layerInfo: LayerProps) {
    if (isInstanceOf(this._renderImpl, RenderYMat)) {
      ;(<RenderYMat>this._renderImpl).insertItem(layerInfo)
    }
  }

  transformItem(transformInfo: TransformProps, itemId: number) {
    if (isInstanceOf(this._renderImpl, RenderYMat)) {
      ;(<RenderYMat>this._renderImpl).transformItem(transformInfo, itemId)
    }
  }

  async grap(x: number, y: number) {
    if (isInstanceOf(this._renderImpl, RenderYMat)) {
      return (<RenderYMat>this._renderImpl).grap(x, y)
    }

    return null
  }

  private play0(loop?: boolean) {
    this._playState = PlayState.Play

    if (!this._renderImpl?.isReady()) return

    if (!loop) {
      this.ctx.emit('play')
    }

    this.startRender()
  }

  private replay0(loop?: boolean) {
    this.cancelFrameAnim()
    this.store.frameId = -1

    this.play0(loop)
  }

  private startFrameAnim(fn: (...args: any) => void) {
    if (this._frameAnimId) return

    const {frameTime} = this.store

    this._frameAnimId = setInterval(fn, frameTime)
  }

  private cancelFrameAnim() {
    if (!this._frameAnimId) return
    clearInterval(this._frameAnimId)
    this._frameAnimId = null
  }

  // 渲染
  private startRender() {
    this.cancelFrameAnim()

    this.startFrameAnim(this.render)
    this.render()
  }

  private render = () => {
    const store = this.store
    const frames = store.frames
    const endMode = store.endMode

    let frameId = store.frameId
    frameId++

    if (frameId >= frames) {
      switch (endMode) {
        case EndMode.Normal: {
          this.cancelFrameAnim()
          this._playState = PlayState.End
          this.ctx.emit('end')
          if (store.destroyAfterEnd) {
            clearTimeout(this._delayDestroyTimer)
            this._delayDestroyTimer = setTimeout(() => {
              this._delayDestroyTimer = undefined
              this.destroy()
            }, 50)
          }
          return
        }
        case EndMode.Loop:
          frameId = 0
          // reset to 0
          this.checkReset()
          break
        default:
          break
      }
    }
    // 当前帧未同步，需等下一帧再检测
    if (!store.checkFrameSync(frameId)) {
      return
    }

    store.frameId = frameId
    this._renderImpl?.render()
    this.ctx.emit('frame', store.frameId)
  }

  // 上下文
  private initContext() {
    if (this._gl) return this._gl

    const canvas = this.canvas
    let gl = canvas.getContext('webgl2') as WebGLRendererContext | undefined
    if (gl) {
      gl.isWebGL2 = true
    } else {
      gl = canvas.getContext('webgl') as WebGLRendererContext | undefined
    }
    if (!gl || gl.isContextLost()) {
      this.ctx.error('WebGLRenderer', 'getContext, failed!', !!gl, gl?.isContextLost())
      this._gl = undefined
    } else {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
      this._gl = gl
    }

    return this._gl
  }

  private onContextLost = (event: Event) => {
    this.ctx.log('onContextLost')

    event.preventDefault()

    this._isContextLost = true
  }

  private onContextRestore = () => {
    this.ctx.log('onContextRestore')

    this._isContextLost = false
  }

  private onContextCreationError = (event: Event) => {
    this.ctx.error('onContextCreationError', (event as any).statusMessage)
  }

  private clearCanvas() {
    const canvas = this.canvas

    canvas.removeEventListener('webglcontextlost', this.onContextLost, false)
    canvas.removeEventListener('webglcontextrestored', this.onContextRestore, false)
    canvas.removeEventListener('webglcontextcreationerror', this.onContextCreationError, false)

    this._gl?.getExtension('WEBGL_lose_context')?.loseContext()
    this._gl = undefined
  }

  private clearAll() {
    if (this._delayDestroyTimer) {
      clearTimeout(this._delayDestroyTimer)
      this._delayDestroyTimer = undefined
    }

    this.cancelFrameAnim()

    this._renderImpl?.destroy()
    this._renderImpl = null

    this.clearCanvas()
    this.store.clear()
  }

  private checkReset() {
    this._renderImpl?.checkReset()
  }
}
