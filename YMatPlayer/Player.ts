import AudioPlayer from './core/audio/AudioPlayer'
import {RenderContext} from './renderer/common/RenderContext'
import Renderer from './renderer/Renderer'
import WebGLRenderer from './renderer/WebGLRenderer'
import WorkerRenderer from './renderer/WorkerRenderer'
import {
  YMatKeyProps,
  PlayerParameters,
  YMatPlayProps,
  PlayerEventMap,
  TransformProps,
  LayerProps,
  SvgaSwapItemInfo,
} from './types'
import {IPHONE} from './utils/ua'

class PlayerContext extends RenderContext {
  constructor(canvas: HTMLCanvasElement, onDestory: () => void) {
    super()
    this.canvas = canvas
    this.onDestory = onDestory
  }

  canvas: HTMLCanvasElement | null = null
  audioPlayers: Record<string, AudioPlayer> | null = null
  private onDestory?: () => void

  log(name: string, ...args: any[]) {
    if (YMatPlayer.log) {
      YMatPlayer.log(name, ...args)
      return
    }
    console.log(name, ...args)
  }

  error(name: string, ...args: any[]) {
    if (YMatPlayer.error) {
      YMatPlayer.error(name, ...args)
      return
    }
    console.error(name, ...args)
  }

  playAudio(props: {id: string; buffer: ArrayBuffer}) {
    if (this.audioPlayers?.[props.id]) return

    const audioPlayers = this.audioPlayers || (this.audioPlayers = {})

    const player = new AudioPlayer()
    audioPlayers[props.id] = player

    player.load(props.buffer).then(success => {
      if (success) player.play()
    })
  }

  stopAudio(id: string) {
    const audioPlayer = this.audioPlayers?.[id]
    delete this.audioPlayers?.[id]

    if (audioPlayer) {
      audioPlayer.destory()
    }
  }

  destroy() {
    super.destroy()

    this.onDestory?.()
    this.onDestory = undefined

    // 释放Canvas
    const canvas = this.canvas
    this.canvas = null
    if (canvas) {
      canvas.hidden = true
      canvas.parentNode?.removeChild(canvas)
    }

    // 释放audios
    const audioPlayers = this.audioPlayers
    this.audioPlayers = null
    if (audioPlayers) {
      Object.values(audioPlayers).forEach(el => el.destory())
    }
  }
}

export default class YMatPlayer {
  static log: ((name: string, ...args: any[]) => void) | null = null
  static error: ((name: string, ...args: any[]) => void) | null = null

  constructor(container: HTMLDivElement, parameters: PlayerParameters = {}) {
    const canvas = document.createElement('canvas')
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    container.appendChild(canvas)

    const ctx = (this.ctx = new PlayerContext(canvas, this.onDestroy))

    const hasVideoDecoder = 'VideoDecoder' in self
    const noVideoDecoder = IPHONE || !hasVideoDecoder
    const noTransferOffscreen = !canvas?.transferControlToOffscreen
    const noOffscreen = !('OffscreenCanvas' in self)
    const noCreateBitmap = !('createImageBitmap' in self)

    if (!parameters.disableDecoder) {
      parameters.disableDecoder = noVideoDecoder
    }
    if (!parameters.disableWorker) {
      parameters.disableWorker = parameters.disableDecoder || noTransferOffscreen || noOffscreen || noCreateBitmap
    }

    if (parameters.disableWorker) {
      this.renderer = new WebGLRenderer(ctx, canvas, parameters)
      ctx.error(
        'YMatPlayer',
        `Run not with Worker: hasVideoDecoder; ${hasVideoDecoder}, noTransferOffscreen: ${noTransferOffscreen}, noOffscreen: ${noOffscreen}, noCreateBitmap: ${noCreateBitmap}`,
        location.href,
      )
    } else {
      this.renderer = new WorkerRenderer(ctx, canvas, parameters)
    }
  }

  private ctx: PlayerContext
  private renderer: Renderer
  private clickCb?: PlayerEventMap['click']
  private clickListend = false

  on<E extends keyof PlayerEventMap>(event: E, cb?: PlayerEventMap[E]) {
    if (event === 'click') {
      this.clickCb = <PlayerEventMap['click']>cb
      if (cb) {
        if (!this.clickListend) {
          this.ctx.canvas?.addEventListener('click', this.onMouseClicked)
        }
      } else {
        this.ctx.canvas?.removeEventListener('click', this.onMouseClicked)
        this.clickListend = false
      }
      return cb
    }

    return this.renderer.on(event, cb)
  }

  // 加载ymat文件
  async load(props: {
    file: ArrayBufferLike | string
    keys?: YMatKeyProps | YMatKeyProps[]
    mockJson?: YMatPlayProps
    isPreview?: boolean
  }) {
    return this.renderer.load(props)
  }

  /**
   * 通过纯json启动ymat播放器，不需要加载.ymat文件
   * @param mockJson 就是配置的json
   */
  async loadJson(mockJson: YMatPlayProps) {
    return this.renderer.loadJson(mockJson)
  }

  // 加载Eva(透明通道的mp4文件)
  async loadEva(props: {
    file: string | Blob
    effects?: {
      [k: string]: any
      fontColor?: string
      fontSize?: number
      fontStyle?: string
    }
  }) {
    return this.renderer.loadEva(props)
  }

  // 加载Svga
  async loadSvga(props: {file: string | Blob; effects?: Record<string, SvgaSwapItemInfo[]>}) {
    return this.renderer.loadSvga(props)
  }

  /**
   * 设置特效key
   * @param keys<object> {key: key的名称, type: 'image' | 'video' | 'text', value: 远程url}
   */
  setKeys(keys: YMatKeyProps | YMatKeyProps[]) {
    this.renderer.setKeys(keys)
  }

  play() {
    this.renderer.play()
  }

  replay() {
    this.renderer.replay()
  }

  pause() {
    this.renderer.pause()
  }

  resizeCanvasToDisplaySize() {
    this.renderer.resizeCanvasToDisplaySize()
  }

  destroy() {
    this.renderer.destroy()
  }

  /** */

  /**
   * 动态插入元素
   * @param layerInfo 就是配置的json里面的tagetComponent
   */
  insertItem(layerInfo: LayerProps) {
    this.renderer.insertItem(layerInfo)
  }

  /**
   * 修改元素位移、旋转、透明度
   * @param transformInfo 就是动画配置，可增量覆盖、新增，但是不能删除
   * @param itemId 需要动态修改的图层的id
   */
  transformItem(transformInfo: TransformProps, itemId: number) {
    this.renderer.transformItem(transformInfo, itemId)
  }

  // 抓取图层
  async grap(x: number, y: number) {
    const canvas = this.ctx.canvas
    if (!canvas) return null

    const pixelX = (x * canvas.width) / canvas.clientWidth
    const pixelY = canvas.height - ((y * canvas.height) / canvas.clientHeight - 1)

    const result = await this.renderer.grap(pixelX, pixelY)
    return result
  }

  private onMouseClicked = (ev: MouseEvent) => {
    const canvas = this.ctx.canvas
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = ev.clientX - rect.left
    const y = ev.clientY - rect.top

    this.grap(x, y).then(item => {
      this.clickCb?.(item)
    })
  }

  private onDestroy = () => {
    this.clickCb = undefined
    this.clickListend = false
  }
}
