import {ShaderChunkRegistry, IncludeResolver} from './ShaderLib'
import {UniformsLib, type UniformMap} from './UniformsLib'

export type ShaderStage = 'vertex' | 'fragment'
export type ShaderVariant = Record<string, string | number | boolean>

/**
 * 构建产物
 */
export interface BuiltShader {
  vertex: string
  fragment: string
  uniforms: UniformMap
  cacheKey: string
}

// ===== Step 1: generatePrecision =====
// 参考 three.js generatePrecision — 按精度参数生成全量 sampler 精度声明

export type Precision = 'highp' | 'mediump' | 'lowp'

export function generatePrecision(p: Precision = 'highp'): string {
  return `
precision ${p} float;
precision ${p} int;
precision ${p} sampler2D;
precision ${p} samplerCube;
precision ${p} sampler2DArray;
precision ${p} sampler2DShadow;
precision ${p} samplerCubeShadow;
precision ${p} sampler2DArrayShadow;
precision ${p} isampler2D;
precision ${p} isampler3D;
precision ${p} isamplerCube;
precision ${p} isampler2DArray;
precision ${p} usampler2D;
precision ${p} usampler3D;
precision ${p} usamplerCube;
precision ${p} usampler2DArray;`.trim()
}

// ===== Step 2: generateDefines =====
// 参考 three.js generateDefines — 将 defines 对象转为 #define 行

export function generateDefines(defines: ShaderVariant): string {
  const lines: string[] = []
  for (const [name, value] of Object.entries(defines)) {
    if (value === false) continue
    lines.push('#define ' + name + ' ' + (value === true ? '' : value))
  }
  return lines.join('\n')
}

// ===== Step 3: buildPrefix =====
// 参考 three.js prefixVertex/prefixFragment — defines + GLSL 300 es 别名 + 内置声明

export function buildPrefix(stage: ShaderStage, precision: Precision, definesString: string): string {
  const precisionBlock = generatePrecision(precision)

  if (stage === 'vertex') {
    return (
      precisionBlock +
      '\n' +
      definesString +
      '\n' +
      `#define attribute in
#define varying out
#define texture2D texture
#define textureCube texture
#define texture2DProj textureProj
#define texture2DLod textureLod
#define textureCubeLod textureLod
#define texture2DGrad textureGrad
#define texture2DProjGrad textureProjGrad
#define textureCubeGrad textureGrad
`
    )
  }

  return (
    precisionBlock +
    '\n' +
    definesString +
    '\n' +
    `#define varying in
layout(location = 0) out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
#define gl_FragDepthEXT gl_FragDepth
#define texture2D texture
#define textureCube texture
#define texture2DProj textureProj
#define texture2DLodEXT textureLod
#define texture2DProjLodEXT textureProjLod
#define textureCubeLodEXT textureLod
#define texture2DGradEXT textureGrad
#define texture2DProjGradEXT textureProjGrad
#define textureCubeGradEXT textureGrad
`
  )
}

// ===== Step 5: unrollLoops =====
// 参考 three.js unrollLoops — 静态展开 GLSL 循环
// GLSL ES 不支持动态循环上界，需在 JS 侧展开
//
// 用法:
// #pragma unroll_loop_start
// for (int i = 0; i < 3; i++) { ... }
// #pragma unroll_loop_end

const unrollLoopPattern =
  /#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*\{([\s\S]+?)\}\s+#pragma unroll_loop_end/g

export function unrollLoops(source: string): string {
  return source.replace(unrollLoopPattern, (_match, startStr, endStr, snippet) => {
    let result = ''
    const start = parseInt(startStr)
    const end = parseInt(endStr)

    for (let i = start; i < end; i++) {
      result += snippet.replace(/\[\s*i\s*\]/g, '[ ' + i + ' ]').replace(/UNROLLED_LOOP_INDEX/g, String(i))
    }

    return result
  })
}

