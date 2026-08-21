import {RenderTarget} from '../core/RenderTarget'
import {LayerView} from '../layers/LayerView'
import {Matrix4} from '../math/Matrix4'
import {PlayerState} from '../PlayerState'
import {renderLayerQuad} from '../renderers/renderLayer'
import {WebGLRenderer} from '../renderers/WebGLRenderer'
import {FillMode, LkaKeyProps, LkaPlayProps, PlayInfo} from '../types'
import {parseLka} from './parseLka'

interface FillCoord {
  lx: number
  ly: number
  rx: number
  ry: number
  sw: number
  sh: number
}

// 计算内容(srcw×srch)在画布(dstw×dsth)中的适配坐标（顶点缩放 sw/sh + 纹理裁剪 lx..ry）
function getFillCoord(srcw: number, srch: number, dstw: number, dsth: number, fillMode: FillMode): FillCoord {
  let lx = 0
  let ly = 0
  let rx = 1.0
  let ry = 1.0
  let sw = 1.0
  let sh = 1.0

  if (!srcw || !srch || !dstw || !dsth) return {lx, ly, rx, ry, sw, sh}

  const srcWhr = srcw / srch
  const dstWhr = dstw / dsth

  if (fillMode === FillMode.ShortSide) {
    // 短边对齐：纹理裁剪（cover）
    const isLead = dstWhr < srcWhr
    const tw = isLead ? dsth * srcWhr : dstw
    const th = isLead ? dsth : dstw / srcWhr
    lx = (dstw - tw) * 0.5
    ly = (dsth - th) * 0.5
    lx = -lx / srcw
    ly = -ly / th
    rx = rx - lx
    ry = ry - ly
  } else if (fillMode === FillMode.Fill) {
    // 拉伸填充：保持默认
  } else {
    // 长边对齐：顶点缩放（contain）
    const isLead = dstWhr < srcWhr
    const tw = isLead ? dstw : dsth * srcWhr
    const th = isLead ? dstw / srcWhr : dsth
    sw = tw / dstw
    sh = th / dsth
  }

  return {lx, ly, rx, ry, sw, sh}
}

const IDENTITY = new Matrix4()

export class LkaRenderView extends LayerView {
  constructor(renderer: WebGLRenderer, state: PlayerState) {
    super(renderer, state)
  }

  private renderTarget: RenderTarget | null = null
  // 上屏合成的顶点/纹理坐标（依画布尺寸与 fillMode 计算）
  private screenPositions: number[] = []
  private screenTexcoords: number[] = []

  // 是否已就绪（有图层且尺寸有效）
  private _ready = false

  isReady() {
    return this._ready
  }

  async load(props: {
    file: ArrayBufferLike | string
    keys?: LkaKeyProps | LkaKeyProps[]
    mockJson?: LkaPlayProps
    isPreview?: boolean
  }) {
    const playState = this.state
    playState.clear()
    this._ready = false

    let playProps: LkaPlayProps | null = null
    let sourceMap: Record<number, Blob> = {}

    // mockJson 优先：直接使用外部传入的动画描述，仍尝试解析文件以取内嵌资源
    try {
      const info = await this.loadLKA(props.file)
      sourceMap = info.sourceMap
      playProps = props.mockJson ?? info.playProps
    } catch (err: any) {
      if (props.mockJson) {
        playProps = props.mockJson
      } else {
        console.error(err?.message ?? err)
        return null
      }
    }
    if (!playProps) return null

    if (props.keys) playState.setKeys(props.keys)

    await this.setupView(playProps, sourceMap)

    return {
      keys: playState.getAllKeyInfo(),
      info: this.buildPlayInfo(),
      ...(props.isPreview ? {previewProps: playState.playProps as LkaPlayProps} : undefined),
    }
  }

  /** 仅用外部 JSON 初始化（无内嵌资源，图片/视频等靠 content URL 或 keys 替换） */
  async loadJson(mockJson: LkaPlayProps) {
    const playState = this.state
    playState.clear()
    this._ready = false

    await this.setupView(mockJson, {})

    return {
      keys: playState.getAllKeyInfo(),
      info: this.buildPlayInfo(),
    }
  }

  /** 外部动态替换关键字，并重建受影响图层 */
  async setKeys(keys: LkaKeyProps | LkaKeyProps[]) {
    this.state.setKeys(keys)

    const childLayers = this.childLayers
    if (childLayers) {
      await Promise.all(childLayers.map(layer => layer.reset()))
    }
  }

