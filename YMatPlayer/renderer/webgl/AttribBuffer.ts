import {WebGLRendererContext} from '../../utils/shims'

export type AttribInfo = {
  data: number[]
  size?: number
  type?: number
  normalize?: boolean
  stride?: number
  offset?: number
}

export default class AttribBuffer {
  constructor(gl: WebGLRendererContext) {
    this.gl = gl
  }

  gl?: WebGLRendererContext
  buffers: Record<number, WebGLBuffer> = {}

  setArribInfo(attribId: number, info: AttribInfo) {
    const {gl} = this
    if (!gl) return

    let buffer = this.buffers[attribId]
    if (!buffer) {
      buffer = gl.createBuffer() as WebGLBuffer
      this.buffers[attribId] = buffer
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(info.data), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(attribId)
    gl.vertexAttribPointer(
      attribId,
      info.size || 2,
      info.type || gl.FLOAT,
      info.normalize || false,
      info.stride || 0,
      info.offset || 0,
    )

    gl.bindBuffer(gl.ARRAY_BUFFER, null)
  }

  destroy() {
    for (const id in this.buffers) {
      this.gl?.deleteBuffer(this.buffers[id])
    }
    this.buffers = {}
    this.gl = undefined
  }
}