// ===== Step 6: replacePlaceholders =====
// 参考 three.js replaceLightNums — 替换占位符为运行时数值
// 通用版本：替换 #{name} 占位符

export function replacePlaceholders(source: string, values: Record<string, string | number>): string {
  let result = source
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll('#{' + key + '}', String(value))
  }
  return result
}

// ===== ShaderBuilder — 构建流水线 =====
// 参考 three.js WebGLProgram 构造函数的完整流程

export class ShaderBuilder {
  readonly chunks: ShaderChunkRegistry
  readonly uniforms: UniformsLib
  private _resolver: IncludeResolver

  constructor() {
    this.chunks = new ShaderChunkRegistry()
    this.uniforms = new UniformsLib()
    this._resolver = new IncludeResolver(this.chunks)
  }

  /**
   * 构建着色器
   *
   * 流程（参考 three.js WebGLProgram）:
   * 1. 合并 uniform 分组
   * 2. generatePrecision
   * 3. generateDefines
   * 4. buildPrefix（GLSL 300 es 别名 + 内置声明）
   * 5. resolveIncludes（递归解析 #include）
   * 6. unrollLoops（静态展开 #pragma unroll_loop）
   * 7. replacePlaceholders（替换 #{name} 占位符）
   * 8. 清理重复 precision 声明
   * 9. 组装最终源码：version + prefix + resolvedSource
   * 10. 生成缓存 key
   */
  build(
    vertexShader: string,
    fragmentShader: string,
    options: {
      defines?: ShaderVariant
      uniformGroups?: Array<string | UniformMap>
      precision?: Precision
      placeholders?: Record<string, string | number>
    } = {},
  ): BuiltShader {
    const {defines = {}, uniformGroups = [], precision = 'highp', placeholders = {}} = options

    // 1. 合并 uniform 分组
    const mergedUniforms = this.uniforms.merge(uniformGroups)

    // 2. 生成 defines 字符串
    const definesString = generateDefines(defines)

    // 3. 构建 prefix
    const vertexPrefix = buildPrefix('vertex', precision, definesString)
    const fragmentPrefix = buildPrefix('fragment', precision, definesString)

    // 4. 解析 #include（递归）
    let resolvedVertex = this._resolver.resolve(vertexShader)
    let resolvedFragment = this._resolver.resolve(fragmentShader)

    // 5. 静态展开循环
    resolvedVertex = unrollLoops(resolvedVertex)
    resolvedFragment = unrollLoops(resolvedFragment)

    // 6. 替换占位符
    resolvedVertex = replacePlaceholders(resolvedVertex, placeholders)
    resolvedFragment = replacePlaceholders(resolvedFragment, placeholders)

    // 7. 清理与 prefix 重复的 precision 声明
    resolvedVertex = cleanupPrecision(resolvedVertex)
    resolvedFragment = cleanupPrecision(resolvedFragment)

    // 8. 组装最终源码
    const finalVertex = '#version 300 es\n' + vertexPrefix + resolvedVertex
    const finalFragment = '#version 300 es\n' + fragmentPrefix + resolvedFragment

    // 9. 生成缓存 key
    const cacheKey = this.buildCacheKey(defines, placeholders)

    return {
      vertex: finalVertex,
      fragment: finalFragment,
      uniforms: mergedUniforms,
      cacheKey,
    }
  }

  /**
   * 生成缓存 key
   */
  buildCacheKey(defines: ShaderVariant, placeholders: Record<string, string | number> = {}): string {
    const parts: string[] = []
    for (const key of Object.keys(defines).sort()) {
      parts.push(key + '=' + defines[key])
    }
    for (const key of Object.keys(placeholders).sort()) {
      parts.push('#' + key + '=' + placeholders[key])
    }
    return parts.join('|')
  }
}

/** 清理与 prefix 重复的 precision 声明 */
function cleanupPrecision(source: string): string {
  return source.replace(/^precision\s+(lowp|mediump|highp)\s+float\s*;\s*\n?/gm, '')
}
