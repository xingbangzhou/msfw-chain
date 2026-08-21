import {RenderTarget} from '../core/RenderTarget'
import {Vector4} from '../math/Vector4'
import type {Texture} from '../textures/Texture'
import {createCanvasElement} from '../utils'
import type {BuiltShader} from './shaders/ShaderBuilder'
import {WebGLInfo} from './webgl/WebGLInfo'
import {WebGLPrograms} from './webgl/WebGLPrograms'
import { WebGLProperties } from './webgl/WebGLProperties'
import {WebGLState} from './webgl/WebGLState'
import {WebGLTextures} from './webgl/WebGLTextures'

export interface WebGLRendererParameters {
  canvas?: HTMLCanvasElement | OffscreenCanvas

  /**
   * default is false.
   */
  alpha?: boolean

  /**
   * default is true.
   */
  premultipliedAlpha?: boolean
}

export interface WebGLDrawParameters {
  shader: BuiltShader
  uniforms?: Record<string, unknown>
  mode?: number
  first?: number
  count: number
}

export class WebGLRenderer {
  constructor(parameters: WebGLRendererParameters = {}) {
    const {canvas = createCanvasElement(), alpha = false, premultipliedAlpha = true} = parameters

    this.canvas = canvas

    const canvasWidth = canvas.width
    const canvasHeight = canvas.height
    this._width = canvasWidth
    this._height = canvasHeight

    this._pixelRatio = 1
    this._viewport = new Vector4(0, 0, canvasWidth, canvasHeight)

    canvas.addEventListener('webglcontextlost', this.onContextLost, false)
    canvas.addEventListener('webglcontextrestored', this.onContextRestore, false)
    canvas.addEventListener('webglcontextcreationerror', this.onContextCreationError, false)

    this._gl = canvas.getContext('webgl2', {
      alpha,
      premultipliedAlpha,
    }) as WebGL2RenderingContext

    this.initGLContext()
  }

  readonly canvas: HTMLCanvasElement | OffscreenCanvas
  properties!: WebGLProperties
  info!: WebGLInfo
  state!: WebGLState
   
  private _width: number
  private _height: number
  private _pixelRatio: number
  private _viewport: Vector4
  
  private _isContextLost = false
  private _gl: WebGL2RenderingContext
  private _programs!: WebGLPrograms
  private _textures!: WebGLTextures
  /** 当前绑定的离屏渲染目标，null 表示默认帧缓冲（canvas） */
  private _currentRenderTarget: RenderTarget | null = null

  /** 复用的四边形几何资源（position + texcoord） */
  private _quadVao: WebGLVertexArrayObject | null = null
  private _quadPositionBuffer: WebGLBuffer | null = null
  private _quadTexcoordBuffer: WebGLBuffer | null = null
  /** program → attribute location 缓存 */
  private _attribLocations = new WeakMap<WebGLProgram, {position: number; texcoord: number}>()

  getContext() {
    return this._gl
  }

  setPixelRatio(value: number) {
    this._pixelRatio = value

    this.setSize(this._width, this._height)
  }

  setSize(width: number, height: number) {
    const canvas = this.canvas

    this._width = width
    this._height = height

    const pixelRatio = this._pixelRatio
    canvas.width = Math.floor(width * pixelRatio)
    canvas.height = Math.floor(height * pixelRatio)

    this.setViewport(0, 0, width, height)
  }

  setViewport(x: number, y: number, width: number, height: number) {
    this._viewport.set(x, y, width, height)

    if (this._currentRenderTarget === null) {
      this.state.viewport(x, y, width, height)
    }
  }

  /**
   * 设置渲染目标：传入 RenderTarget 则渲染到其 framebuffer，传 null 恢复到 canvas。
   */
  setRenderTarget(renderTarget: RenderTarget | null): void {
    const gl = this._gl
    this._currentRenderTarget = renderTarget

    if (renderTarget !== null) {
      this._textures.setupRenderTarget(renderTarget)
      this.state.bindFramebuffer(gl.FRAMEBUFFER, this._textures.getFramebuffer(renderTarget))
      this.state.viewport(0, 0, renderTarget.width, renderTarget.height)
    } else {
      this.state.bindFramebuffer(gl.FRAMEBUFFER, null)
      const v = this._viewport
      this.state.viewport(v.x, v.y, v.z, v.w)
    }
  }

  getRenderTarget(): RenderTarget | null {
    return this._currentRenderTarget
  }

