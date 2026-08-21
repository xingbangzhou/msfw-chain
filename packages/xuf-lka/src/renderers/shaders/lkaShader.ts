import {ShaderBuilder} from './ShaderBuilder'
import common from './chunks/common.glsl'
import mask_pars_fragment from './chunks/mask_pars_fragment.glsl'
import mask_fragment from './chunks/mask_fragment.glsl'
import blend_pars_fragment from './chunks/blend_pars_fragment.glsl'
import blend_fragment from './chunks/blend_fragment.glsl'
import hsbc_pars_fragment from './chunks/hsbc_pars_fragment.glsl'
import hsbc_fragment from './chunks/hsbc_fragment.glsl'
import vertexShader from './chunks/ymat_vertex.glsl'
import fragmentShader from './chunks/ymat_fragment.glsl'
import {Matrix4} from '../../math/Matrix4'

/**
 * 注册主着色器所需的所有 GLSL 代码片段
 */
export function registerChunks(builder: ShaderBuilder): void {
  const chunks = builder.chunks

  chunks.register('common', common)
  chunks.register('mask_pars_fragment', mask_pars_fragment)
  chunks.register('mask_fragment', mask_fragment)
  chunks.register('blend_pars_fragment', blend_pars_fragment)
  chunks.register('blend_fragment', blend_fragment)
  chunks.register('hsbc_pars_fragment', hsbc_pars_fragment)
  chunks.register('hsbc_fragment', hsbc_fragment)
}

// ===== 构建选项与 API =====

export function createShaderBuilder(): ShaderBuilder {
  const builder = new ShaderBuilder()

  registerChunks(builder)

  // 纹理采样与全局状态
  builder.uniforms.register('common', {
    srcTexture: {value: null},
    dstTexture: {value: null},
    opacity: {value: 1.0},
    isAlpha: {value: 0},
    grapMode: {value: 0},
  })

  // 遮罩与混合
  builder.uniforms.register('mask_blend', {
    maskMode: {value: 0},
    blendMode: {value: 0},
  })

  // 颜色调整
  builder.uniforms.register('color_adjust', {
    colorize: {value: 0},
    hsl: {value: {x: 0.0, y: 0.0, z: 0.0}},
    brtCnt: {value: {x: 0.0, y: 0.0}},
  })

  // 顶点
  builder.uniforms.register('vertex', {
    matrix: {value: new Matrix4()},
  })

  return builder
}

/** 全部功能 defines（所有混合模式 + 色相饱和度 + 亮度对比度） */
const ALL_DEFINES: Record<string, boolean> = {
  USE_HSBC: true,
  USE_BLEND: true,
}

export function buildShader(builder: ShaderBuilder) {
  return builder.build(vertexShader, fragmentShader, {
    defines: ALL_DEFINES,
    uniformGroups: ['vertex', 'common', 'mask_blend', 'color_adjust'],
  })
}
