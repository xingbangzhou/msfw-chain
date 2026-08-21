import {equalArray, copyArray} from '../../math/MathUtils'
import type {Texture} from '../../textures/Texture'
import type {WebGLTextures} from './WebGLTextures'

type UniformId = string | number
type VectorLike2 = {x: number; y: number}
type VectorLike3 = {x: number; y: number; z: number}
type VectorLike4 = {x: number; y: number; z: number; w: number}
type ColorLike = {r: number; g: number; b: number}
type MatrixLike = {elements?: number[]}

const m4_ = new Float32Array(16)
const m3_ = new Float32Array(9)

class UniformNode {
  id: UniformId
  addr: WebGLUniformLocation | null
  type: number
  size: number
  cache: Array<any>

  constructor(id: UniformId, addr: WebGLUniformLocation | null, type: number, size = 0) {
    this.id = id
    this.addr = addr
    this.type = type
    this.size = size
    this.cache = []
  }

  setValue!: (gl: WebGL2RenderingContext, value: any, textures?: WebGLTextures) => void
}

function setValuef(this: UniformNode, gl: WebGL2RenderingContext, v: number): void {
  const cache = this.cache

  if (cache[0] === v) return

  gl.uniform1f(this.addr, v)

  cache[0] = v
}

// Single float vector (from flat array or THREE.VectorN)

function setValueV2f(this: UniformNode, gl: WebGL2RenderingContext, v: VectorLike2 | ArrayLike<number>): void {
  const cache = this.cache

  if ((v as VectorLike2).x !== undefined) {
    const vector = v as VectorLike2

    if (cache[0] !== vector.x || cache[1] !== vector.y) {
      gl.uniform2f(this.addr, vector.x, vector.y)

      cache[0] = vector.x
      cache[1] = vector.y
    }
  } else {
    const array = v as Array<number>

    if (equalArray(cache, array)) return

    gl.uniform2fv(this.addr, array)

    copyArray(cache, array)
  }
}

function setValueV3f(
  this: UniformNode,
  gl: WebGL2RenderingContext,
  v: VectorLike3 | ColorLike | ArrayLike<number>,
): void {
  const cache = this.cache

  if ((v as VectorLike3).x !== undefined) {
    const vector = v as VectorLike3

    if (cache[0] !== vector.x || cache[1] !== vector.y || cache[2] !== vector.z) {
      gl.uniform3f(this.addr, vector.x, vector.y, vector.z)

      cache[0] = vector.x
      cache[1] = vector.y
      cache[2] = vector.z
    }
  } else if ((v as ColorLike).r !== undefined) {
    const color = v as ColorLike

    if (cache[0] !== color.r || cache[1] !== color.g || cache[2] !== color.b) {
      gl.uniform3f(this.addr, color.r, color.g, color.b)

      cache[0] = color.r
      cache[1] = color.g
      cache[2] = color.b
    }
  } else {
    const array = v as Array<number>

    if (equalArray(cache, array)) return

    gl.uniform3fv(this.addr, array)

    copyArray(cache, array)
  }
}

function setValueV4f(this: UniformNode, gl: WebGL2RenderingContext, v: VectorLike4 | ArrayLike<number>): void {
  const cache = this.cache

  if ((v as VectorLike4).x !== undefined) {
    const vector = v as VectorLike4

    if (cache[0] !== vector.x || cache[1] !== vector.y || cache[2] !== vector.z || cache[3] !== vector.w) {
      gl.uniform4f(this.addr, vector.x, vector.y, vector.z, vector.w)

      cache[0] = vector.x
      cache[1] = vector.y
      cache[2] = vector.z
      cache[3] = vector.w
    }
  } else {
    const array = v as Array<number>

    if (equalArray(cache, array)) return

    gl.uniform4fv(this.addr, array)

    copyArray(cache, array)
  }
}

function setValueM3(this: UniformNode, gl: WebGL2RenderingContext, v: MatrixLike | ArrayLike<number>): void {
  const cache = this.cache
  const elements = (v as MatrixLike).elements

  if (elements === undefined) {
    const array = v as Array<number>

    if (equalArray(cache, array)) return

    gl.uniformMatrix3fv(this.addr, false, array)

    copyArray(cache, array)
  } else {
    if (equalArray(cache, elements)) return

    m3_.set(elements)

    gl.uniformMatrix3fv(this.addr, false, m3_)

    copyArray(cache, elements)
  }
}

function setValueM4(this: UniformNode, gl: WebGL2RenderingContext, v: MatrixLike | ArrayLike<number>): void {
  const cache = this.cache
  const elements = (v as MatrixLike).elements

  if (elements === undefined) {
    const array = v as Array<number>

    if (equalArray(cache, array)) return

    gl.uniformMatrix4fv(this.addr, false, array)

    copyArray(cache, array)
  } else {
    if (equalArray(cache, elements)) return

    m4_.set(elements)

    gl.uniformMatrix4fv(this.addr, false, m4_)

    copyArray(cache, elements)
  }
}

function setValuei(this: UniformNode, gl: WebGL2RenderingContext, v: number): void {
  const cache = this.cache

  if (cache[0] === v) return

  gl.uniform1i(this.addr, v)

  cache[0] = v
}

