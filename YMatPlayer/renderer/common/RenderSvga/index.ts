import {LayerProps, PlayInfo, SvgaSwapItemInfo, TransformProps, YMatKeyInfo, YMatKeyProps} from '../../../types'
import RenderImpl from '../RenderImpl'
import {SvgaPlayInfo} from './types'
import SpriteLayer from './Layer'
import RenderStore from '../RenderStore'
import {CanvasContext2D, CanvasType, createCanvas, getContext2D} from '../../../utils/canvas'
import {WebGLRendererContext} from '../../../utils/shims'
import Program from '../../webgl/Program'
import Framebuffer from '../../webgl/Framebuffer'
import AttribBuffer from '../../webgl/AttribBuffer'
import {getFillCoord} from '../../../math/mathUtils'
import {getSvgaFragment, getSvgaVertex} from '../../shaders/svga.glsl'

const defaultMatrix3 = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 0])

export default class RenderSvga implements RenderImpl {
  constructor(store: RenderStore, canvas: CanvasType, gl?: WebGLRendererContext) {
    this.store = store
    this.canvas = canvas
    this.gl = gl

    if (gl) {
      this.handleDraw = this.drawGL.bind(this, gl)
    } else {
      this.ctx2D = getContext2D(this.canvas)
      this.handleDraw = this.draw2D.bind(this, this.ctx2D as CanvasContext2D)
    }
  }

  readonly store: RenderStore
  readonly canvas: CanvasType

  private gl?: WebGLRendererContext
  private ctx2D: CanvasContext2D | null = null
  private drawCtx2D: CanvasContext2D | null = null
  private playInfo: SvgaPlayInfo | undefined = undefined
  private spriteLayers: SpriteLayer[] = []
  private swapItemInfos?: Record<string, SvgaSwapItemInfo[]>

  private handleDraw?: () => void

  private program?: Program
  private framebuffer?: Framebuffer
  private attribBuffer?: AttribBuffer
  private attrPosition: number[] = []
  private attrTexCoord: number[] = []

  async load(props: {playInfo: SvgaPlayInfo; effects?: Record<string, SvgaSwapItemInfo[]>}): Promise<
    | {
        keys: YMatKeyInfo[] | undefined
        info: PlayInfo
      }
    | undefined
  > {
    const store = this.store
    store.clear()

    const playInfo = props.playInfo
    store.setPlayProps({
      width: playInfo.size.width,
      height: playInfo.size.height,
      frameRate: playInfo.fps,
      duration: playInfo.frames / playInfo.fps,
    })
    this.playInfo = playInfo
    this.swapItemInfos = props.effects

    await this.initSprites(playInfo, this.gl)

    const canvas = this.canvas
    const canvasWidth = canvas.width
    const canvasHeight = canvas.height
    this.onResize(canvasWidth, canvasHeight)

    if (this.gl) {
      this.useProgram(this.gl)
      this.gl.uniform2f(this.gl.uniforms.resolution, store.width * 0.5, store.height * 0.5)
    }

    return undefined
  }

  isReady() {
    return !!this.playInfo
  }

  async setKeys(keys: YMatKeyProps | YMatKeyProps[]) {}

  onResize(canvasWidth: number, canvasHeight: number) {
    const store = this.store
    const width = store.width
    const height = store.height
    if (!width || !height) return
    // 适配尺寸
    const {lx, ly, rx, ry, sw, sh} = getFillCoord(width, height, canvasWidth, canvasHeight, store.fillMode)
    const x1 = -sw
    const y1 = -sh
    const x2 = sw
    const y2 = sh
    this.attrPosition = [x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2]
    const tx1 = lx
    const ty1 = ly
    const tx2 = rx
    const ty2 = ry
    this.attrTexCoord = [tx1, ty1, tx2, ty1, tx1, ty2, tx1, ty2, tx2, ty1, tx2, ty2]
  }

  render() {
    this.handleDraw?.()
  }

  destroy() {
    this.handleDraw = undefined

    this.clearSprites()

    this.framebuffer?.destory()
    this.framebuffer = undefined
    this.attribBuffer?.destroy()
    this.attribBuffer = undefined
    this.program?.destroy()
    this.program = undefined

    this.ctx2D = null
    this.drawCtx2D = null
  }

  checkReset() {}

  private clearSprites() {
    this.spriteLayers.forEach(layer => layer.destroy())
    this.spriteLayers = []

    return this.spriteLayers
  }

