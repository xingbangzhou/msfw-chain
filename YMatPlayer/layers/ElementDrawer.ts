import {Property} from '../core/Transform3D'
import Texture from '../renderer/webgl/Texture'
import {WebGLRendererContext} from '../utils/shims'
import {LayerEllipseProps, LayerPathProps, LayerRectProps} from '../types'
import Drawer from './BaseDrawer'
import {FrameInfo} from '../renderer/common/RenderStore'
import {drawTexture} from '../renderer/common/primitives'
import {rgba} from '../math/mathUtils'
import {Matrix4} from '../math/Matrix4'
import {createCanvas, CanvasContext2D, getContext2D} from '../utils/canvas'

const LineCap: CanvasLineCap[] = ['butt', 'round', 'square']
const LineJoin: CanvasLineJoin[] = ['bevel', 'miter', 'round']

export default abstract class ElementDrawer<
  Props extends LayerRectProps | LayerEllipseProps | LayerPathProps,
> extends Drawer<Props> {
  private ctx: CanvasContext2D | null = null
  private lineDashOffset?: Property<number>
  private lastDashOffset = 0

  async init(gl: WebGLRendererContext) {
    this.texture = new Texture(gl)

    const props = this.ref.props
    const strokeInfo = props.elements.strokeInfo
    if (strokeInfo?.dashesInfo) {
      this.lineDashOffset = new Property<number>(strokeInfo.dashesInfo.offset)
    }
  }

  draw(gl: WebGLRendererContext, matrix: Matrix4, frameInfo: FrameInfo) {
    if (!this.texture) return

    this.drawShape(gl, frameInfo)

    gl.activeTexture(gl.TEXTURE0)
    this.texture.bind()
    gl.uniformMatrix4fv(gl.uniforms.matrix, false, matrix.elements)

    const ref = this.ref
    const width = ref.props.width
    const height = ref.props.height
    drawTexture(this.getAttribBuffer(gl), width, height, undefined, ref.hueSaturation, ref.brightness, ref.contrast)

    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  destroy(): void {
    super.destroy()
    this.ctx = null
  }

  protected abstract getDrawPath(ctx: CanvasContext2D): Path2D | null

  private drawShape(gl: WebGLRendererContext, frameInfo: FrameInfo) {
    const ref = this.ref
    const width = ref.props.width
    const height = ref.props.height
    let hasTexture = true
    if (!this.ctx) {
      const canvas = createCanvas(width, height)
      this.ctx = getContext2D(canvas)
      hasTexture = false
    }
    if (!this.ctx) return

    const lineDashOffset = (this.lineDashOffset?.getValue(frameInfo.frameId) || 0) as number

    if (!hasTexture || lineDashOffset !== this.lastDashOffset) {
      this.lastDashOffset = lineDashOffset
      this.ctx?.clearRect(0, 0, width, height)

      // 设置参数
      const fillInfo = ref.props.elements.fillInfo
      if (fillInfo) {
        this.ctx.fillStyle = rgba(fillInfo.color, fillInfo.opacity)
      }
      const strokeInfo = ref.props.elements.strokeInfo
      if (strokeInfo) {
        this.ctx.strokeStyle = rgba(strokeInfo.color, strokeInfo.opacity)
        this.ctx.lineCap = LineCap[strokeInfo.lineCap]
        this.ctx.lineWidth = strokeInfo.width
        this.ctx.lineJoin = LineJoin[strokeInfo.lineJoin]
        this.ctx.miterLimit = strokeInfo.miterLimit
        if (strokeInfo.dashesInfo) {
          this.ctx.setLineDash(strokeInfo.dashesInfo.dash)
          const dashOffset = (this.lineDashOffset?.getValue(frameInfo.frameId) || 0) as number
          this.ctx.lineDashOffset = dashOffset
        }
      }

      const path = this.getDrawPath(this.ctx)
      if (fillInfo) {
        path ? this.ctx.fill(path) : this.ctx.fill()
      }
      if (strokeInfo) {
        path ? this.ctx.stroke(path) : this.ctx.stroke()
      }

      this.texture?.texImage2D(<TexImageSource>this.ctx.canvas)
    }
  }
}