  swapRenderTarget(renderTarget = this._currentRenderTarget): Texture | null {
    if (renderTarget === null) return null

    const texture = renderTarget.swap()
    this._textures.updateRenderTarget(renderTarget)

    if (renderTarget === this._currentRenderTarget) {
      this.state.reset()
      this.setRenderTarget(renderTarget)
    }

    return texture
  }

  setTexture2D(texture: Texture, slot = 0): void {
    this._textures.setTexture2D(texture, slot)
  }

  /**
   * 绘制一个纹理四边形。
   *
   * 传入 BuiltShader（自动编译并缓存为 program）、顶点数据与 uniform 集合，
   * 内部完成 useProgram、attribute 绑定、纹理单元重置、uniform 上传与 drawArrays。
   *
   * @param positions 顶点坐标，每个顶点 3 个分量（x, y, z）
   * @param texcoords 纹理坐标，每个顶点 2 个分量（u, v）
   * @param uniforms  uniform 名 → 值（Matrix4 / number / Texture 等）
   */
  renderQuad(
    shader: BuiltShader,
    positions: ArrayLike<number>,
    texcoords: ArrayLike<number>,
    uniforms: Record<string, unknown>,
  ): void {
    const gl = this._gl
    if (this._isContextLost) return

    const compiled = this._programs.acquire(shader)
    if (compiled === null) return

    this.state.useProgram(compiled.program)

    // attribute location（按 program 缓存）
    let locations = this._attribLocations.get(compiled.program)
    if (locations === undefined) {
      locations = {
        position: gl.getAttribLocation(compiled.program, 'a_position'),
        texcoord: gl.getAttribLocation(compiled.program, 'a_texcoord'),
      }
      this._attribLocations.set(compiled.program, locations)
    }

    // 几何资源惰性创建
    if (this._quadVao === null) {
      this._quadVao = gl.createVertexArray()
      this._quadPositionBuffer = gl.createBuffer()
      this._quadTexcoordBuffer = gl.createBuffer()
    }

    gl.bindVertexArray(this._quadVao)

    gl.bindBuffer(gl.ARRAY_BUFFER, this._quadPositionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW)
    if (locations.position >= 0) {
      gl.enableVertexAttribArray(locations.position)
      gl.vertexAttribPointer(locations.position, 3, gl.FLOAT, false, 0, 0)
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this._quadTexcoordBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texcoords), gl.DYNAMIC_DRAW)
    if (locations.texcoord >= 0) {
      gl.enableVertexAttribArray(locations.texcoord)
      gl.vertexAttribPointer(locations.texcoord, 2, gl.FLOAT, false, 0, 0)
    }

    // 每次绘制前重置纹理单元分配，sampler uniform 会按需分配单元并绑定纹理
    this._textures.resetTextureUnits()

    const programUniforms = compiled.uniforms
    for (const name in uniforms) {
      programUniforms.setValue(gl, name, uniforms[name], this._textures)
    }

    gl.drawArrays(gl.TRIANGLES, 0, Math.floor(positions.length / 3))

    gl.bindVertexArray(null)
  }

  clear(color = true, depth = false, stencil = false): void {
    this.state.clear(color, depth, stencil)
  }

  dispose() {
    const canvas = this.canvas
    this._programs.dispose()

    const gl = this._gl
    if (this._quadVao !== null) gl.deleteVertexArray(this._quadVao)
    if (this._quadPositionBuffer !== null) gl.deleteBuffer(this._quadPositionBuffer)
    if (this._quadTexcoordBuffer !== null) gl.deleteBuffer(this._quadTexcoordBuffer)
    this._quadVao = null
    this._quadPositionBuffer = null
    this._quadTexcoordBuffer = null

    canvas.removeEventListener('webglcontextlost', this.onContextLost, false)
    canvas.removeEventListener('webglcontextrestored', this.onContextRestore, false)
    canvas.removeEventListener('webglcontextcreationerror', this.onContextCreationError, false)
  }

  private initGLContext() {
    this.properties = new WebGLProperties()
    this.info = new WebGLInfo(this._gl)
    this.state = new WebGLState(this._gl)

    this._programs = new WebGLPrograms(this._gl, this.info)
    this._textures = new WebGLTextures(this._gl, this.info, this.properties)
  }

  private onContextLost = (event: Event) => {
    console.log('Ly3D.WebGLRenderer: Context Lost.')

    event.preventDefault()

    this._isContextLost = true
  }

  private onContextRestore = () => {
    console.log('[LKA]WebGLRenderer: Context Restored.')

    this._isContextLost = false

    this.initGLContext()
  }

  private onContextCreationError = (event: Event) => {
    console.error('[LKA]WebGLRenderer: Context could not be created, Error: ', (event as any).statusMessage)
  }
}