  private async initSprites(playInfo: SvgaPlayInfo, gl?: WebGLRendererContext) {
    this.spriteLayers = this.clearSprites()
    const layers = this.spriteLayers

    const swapItemInfos = this.swapItemInfos
    const images = playInfo.images
    const sprites = playInfo.sprites
    for (let i = 0, l = sprites.length; i < l; i++) {
      const info = sprites[i]
      const bitmapKey = info.imageKey.replace('.matte', '')
      const bitmap = images[bitmapKey]
      const layer = new SpriteLayer(info, bitmap, swapItemInfos?.[info.imageKey])
      layers.push(layer)
      await layer.init(gl)
    }

    // 异步回调判断
    if (layers !== this.spriteLayers) {
      layers.forEach(el => el.destroy())
    }
  }

  private drawGL(gl: WebGLRendererContext) {
    const framebuffer = this.framebuffer || (this.framebuffer = new Framebuffer(gl))
    const frameId = this.store.frameId
    const width = this.store.width
    const height = this.store.height
    if (width <= 0 || height <= 0) return

    const frames = this.store.frames
    const frameInfo = {
      frames,
      frameId,
      width,
      height,
      opacity: 1.0,
      framebuffer: framebuffer,
    }

    // Alpha预乘、混合模式
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    framebuffer.bind()
    framebuffer.viewport(width, height)

    gl.uniform1i(gl.uniforms.isResolution, 1)

    const layers = this.spriteLayers
    for (let i = 0, l = layers.length; i < l; i++) {
      const layer = layers[i]
      layer.drawGL(gl, frameInfo)
    }

    // 绘制默认上屏
    const canvasWidth = gl.canvas.width
    const canvasHeight = gl.canvas.height
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.disable(gl.BLEND)

    gl.activeTexture(gl.TEXTURE0)
    framebuffer.texture?.bind()

    gl.uniform1i(gl.uniforms.isResolution, 0)
    gl.uniform1f(gl.uniforms.opacity, 1.0)
    gl.uniform1i(gl.uniforms.maskMode, 0)
    gl.uniformMatrix3fv(gl.uniforms.matrix, false, defaultMatrix3)

    const attribBuffer = this.attribBuffer || (this.attribBuffer = new AttribBuffer(gl))
    attribBuffer.setArribInfo(gl.attribs.position, {
      data: this.attrPosition,
    })
    attribBuffer.setArribInfo(gl.attribs.texcoord, {
      data: this.attrTexCoord,
    })

    const primitiveType = gl.TRIANGLES
    gl.drawArrays(primitiveType, 0, 6)
  }

  private draw2D(ctx2D: CanvasContext2D) {
    const store = this.store
    const canvas = this.canvas

    const canvasWidth = canvas.width
    const canvasHeight = canvas.height
    const width = store.width
    const height = store.height
    const frameId = store.frameId

    const drawCtx2D =
      this.drawCtx2D ||
      (getContext2D(createCanvas(width * 2, height), {
        willReadFrequently: true,
      }) as CanvasContext2D)
    drawCtx2D.clearRect(0, 0, width, height)
    const layers = this.spriteLayers
    for (let i = 0, l = layers.length; i < l; i++) {
      const layer = layers[i]
      layer.draw2D(drawCtx2D, frameId)
    }

    ctx2D.clearRect(0, 0, canvasWidth, canvasHeight)
    const sx = this.attrTexCoord[0]
    const sy = this.attrTexCoord[1]
    const sw = (this.attrTexCoord[10] - sx) * width
    const sh = (this.attrTexCoord[11] - sy) * height
    const dx = (this.attrPosition[0] + 1.0) * canvasWidth * 0.5
    const dy = (1.0 + this.attrPosition[1]) * canvasHeight * 0.5
    const dw = this.attrPosition[10] * canvasWidth
    const dh = -this.attrPosition[1] * canvasHeight

    ctx2D.drawImage(drawCtx2D.canvas, sx, sy, sw, sh, dx, dy, dw, dh)
  }

  private useProgram(gl: WebGLRendererContext) {
    if (this.program) this.program.destroy()
    const program = (this.program = new Program(gl, {
      vertexShader: getSvgaVertex({webgl2: gl.isWebGL2}),
      fragmentShader: getSvgaFragment({webgl2: gl.isWebGL2}),
    }))
    if (program.invalid()) {
      throw 'RenderSvga Program is invalid!'
    }

    program.use(['matrix', 'resolution', 'isResolution', 'opacity', 'maskMode'], undefined, ['maskTexture'])
  }
}
