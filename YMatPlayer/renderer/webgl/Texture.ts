import {WebGLRendererContext} from '../../utils/shims'

export default class Texture {
  constructor(gl: WebGLRendererContext) {
    this.gl = gl

    this.texture = gl.createTexture()
    if (this.texture) {
      gl.bindTexture(gl.TEXTURE_2D, this.texture)

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

      gl.bindTexture(gl.TEXTURE_2D, null)
    }
  }

  gl: WebGLRendererContext | null = null
  texture: WebGLTexture | null = null

  bind() {
    const {gl, texture} = this
    if (!gl || !texture) return

    gl.bindTexture(gl.TEXTURE_2D, texture)
  }

  texImage2D(source: TexImageSource) {
    const {gl, texture} = this
    if (!gl || !texture) return

    gl.bindTexture(gl.TEXTURE_2D, texture)

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)

    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  texPixel2D(pixels: ArrayBufferView | null, w: number, h: number) {
    const {gl, texture} = this
    if (!gl || !texture || w <= 0 || h <= 0) return

    gl.bindTexture(gl.TEXTURE_2D, texture)

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  clear() {
    this.texPixel2D(new Uint8Array([0, 0, 0, 0]), 1, 1)
  }

  destroy() {
    const gl = this.gl
    this.gl = null

    gl?.deleteTexture(this.texture)
    this.texture = null
  }
}
