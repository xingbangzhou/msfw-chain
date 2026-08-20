import Object3D from '../core/Object3D'
import {ID2RGB} from '../math/mathUtils'
import {Matrix4} from '../math/Matrix4'
import {drawTexture} from '../renderer/common/primitives'
import {FrameInfo} from '../renderer/common/RenderStore'
import AttribBuffer from '../renderer/webgl/AttribBuffer'
import Texture from '../renderer/webgl/Texture'
import {WebGLRendererContext} from '../utils/shims'
import {LayerProps} from '../types'

export default abstract class BaseDrawer<Props extends LayerProps = LayerProps> {
  constructor(ref: Object3D<Props>) {
    this.ref = ref
  }

  protected ref: Object3D<Props>
  protected attribBuffer: AttribBuffer | null = null
  protected texture: Texture | null = null
  protected rgbTexture: Texture | null = null

  protected isDestroied = false

  getAttribBuffer(gl: WebGLRendererContext) {
    if (!this.attribBuffer) {
      this.attribBuffer = new AttribBuffer(gl)
    }
    return this.attribBuffer
  }

  abstract init(gl: WebGLRendererContext): Promise<void>

  abstract draw(gl: WebGLRendererContext, matrix: Matrix4, frameInfo: FrameInfo): void

  destroy() {
    this.attribBuffer?.destroy()
    this.attribBuffer = null

    this.texture?.destroy()
    this.texture = null
    this.rgbTexture?.destroy()
    this.rgbTexture = null

    this.isDestroied = true
  }

  drawID(gl: WebGLRendererContext, matrix: Matrix4, frameInfo: FrameInfo) {
    const texture = this.texture
    if (texture === null || !this.ref.id) return

    const ref = this.ref
    const width = ref.props.width
    const height = ref.props.height

    let rgbTexture = this.rgbTexture
    if (rgbTexture === null) {
      const rgb = ID2RGB(ref.id)
      rgbTexture = new Texture(gl)
      rgbTexture.texPixel2D(new Uint8Array([...rgb, 255]), 1, 1)
    }

    gl.activeTexture(gl.TEXTURE0)
    rgbTexture.bind()
    gl.uniformMatrix4fv(gl.uniforms.matrix, false, matrix.elements)

    drawTexture(this.getAttribBuffer(gl), width, height, undefined)

    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  checkReset() {}
}
