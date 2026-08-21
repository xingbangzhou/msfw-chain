import {Texture} from '../textures/Texture'
import {ImageProps, LayerBaseProps} from '../types'
import {renderLayerQuad} from '../renderers/renderLayer'
import {Drawer, DrawContext} from './Drawer'

type ImageLayerProps = LayerBaseProps & ImageProps

// 图层像素空间下的四边形：左上角 (0,0) 向右向下展开到 (w,-h)
function makePositions(w: number, h: number): number[] {
  return [0, 0, 0, w, 0, 0, 0, -h, 0, 0, -h, 0, w, 0, 0, w, -h, 0]
}

const TEXCOORDS = [0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = e => reject(e)
    image.src = url
  })
}

export class ImageDrawer extends Drawer {
  private texture: Texture | null = null
  private objectUrl: string | null = null
  private destroyed = false

  async init() {
    // 由 LayerView 在创建 Layer 后调用；这里通过 draw 时拿到的 layer 反查资源不方便，
    // 改为在首次 draw 时惰性加载。此处仅占位。
  }

  draw(context: DrawContext) {
    const layer = context.layer

    // 惰性加载纹理（首帧触发）
    if (this.texture === null && !this._loading) {
      this.loadTexture(context)
    }

    const texture = this.texture
    if (texture === null) return

    const width = layer.width
    const height = layer.height
    if (width <= 0 || height <= 0) return

    renderLayerQuad(context.layerView.renderer, {
      positions: makePositions(width, height),
      texcoords: TEXCOORDS,
      srcTexture: texture,
      matrix: layer.getRenderMatrix(),
      opacity: layer.opacity,
      blendMode: (layer.props as LayerBaseProps).blendMode,
      effects: (layer.props as LayerBaseProps).effects,
    })
  }

  dispose() {
    this.destroyed = true
    this.texture?.dispose()
    this.texture = null
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl)
      this.objectUrl = null
    }
  }

  private _loading = false

  private async loadTexture(context: DrawContext) {
    this._loading = true

    const layer = context.layer
    const props = layer.props as ImageLayerProps
    const state = context.layerView.state

    // 资源解析优先级：外部关键字替换 > 内嵌 Blob > content URL
    let url = ''
    const keyInfo = props.name ? state.getKeyInfo(props.name) : undefined
    if (keyInfo?.fromUser && typeof keyInfo.value === 'string' && keyInfo.value) {
      url = keyInfo.value
    }
    if (!url) {
      const blob = state.getSourceBlob(props.sourceId ?? props.id)
      if (blob) {
        this.objectUrl = URL.createObjectURL(blob)
        url = this.objectUrl
      } else if (props.content) {
        url = props.content
      }
    }
    if (!url) {
      this._loading = false
      return
    }

    try {
      const image = await loadImageElement(url)
      if (this.destroyed) return

      const canvas = this.drawToCanvas(image, layer.width, layer.height, props.fillMode)

      const texture = new Texture(canvas)
      texture.premultiplyAlpha = true
      texture.flipY = true
      texture.setImage(canvas)
      this.texture = texture
    } catch (err) {
      console.error('[LKA] ImageDrawer load failed:', url, err)
    } finally {
      this._loading = false
    }
  }

  // 依据 fillMode 把源图绘制到图层尺寸的画布中（与 YMat 行为一致）
  private drawToCanvas(image: HTMLImageElement, width: number, height: number, fillMode?: number) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width))
    canvas.height = Math.max(1, Math.round(height))
    const ctx = canvas.getContext('2d')
    if (!ctx) return canvas

    const iw = image.width
    const ih = image.height
    const srcRatio = iw / ih

    if (fillMode === 1) {
      // 长边对齐（cover）
      const isLead = width / height < srcRatio
      const drawWidth = !isLead ? width : height * srcRatio
      const drawHeight = isLead ? height : width / srcRatio
      const drawX = -(drawWidth - width) / 2
      const drawY = -(drawHeight - height) / 2
      ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight)
    } else if (fillMode === 2) {
      // 拉伸填充
      ctx.drawImage(image, 0, 0, width, height)
    } else {
      // 短边对齐（contain）
      const isLead = width / height < srcRatio
      const drawWidth = isLead ? width : height * srcRatio
      const drawHeight = !isLead ? height : width / srcRatio
      const drawX = (width - drawWidth) / 2
      const drawY = (height - drawHeight) / 2
      ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight)
    }

    return canvas
  }
}

