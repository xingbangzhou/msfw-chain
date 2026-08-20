import {BRIGHTNESS, CONTRAST} from '../../math/mathUtils'
import {WebGLRendererContext} from '../../utils/shims'
import AttribBuffer from '../webgl/AttribBuffer'
import {HueStaturation} from './RenderYMat/types'

export function setRectangle(attribBuffer: AttribBuffer, x: number, y: number, w: number, h: number) {
  const x1 = 0
  const y1 = 0
  const x2 = x + w
  const y2 = y - h
  const z = 0

  const gl = attribBuffer.gl as WebGLRendererContext
  attribBuffer.setArribInfo(gl.attribs.position, {
    size: 3,
    data: [x1, y1, z, x2, y1, z, x1, y2, z, x1, y2, z, x2, y1, z, x2, y2, z],
  })
}

// 绘制纹理矩形
export function drawTexture(
  attribBuffer: AttribBuffer,
  w: number,
  h: number,
  flipY?: boolean,
  hueSaturation?: HueStaturation,
  brightness?: number,
  contrast?: number,
) {
  setRectangle(attribBuffer, 0, 0, w, h)

  const gl = attribBuffer.gl as WebGLRendererContext

  const tx1 = 0
  const ty1 = flipY ? 1 : 0
  const tx2 = 1
  const ty2 = flipY ? 0 : 1
  attribBuffer.setArribInfo(gl.attribs.texcoord, {
    data: [tx1, ty1, tx2, ty1, tx1, ty2, tx1, ty2, tx2, ty1, tx2, ty2],
  })

  // 亮度和对比度
  gl.uniform1f(gl.uniforms.brightness, BRIGHTNESS(brightness || 0))
  gl.uniform1f(gl.uniforms.contrast, CONTRAST(contrast || 0))
  // 色相和饱和度
  if (hueSaturation) {
    const {colorize = 0, hue = 0, saturation = 0, lightness = 0} = hueSaturation
    gl.uniform1i(gl.uniforms.colorize, colorize)
    gl.uniform1f(gl.uniforms.hue, hue / 360)
    gl.uniform1f(gl.uniforms.saturation, saturation / 100)
    gl.uniform1f(gl.uniforms.lightness, lightness / 100)
  }

  const primitiveType = gl.TRIANGLES
  const count = 6
  gl.drawArrays(primitiveType, 0, count)

  gl.uniform1f(gl.uniforms.brightness, BRIGHTNESS(0))
  gl.uniform1f(gl.uniforms.contrast, CONTRAST(0))
  gl.uniform1i(gl.uniforms.colorize, 0)
}

// 绘制视频纹理
export function drawVideo(
  attribBuffer: AttribBuffer,
  w: number,
  h: number,
  texcoord: {lx: number; ly: number; rx: number; ry: number},
  hueSaturation?: HueStaturation,
  brightness?: number,
  contrast?: number,
) {
  setRectangle(attribBuffer, 0, 0, w, h)

  const gl = attribBuffer.gl as WebGLRendererContext

  const tx1 = texcoord.lx
  const ty1 = texcoord.ly
  const tx2 = texcoord.rx
  const ty2 = texcoord.ry
  attribBuffer.setArribInfo(gl.attribs.texcoord, {
    data: [tx1, ty1, tx2, ty1, tx1, ty2, tx1, ty2, tx2, ty1, tx2, ty2],
  })

  // 亮度和对比度
  gl.uniform1f(gl.uniforms.brightness, BRIGHTNESS(brightness || 0))
  gl.uniform1f(gl.uniforms.contrast, CONTRAST(contrast || 0))
  // 色相和饱和度
  if (hueSaturation) {
    const {colorize = 0, hue = 0, saturation = 0, lightness = 0} = hueSaturation
    gl.uniform1i(gl.uniforms.colorize, colorize)
    gl.uniform1f(gl.uniforms.hue, hue / 360)
    gl.uniform1f(gl.uniforms.saturation, saturation / 100)
    gl.uniform1f(gl.uniforms.lightness, lightness / 100)
  }

  const primitiveType = gl.TRIANGLES
  const count = 6
  gl.drawArrays(primitiveType, 0, count)

  gl.uniform1f(gl.uniforms.brightness, BRIGHTNESS(0))
  gl.uniform1f(gl.uniforms.contrast, CONTRAST(0))
  gl.uniform1i(gl.uniforms.colorize, 0)
}

export function drawSimpleTexture(
  attribBuffer: AttribBuffer,
  vertCoord?: {lx: number; ly: number; rx: number; ry: number},
  texCoord?: {lx: number; ly: number; rx: number; ry: number},
  hueSaturation?: HueStaturation,
  brightness?: number,
  contrast?: number,
) {
  const gl = attribBuffer.gl as WebGLRendererContext

  {
    const x1 = vertCoord?.lx ?? -1.0
    const y1 = vertCoord?.ly ?? -1.0
    const x2 = vertCoord?.rx ?? 1.0
    const y2 = vertCoord?.ry ?? 1.0

    attribBuffer.setArribInfo(gl.attribs.position, {
      data: [x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2],
    })
  }

  const tx1 = texCoord?.lx ?? 0
  const ty1 = texCoord?.ly ?? 0
  const tx2 = texCoord?.rx ?? 1
  const ty2 = texCoord?.ry ?? 1

  attribBuffer.setArribInfo(gl.attribs.texcoord, {
    data: [tx1, ty1, tx2, ty1, tx1, ty2, tx1, ty2, tx2, ty1, tx2, ty2],
  })

  // 亮度和对比度
  gl.uniform1f(gl.uniforms.brightness, BRIGHTNESS(brightness || 0))
  gl.uniform1f(gl.uniforms.contrast, CONTRAST(contrast || 0))
  // 色相和饱和度
  if (hueSaturation) {
    const {colorize = 0, hue = 0, saturation = 0, lightness = 0} = hueSaturation
    gl.uniform1i(gl.uniforms.colorize, colorize)
    gl.uniform1f(gl.uniforms.hue, hue / 360)
    gl.uniform1f(gl.uniforms.saturation, saturation / 100)
    gl.uniform1f(gl.uniforms.lightness, lightness / 100)
  }

  const primitiveType = gl.TRIANGLES
  gl.drawArrays(primitiveType, 0, 6)

  gl.uniform1f(gl.uniforms.brightness, BRIGHTNESS(0))
  gl.uniform1f(gl.uniforms.contrast, CONTRAST(0))
  gl.uniform1i(gl.uniforms.colorize, 0)
}
