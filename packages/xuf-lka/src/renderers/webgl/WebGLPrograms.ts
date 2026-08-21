import {type BuiltShader} from '../shaders/ShaderBuilder'
import type {WebGLInfo} from './WebGLInfo'
import {WebGLUniforms} from './WebGLUniforms'

/**
 * 编译后的 WebGL 程序 + uniforms 包装
 */
export interface CompiledProgram {
  program: WebGLProgram
  uniforms: WebGLUniforms
  cacheKey: string
}

/**
 * WebGLPrograms — WebGL 程序管理框架
 *
 * 职责：
 * 1. 将 BuiltShader（GLSL 源码）编译为 WebGLProgram
 * 2. 基于 cacheKey 缓存已编译的程序，避免重复编译
 * 3. 管理程序的获取、释放与全量销毁
 * 4. 编译/链接错误诊断
 * 5. WebGL Context 丢失/恢复处理
 */
class WebGLPrograms {
  private gl: WebGL2RenderingContext
  private info?: WebGLInfo
  private programs: Map<string, CompiledProgram> = new Map()

  constructor(gl: WebGL2RenderingContext, info?: WebGLInfo) {
    this.gl = gl
    this.info = info
  }

  /**
   * 获取或编译一个程序
   *
   * 如果 cacheKey 对应的程序已存在，直接返回缓存的 CompiledProgram；
   * 否则编译 BuiltShader 并缓存。
   *
   * 注意：Context 丢失时返回 null
   */
  acquire(builtShader: BuiltShader): CompiledProgram | null {
    const {cacheKey} = builtShader

    // 缓存命中
    const cached = this.programs.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    // 编译新程序
    const compiled = this.compile(builtShader)
    if (compiled === null) {
      return null
    }

    // 写入缓存
    this.programs.set(cacheKey, compiled)
    if (this.info !== undefined) {
      this.info.memory.programs = this.programs.size
    }

    return compiled
  }

  /**
   * 释放指定 cacheKey 对应的程序
   *
   * 从缓存中移除并删除 GPU 程序对象。
   * @returns 是否成功释放（key 不存在时返回 false）
   */
  release(cacheKey: string): boolean {
    const compiled = this.programs.get(cacheKey)
    if (compiled === undefined) {
      return false
    }

    this.deleteProgram(compiled)
    this.programs.delete(cacheKey)
    if (this.info !== undefined) {
      this.info.memory.programs = this.programs.size
    }

    return true
  }

  /**
   * 检查缓存中是否存在指定 cacheKey 的程序
   */
  has(cacheKey: string): boolean {
    return this.programs.has(cacheKey)
  }

  /**
   * 获取当前缓存中的程序数量
   */
  get size(): number {
    return this.programs.size
  }

  /**
   * 销毁所有已缓存的程序
   */
  dispose(): void {
    // 删除所有 GPU 程序
    for (const compiled of this.programs.values()) {
      this.deleteProgram(compiled)
    }

    this.programs.clear()
    if (this.info !== undefined) {
      this.info.memory.programs = 0
    }
  }

  // ===== 编译 =====

  /**
   * 将 BuiltShader 编译为 WebGLProgram
   *
   * 流程：
   * 1. 编译顶点着色器
   * 2. 编译片段着色器
   * 3. 链接程序
   * 4. 验证程序
   * 5. 构建 WebGLUniforms 包装
   */
  compile(builtShader: BuiltShader): CompiledProgram | null {
    const gl = this.gl

    // 1. 编译顶点着色器
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, builtShader.vertex)
    if (vertexShader === null) {
      return null
    }

    // 2. 编译片段着色器
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, builtShader.fragment)
    if (fragmentShader === null) {
      gl.deleteShader(vertexShader)
      return null
    }

    // 3. 链接程序
    const program = gl.createProgram()!

    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    // 着色器对象在链接后可安全删除
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)

    // 4. 链接检查
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program)
      console.error('[LKA] WebGLPrograms: Program link failed.\n' + info)

      gl.deleteProgram(program)
      return null
    }

    // 5. 验证程序（调试阶段，非必须但推荐）
    gl.validateProgram(program)
    if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
      const info = gl.getProgramInfoLog(program)
      console.warn('[LKA] WebGLPrograms: Program validation warning.\n' + info)
      // 验证失败不阻止使用，仅警告
    }

    // 6. 构建 uniforms 包装
    const uniforms = new WebGLUniforms(gl, program)

    return {
      program,
      uniforms,
      cacheKey: builtShader.cacheKey,
    }
  }

  // ===== 内部工具 =====

  /**
   * 编译单个着色器
   */
  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl
    const shader = gl.createShader(type)!

    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader)

      const typeName = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'
      console.error(
        `[LKA] WebGLPrograms: ${typeName} shader compile failed.\n${info}\n` + this.formatShaderSource(source),
      )

      gl.deleteShader(shader)
      return null
    }

    return shader
  }

  /**
   * 删除一个已编译的程序及其 GPU 资源
   */
  private deleteProgram(compiled: CompiledProgram): void {
    this.gl.deleteProgram(compiled.program)
  }

  /**
   * 格式化着色器源码用于错误诊断
   * 每行前添加行号
   */
  private formatShaderSource(source: string): string {
    const lines = source.split('\n')
    const width = String(lines.length).length

    return lines
      .map((line, i) => {
        const lineNum = String(i + 1).padStart(width, ' ')
        return lineNum + ': ' + line
      })
      .join('\n')
  }
}

export {WebGLPrograms}
