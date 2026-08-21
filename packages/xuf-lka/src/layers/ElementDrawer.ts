import {Texture} from '../textures/Texture'
import {renderLayerQuad} from '../renderers/renderLayer'
import {Drawer, DrawContext} from './Drawer'

// 图层像素空间四边形：左上角 (0,0) 向右/向下展开到 (w,-h)
export function quadPositions(w: number, h: number): number[] {
  return [0, 0, 0, w, 0, 0, 0, -h, 0, 0, -h, 0, w, 0, 0, w, -h, 0]
}

export const QUAD_TEXCOORDS = [0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]

// 颜色数组 → CSS rgba。兼容 0~1 与 0~255 两种取值区间。
export function toRGBA(color: number[] | undefined, opacity = 1): string {
  if (!color || color.length < 3) return `rgba(0,0,0,${opacity})`
  const max = Math.max(color[0], color[1], color[2])
  const scale = max <= 1 ? 255 : 1
  const r = Math.round(color[0] * scale)
  const g = Math.round(color[1] * scale)
  const b = Math.round(color[2] * scale)
  const a = (color.length > 3 ? color[3] : 1) * opacity
  return `rgba(${r},${g},${b},${a})`
}

/**
 * ElementDrawer — 基于 2D 画布的图层绘制基类
 *
 * 子类只需实现 paint()，把图层内容画到一张「图层尺寸」的 2D 画布上；
 * 基类负责上传为预乘纹理，并经 renderLayerQuad（lkaShader）上屏。
 */
export abstract class ElementDrawer extends Drawer {
  protected texture: Texture | null = null
  protected destroyed = false

  async init() {}

  /** 把图层内容绘制到 2D 画布；返回 false 表示无内容可绘制 */
  protected abstract paint(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    context: DrawContext,
  ): boolean

  /** 是否每帧重绘（如虚线偏移动画）。默认只画一次并缓存纹理。 */
  protected isDynamic(_context: DrawContext): boolean {
    return false
  }

  draw(context: DrawContext) {
    const layer = context.layer
    const width = layer.width
    const height = layer.height
    if (width <= 0 || height <= 0) return

    if (this.texture === null || this.isDynamic(context)) {
      this.updateTexture(context, width, height)
    }

    const texture = this.texture
    if (texture === null) return

    renderLayerQuad(context.layerView.renderer, {
      positions: quadPositions(width, height),
      texcoords: QUAD_TEXCOORDS,
      srcTexture: texture,
      matrix: layer.getRenderMatrix(),
      opacity: layer.opacity,
      blendMode: layer.props.blendMode,
      effects: layer.props.effects,
    })
  }

  dispose() {
    this.destroyed = true
    this.texture?.dispose()
    this.texture = null
  }

  private updateTexture(context: DrawContext, width: number, height: number) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width))
    canvas.height = Math.max(1, Math.round(height))

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (!this.paint(ctx, canvas.width, canvas.height, context)) return

    if (this.texture === null) {
      const texture = new Texture(canvas)
      texture.premultiplyAlpha = true
      texture.flipY = true
      this.texture = texture
    }
    this.texture.setImage(canvas)
  }
}
