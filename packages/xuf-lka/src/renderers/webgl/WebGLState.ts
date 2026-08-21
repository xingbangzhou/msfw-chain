import {Vector4} from '../../math/Vector4'

type FramebufferTarget = WebGLFramebuffer | null | undefined

type ClearColor = {
  r: number
  g: number
  b: number
  a: number
}

/**
 * WebGLState — WebGL 全局状态缓存。
 *
 * 统一管理 renderer 中高频切换的状态，避免重复 gl 调用，也为后续材质/Pass
 * 接入 blend、scissor、program 等状态提供单一入口。
 */
export class WebGLState {
  private gl: WebGL2RenderingContext

  private currentProgram: WebGLProgram | null = null
  private currentFramebuffer: FramebufferTarget = undefined
  private currentViewport = new Vector4(Number.NaN, Number.NaN, Number.NaN, Number.NaN)
  private currentScissor = new Vector4(Number.NaN, Number.NaN, Number.NaN, Number.NaN)
  private currentClearColor: ClearColor = {r: Number.NaN, g: Number.NaN, b: Number.NaN, a: Number.NaN}

  private enabledCapabilities = new Map<number, boolean>()
  private currentBlendFunc: [number, number] | null = null
  private currentBlendFuncSeparate: [number, number, number, number] | null = null
  private currentBlendEquation: [number, number] | null = null

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
    this.reset()
  }

  init(): void {
    const gl = this.gl

    this.disable(gl.DEPTH_TEST)
    this.disable(gl.CULL_FACE)
    this.disable(gl.SCISSOR_TEST)
    this.enable(gl.BLEND)
    this.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    this.clearColor(0, 0, 0, 0)
  }

  reset(): void {
    this.currentProgram = null
    this.currentFramebuffer = undefined
    this.currentViewport.set(Number.NaN, Number.NaN, Number.NaN, Number.NaN)
    this.currentScissor.set(Number.NaN, Number.NaN, Number.NaN, Number.NaN)
    this.currentClearColor = {r: Number.NaN, g: Number.NaN, b: Number.NaN, a: Number.NaN}
    this.enabledCapabilities.clear()
    this.currentBlendFunc = null
    this.currentBlendFuncSeparate = null
    this.currentBlendEquation = null
  }

  useProgram(program: WebGLProgram | null): boolean {
    if (this.currentProgram === program) return false

    this.gl.useProgram(program)
    this.currentProgram = program

    return true
  }

  bindFramebuffer(target: number, framebuffer: WebGLFramebuffer | null): void {
    if (target === this.gl.FRAMEBUFFER && this.currentFramebuffer === framebuffer) return

    this.gl.bindFramebuffer(target, framebuffer)

    if (target === this.gl.FRAMEBUFFER) {
      this.currentFramebuffer = framebuffer
    }
  }

  viewport(x: number, y: number, width: number, height: number): void {
    const viewport = this.currentViewport
    if (viewport.x === x && viewport.y === y && viewport.z === width && viewport.w === height) return

    this.gl.viewport(x, y, width, height)
    viewport.set(x, y, width, height)
  }

  scissor(x: number, y: number, width: number, height: number): void {
    const scissor = this.currentScissor
    if (scissor.x === x && scissor.y === y && scissor.z === width && scissor.w === height) return

    this.gl.scissor(x, y, width, height)
    scissor.set(x, y, width, height)
  }

  enable(capability: number): void {
    if (this.enabledCapabilities.get(capability) === true) return

    this.gl.enable(capability)
    this.enabledCapabilities.set(capability, true)
  }

  disable(capability: number): void {
    if (this.enabledCapabilities.get(capability) === false) return

    this.gl.disable(capability)
    this.enabledCapabilities.set(capability, false)
  }

  blendFunc(src: number, dst: number): void {
    const current = this.currentBlendFunc
    if (current !== null && current[0] === src && current[1] === dst) return

    this.gl.blendFunc(src, dst)
    this.currentBlendFunc = [src, dst]
    this.currentBlendFuncSeparate = null
  }

  blendFuncSeparate(srcRGB: number, dstRGB: number, srcAlpha: number, dstAlpha: number): void {
    const current = this.currentBlendFuncSeparate
    if (
      current !== null &&
      current[0] === srcRGB &&
      current[1] === dstRGB &&
      current[2] === srcAlpha &&
      current[3] === dstAlpha
    ) {
      return
    }

    this.gl.blendFuncSeparate(srcRGB, dstRGB, srcAlpha, dstAlpha)
    this.currentBlendFuncSeparate = [srcRGB, dstRGB, srcAlpha, dstAlpha]
    this.currentBlendFunc = null
  }

  blendEquation(modeRGB: number, modeAlpha = modeRGB): void {
    const current = this.currentBlendEquation
    if (current !== null && current[0] === modeRGB && current[1] === modeAlpha) return

    if (modeRGB === modeAlpha) {
      this.gl.blendEquation(modeRGB)
    } else {
      this.gl.blendEquationSeparate(modeRGB, modeAlpha)
    }

    this.currentBlendEquation = [modeRGB, modeAlpha]
  }

  clearColor(r: number, g: number, b: number, a: number): void {
    const current = this.currentClearColor
    if (current.r === r && current.g === g && current.b === b && current.a === a) return

    this.gl.clearColor(r, g, b, a)
    this.currentClearColor = {r, g, b, a}
  }

  clear(color = true, depth = false, stencil = false): void {
    const gl = this.gl
    let bits = 0

    if (color) bits |= gl.COLOR_BUFFER_BIT
    if (depth) bits |= gl.DEPTH_BUFFER_BIT
    if (stencil) bits |= gl.STENCIL_BUFFER_BIT

    if (bits !== 0) {
      gl.clear(bits)
    }
  }
}
