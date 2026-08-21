import {WebGLRenderer} from './renderers/WebGLRenderer'
import {LkaKeyProps, LkaPlayProps, PlayerParameters} from './types'
import {PlayerState} from './PlayerState'
import {LkaRenderView} from './views/LkaRenderView'

class LkaPlayer {
  private container: HTMLElement
  private canvas: HTMLCanvasElement
  private renderer: WebGLRenderer
  private state: PlayerState
  private renderView: LkaRenderView

  private rafId = 0
  private playing = false
  private startTime = 0
  private loaded = false

  constructor(container: HTMLElement, parameters: PlayerParameters) {
    const canvas = document.createElement('canvas')
    canvas.style.cssText = `width:100%; height:100%;`
    container.appendChild(canvas)

    this.container = container
    this.canvas = canvas
    this.state = new PlayerState(parameters)
    this.renderer = new WebGLRenderer({canvas, alpha: true, premultipliedAlpha: true})
    this.renderView = new LkaRenderView(this.renderer, this.state)
  }

  async load(props: {
    file: ArrayBufferLike | string
    keys?: LkaKeyProps | LkaKeyProps[]
    mockJson?: LkaPlayProps
    isPreview?: boolean
  }) {
    const info = await this.renderView.load(props)
    this.loaded = !!info

    // 首次按容器尺寸初始化画布
    this.resizeCanvasToDisplaySize()

    if (this.loaded) {
      // 渲染首帧
      this.state.frameId = 0
      this.renderView.render()
      if (this.state.autoPlay) this.play()
    }

    return info
  }

  /** 仅用外部 JSON 初始化 */
  async loadJson(mockJson: LkaPlayProps) {
    const info = await this.renderView.loadJson(mockJson)
    this.loaded = !!info

    this.resizeCanvasToDisplaySize()

    if (this.loaded) {
      this.state.frameId = 0
      this.renderView.render()
      if (this.state.autoPlay) this.play()
    }

    return info
  }

  /** 动态替换关键字并重绘当前帧 */
  async setKeys(keys: LkaKeyProps | LkaKeyProps[]) {
    await this.renderView.setKeys(keys)
    if (this.loaded) this.renderView.render()
  }

  isReady() {
    return this.renderView.isReady()
  }

  play() {
    if (!this.loaded || this.playing) return
    this.playing = true
    // 依当前帧回推起始时间，支持从暂停处续播
    this.startTime = performance.now() - Math.max(0, this.state.frameId) * this.state.frameTimeMs
    this.rafId = requestAnimationFrame(this.tick)
  }

  replay() {
    this.pause()
    this.state.frameId = 0
    this.play()
  }

  pause() {
    this.playing = false
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }
  }

  seek(frameId: number) {
    if (!this.loaded) return
    this.state.frameId = Math.max(0, Math.min(frameId, this.state.frames - 1))
    this.renderView.render()
  }

  resizeCanvasToDisplaySize(width = 0, height = 0) {
    const w = width || this.container.clientWidth || this.canvas.clientWidth
    const h = height || this.container.clientHeight || this.canvas.clientHeight
    if (!w || !h) return

    const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    this.renderer.setPixelRatio(pixelRatio)
    this.renderer.setSize(w, h)
    this.renderView.onResize(this.canvas.width, this.canvas.height)

    if (this.loaded) this.renderView.render()
  }

  grap(x: number, y: number) {
    return this.renderView.grap(x, y)
  }

  dispose() {
    this.pause()
    this.renderView.dispose()
    this.renderer.dispose()
    if (this.canvas.parentNode === this.container) {
      this.container.removeChild(this.canvas)
    }
  }

  private tick = () => {
    if (!this.playing) return

    const elapsed = performance.now() - this.startTime
    let frameId = Math.floor(elapsed / this.state.frameTimeMs)

    const frames = this.state.frames
    if (frameId >= frames) {
      if (this.state.loop) {
        this.startTime = performance.now()
        frameId = 0
      } else {
        this.state.frameId = frames - 1
        this.renderView.render()
        this.pause()
        return
      }
    }

    this.state.frameId = frameId
    this.renderView.render()

    this.rafId = requestAnimationFrame(this.tick)
  }
}

export {LkaPlayer}
