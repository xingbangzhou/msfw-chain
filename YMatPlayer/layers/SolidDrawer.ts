import Texture from '../renderer/webgl/Texture'
import {WebGLRendererContext} from '../utils/shims'
import {LayerSolidProps} from '../types'
import Drawer from './BaseDrawer'
import {FrameInfo} from '../renderer/common/RenderStore'
import {drawTexture} from '../renderer/common/primitives'
import {Matrix4} from '../math/Matrix4'

export default class SolidDrawer extends Drawer<LayerSolidProps> {
  async init(gl: WebGLRendererContext) {
    const color = this.ref.props.color
    if (color.length > 0) {
      const r = color[0] * 255
      const g = (color?.[1] || 0) * 255
      const b = (color?.[2] || 0) * 255
      const a = (color?.[3] ?? 1.0) * 255
      this.texture = new Texture(gl)
      this.texture.texPixel2D(new Uint8Array([r, g, b, a]), 1, 1)
    }
  }

  draw(gl: WebGLRendererContext, matrix: Matrix4, frameInfo: FrameInfo) {
    if (!this.texture) return
    gl.activeTexture(gl.TEXTURE0)
    this.texture.bind()
    gl.uniformMatrix4fv(gl.uniforms.matrix, false, matrix.elements)

    const ref = this.ref
    const width = ref.props.width
    const height = ref.props.height
    drawTexture(this.getAttribBuffer(gl), width, height, undefined, ref.hueSaturation, ref.brightness, ref.contrast)

    gl.bindTexture(gl.TEXTURE_2D, null)
  }
}
