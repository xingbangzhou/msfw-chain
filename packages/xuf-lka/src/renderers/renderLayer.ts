import {Matrix4} from '../math/Matrix4'
import type {Texture} from '../textures/Texture'
import {BlendMode, EffectsProps} from '../types'
import {buildShader, createShaderBuilder} from './shaders'
import type {BuiltShader} from './shaders/ShaderBuilder'
import type {WebGLRenderer} from './WebGLRenderer'

/**
 * 图层统一绘制入口（lkaShader）
 *
 * 用主着色器 lkaShader 绘制单个图层四边形，落地与 YMat 一致的能力：
 * 全局透明度、色相/饱和度、亮度/对比度（HSBC）。
 *
 * 中性默认值（无 effects、blendMode=None）下，片元输出即 `srcColor * opacity`（纯纹理采样），
 * 因此对普通图层零回归。
 *
 * blend(混合模式) 走 `compositeBlend`：图层先画进自身的 RenderTarget（src），
 * 再与背景（dst）做全屏合成，与 YMat 的 framebuffer swap 方案一致。
 * mask(轨道遮罩) / grap(拾取) 仍未落地，maskMode/grapMode 传 0。
 */

// 全屏合成用四边形（裁剪空间，z=0）
const FULLSCREEN_POSITIONS = [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0]
const FULLSCREEN_TEXCOORDS = [0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]
const IDENTITY = /*@__PURE__*/ new Matrix4()

let _lkaShader: BuiltShader | null = null

function getLkaShader(): BuiltShader {
  if (_lkaShader === null) {
    _lkaShader = buildShader(createShaderBuilder())
  }
  return _lkaShader
}

export interface LayerRenderParams {
  positions: ArrayLike<number>
  texcoords: ArrayLike<number>
  srcTexture: Texture
  matrix: Matrix4
  opacity: number
  isAlpha?: boolean
  blendMode?: BlendMode
  effects?: EffectsProps
}

export function renderLayerQuad(renderer: WebGLRenderer, p: LayerRenderParams) {
  const shader = getLkaShader()

  const bri = p.effects?.bri_con
  const hs = p.effects?.hue_sat

  // 与 YMat 一致的效果 uniform 映射：
  // - colorize: 0=不启用；1=着色；2=覆盖色相
  // - hsl: x=hue, y=saturation, z=lightness
  // - brtCnt: x=brightness, y=contrast（brightness==0 时着色器直接返回原色）
  const uniforms: Record<string, unknown> = {
    matrix: p.matrix,
    srcTexture: p.srcTexture,
    opacity: p.opacity,
    isAlpha: p.isAlpha ? 1 : 0,
    grapMode: 0,
    blendMode: BlendMode.None,
    maskMode: 0,
    colorize: hs ? (hs.colorize ? 2 : 1) : 0,
    hsl: hs ? {x: hs.hue ?? 0, y: hs.saturation ?? 0, z: hs.brightness ?? 0} : {x: 0, y: 0, z: 0},
    brtCnt: bri ? {x: bri.brightness ?? 0, y: bri.contrast ?? 0} : {x: 0, y: 0},
  }

  renderer.renderQuad(shader, p.positions, p.texcoords, uniforms)
}

/**
 * 混合合成：将已渲染到自身 RenderTarget 的图层（srcTexture）按 blendMode 与背景
 * （dstTexture）做全屏合成，输出到当前绑定的 RenderTarget。
 *
 * 对应 lkaShader 的 `blendRGBA(src)`：读取 dstTexture 完成整幅合成后覆盖写入，
 * 故此全屏 quad 覆盖整个缓冲、不受图层包围盒限制。
 */
export function compositeBlend(
  renderer: WebGLRenderer,
  srcTexture: Texture,
  dstTexture: Texture,
  blendMode: BlendMode,
) {
  renderer.renderQuad(getLkaShader(), FULLSCREEN_POSITIONS, FULLSCREEN_TEXCOORDS, {
    matrix: IDENTITY,
    srcTexture,
    dstTexture,
    opacity: 1.0,
    isAlpha: 0,
    grapMode: 0,
    maskMode: 0,
    blendMode,
    colorize: 0,
    hsl: {x: 0, y: 0, z: 0},
    brtCnt: {x: 0, y: 0},
  })
}