  /** 帧同步检查预留（异步资源就绪后触发重绘等） */
  checkReset() {
    // 目前图层惰性加载，无需显式重置；保留与 RenderYMat 一致的接口
  }

  /** 点击拾取预留：需将绘制管线切换到 lkaShader 的 grapMode 后落地 */
  grap(_x: number, _y: number): {id: number; name: string; type: string} | null {
    return null
  }

  private buildPlayInfo(): PlayInfo {
    const s = this.state
    return {
      width: s.width,
      height: s.height,
      frames: s.frames,
      duration: s.duration,
      frameRate: s.frameRate,
    }
  }

  private async setupView(playProps: LkaPlayProps, sourceMap: Record<number, Blob>) {
    const playState = this.state
    playState.setLkaProps(playProps, sourceMap)

    // 建立像素空间→裁剪空间的相机
    this.setViewSize(playProps.width, playProps.height)
    // 离屏渲染目标按动画尺寸分配
    this.renderTarget?.dispose()
    this.renderTarget = new RenderTarget(playProps.width || 1, playProps.height || 1)
    // 依当前画布尺寸计算上屏坐标
    this.onResize(this.renderer.canvas.width, this.renderer.canvas.height)

    const rootLayers = playProps.targetComp?.layers
    if (!rootLayers) {
      console.error('props.targetComp.layers is null!')
      return
    }

    await this.initLayers(rootLayers, 0, playState.frames)

    this._ready = (this.childLayers?.length ?? 0) > 0
  }

  onResize(canvasWidth: number, canvasHeight: number) {
    const width = this.state.width
    const height = this.state.height
    if (!width || !height || !canvasWidth || !canvasHeight) return

    const {lx, ly, rx, ry, sw, sh} = getFillCoord(width, height, canvasWidth, canvasHeight, this.state.fillMode)

    const x1 = -sw
    const y1 = -sh
    const x2 = sw
    const y2 = sh
    // 上屏四边形（裁剪空间），z=0
    this.screenPositions = [x1, y1, 0, x2, y1, 0, x1, y2, 0, x1, y2, 0, x2, y1, 0, x2, y2, 0]
    this.screenTexcoords = [lx, ly, rx, ly, lx, ry, lx, ry, rx, ly, rx, ry]
  }

  render() {
    const renderer = this.renderer
    const gl = renderer.getContext()
    const renderTarget = this.renderTarget
    const width = this.state.width
    const height = this.state.height
    if (!renderTarget || width <= 0 || height <= 0) return

    // 预乘 alpha 混合
    renderer.state.enable(gl.BLEND)
    renderer.state.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    renderer.state.clearColor(0, 0, 0, 0)

    // 1) 离屏渲染所有图层到 RenderTarget
    renderTarget.setSize(width, height)
    renderer.setRenderTarget(renderTarget)
    renderer.clear(true)
    super.renderChildren()

    // 2) 上屏：把 RenderTarget 纹理经 lkaShader 合成到画布（中性 uniform，等价纯纹理采样）
    renderer.setRenderTarget(null)
    renderer.clear(true)

    if (this.screenPositions.length === 0) {
      this.onResize(renderer.canvas.width, renderer.canvas.height)
    }

    renderLayerQuad(renderer, {
      positions: this.screenPositions,
      texcoords: this.screenTexcoords,
      srcTexture: renderTarget.texture,
      matrix: IDENTITY,
      opacity: 1.0,
    })
  }

  dispose() {
    this._ready = false
    this.renderTarget?.dispose()
    this.renderTarget = null
  }

  private async loadLKA(file: string | ArrayBufferLike) {
    let buffer: ArrayBufferLike | null = null

    if (typeof file === 'string') {
      const response = await fetch(file)
      if (!response.ok) {
        throw new Error(`load LKA file failed: ${response.status} ${response.statusText}`)
      }

      buffer = await response.arrayBuffer()
    } else {
      buffer = file
    }
    if (!buffer) {
      throw new Error('buffer is empty!')
    }

    const info = parseLka(buffer)
    if (!info) {
      throw new Error('parseLka failed!')
    }

    let props: LkaPlayProps | null = null
    try {
      props = JSON.parse(info.jsonStr)
    } catch (err) {
      throw new Error('JSON.parse failed!')
    }

    return {playProps: props, sourceMap: info.sourceMap}
  }
}