// Single integer / boolean vector (from flat array or THREE.VectorN)

function setValueV2i(this: UniformNode, gl: WebGL2RenderingContext, v: VectorLike2 | ArrayLike<number>): void {
  const cache = this.cache

  if ((v as VectorLike2).x !== undefined) {
    const vector = v as VectorLike2

    if (cache[0] !== vector.x || cache[1] !== vector.y) {
      gl.uniform2i(this.addr, vector.x, vector.y)

      cache[0] = vector.x
      cache[1] = vector.y
    }
  } else {
    const array = v as Array<number>

    if (equalArray(cache, array)) return

    gl.uniform2iv(this.addr, array)

    copyArray(cache, array)
  }
}

function setValueV3i(this: UniformNode, gl: WebGL2RenderingContext, v: VectorLike3 | ArrayLike<number>): void {
  const cache = this.cache

  if ((v as VectorLike3).x !== undefined) {
    const vector = v as VectorLike3

    if (cache[0] !== vector.x || cache[1] !== vector.y || cache[2] !== vector.z) {
      gl.uniform3i(this.addr, vector.x, vector.y, vector.z)

      cache[0] = vector.x
      cache[1] = vector.y
      cache[2] = vector.z
    }
  } else {
    const array = v as Array<number>

    if (equalArray(cache, array)) return

    gl.uniform3iv(this.addr, array)

    copyArray(cache, array)
  }
}

function setValueV4i(this: UniformNode, gl: WebGL2RenderingContext, v: VectorLike4 | ArrayLike<number>): void {
  const cache = this.cache

  if ((v as VectorLike4).x !== undefined) {
    const vector = v as VectorLike4

    if (cache[0] !== vector.x || cache[1] !== vector.y || cache[2] !== vector.z || cache[3] !== vector.w) {
      gl.uniform4i(this.addr, vector.x, vector.y, vector.z, vector.w)

      cache[0] = vector.x
      cache[1] = vector.y
      cache[2] = vector.z
      cache[3] = vector.w
    }
  } else {
    const array = v as Array<number>

    if (equalArray(cache, array)) return

    gl.uniform4iv(this.addr, array)

    copyArray(cache, array)
  }
}

// Sampler (texture) uniform：分配纹理单元 → 上传/绑定纹理 → uniform1i 写入单元号

function setValueT1(this: UniformNode, gl: WebGL2RenderingContext, v: Texture, textures?: WebGLTextures): void {
  if (textures === undefined) {
    console.warn(`[LKA] WebGLUniforms: sampler uniform "${this.id}" requires a texture binder.`)
    return
  }

  if (v === null || v.isTexture !== true) {
    console.warn(`[LKA] WebGLUniforms: sampler uniform "${this.id}" expects a Texture value.`)
    return
  }

  const cache = this.cache
  const unit = textures.allocateTextureUnit()

  // uniform1i 写入纹理单元号（带缓存）
  if (cache[0] !== unit) {
    gl.uniform1i(this.addr, unit)
    cache[0] = unit
  }

  // 上传（若需要）并绑定纹理到该单元
  textures.setTexture2D(v, unit)
}

function getSingularSetter(type: number) {
  switch (type) {
    case 0x1406:
      return setValuef // FLOAT
    case 0x8b50:
      return setValueV2f // _VEC2
    case 0x8b51:
      return setValueV3f // _VEC3
    case 0x8b52:
      return setValueV4f // _VEC4

    case 0x8b5b:
      return setValueM3 // _MAT3
    case 0x8b5c:
      return setValueM4 // _MAT4

    case 0x8b5e: // SAMPLER_2D
    case 0x8d66: // SAMPLER_EXTERNAL_OES
    case 0x8dca: // INT_SAMPLER_2D
    case 0x8dd2: // UNSIGNED_INT_SAMPLER_2D
    case 0x8b62: // SAMPLER_2D_SHADOW
      return setValueT1

    case 0x1404:
    case 0x8b56:
      return setValuei // INT, BOOL
    case 0x8b53:
    case 0x8b57:
      return setValueV2i // _VEC2
    case 0x8b54:
    case 0x8b58:
      return setValueV3i // _VEC3
    case 0x8b55:
    case 0x8b59:
      return setValueV4i // _VEC4

    default:
      return setValuef
  }
}

class SingleUniform extends UniformNode {
  constructor(id: UniformId, activeInfo: WebGLActiveInfo, addr: WebGLUniformLocation | null) {
    super(id, addr, activeInfo.type, activeInfo.size)

    this.setValue = getSingularSetter(activeInfo.type)
  }
}

class WebGLUniforms {
  constructor(gl: WebGL2RenderingContext, program: WebGLProgram) {
    this.map = {}

    const n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number

    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(program, i)

      if (info === null) continue

      const addr = gl.getUniformLocation(program, info.name)

      const u = new SingleUniform(info.name, info, addr)
      this.map[info.name] = u
    }
  }

  map: Record<UniformId, UniformNode>

  setValue(gl: WebGL2RenderingContext, name: UniformId, value: any, textures?: WebGLTextures) {
    const u = this.map[name]

    if (u !== undefined) u.setValue(gl, value, textures)
  }
}

export {WebGLUniforms}
