import {MP4Decoder} from '../core/MP4Decoder/MP4Decoder'
import {LayerBaseProps, VideoProps} from '../types'
import {DrawContext} from './Drawer'
import {ElementDrawer} from './ElementDrawer'

type VideoLayerProps = LayerBaseProps & VideoProps

/**
 * VideoDrawer — 基于 WebCodecs（MP4Decoder）的视频图层绘制
 *
 * 用 MP4Decoder 按时间戳 seek 解码帧，逐帧把 VideoFrame 画到图层画布并上传纹理。
 * 支持左右分屏 alpha 视频（左半 RGB，右半灰度 alpha）：通过离屏画布把右半亮度写入 alpha 通道。
 */
export class VideoDrawer extends ElementDrawer {
  private decoder: MP4Decoder | null = null
  private loading = false
  private isAlpha = false
  private alphaCanvas: HTMLCanvasElement | null = null

  protected isDynamic(): boolean {
    return true
  }

  protected paint(ctx: CanvasRenderingContext2D, width: number, height: number, context: DrawContext): boolean {
    if (this.decoder === null && !this.loading) {
      this.setup(context)
    }
    const decoder = this.decoder
    if (decoder === null) return false

    const props = context.layer.props as VideoLayerProps
    const state = context.layerView.state
    const localFrame = Math.max(0, context.frameId - (props.inFrame || 0))
    const ms = (localFrame / (state.frameRate || 30)) * 1000

    const frame = decoder.seek(ms)
    if (!frame) return false

    const dispW = frame.displayWidth || frame.codedWidth
    const dispH = frame.displayHeight || frame.codedHeight

    if (this.isAlpha) {
      // 左半为颜色，右半为 alpha 灰度
      const halfW = dispW / 2
      // 颜色
      ctx.clearRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(frame, 0, 0, halfW, dispH, 0, 0, width, height)
      // alpha：把右半以 destination-in 应用（用亮度近似 alpha 需借助离屏，简化为直接乘）
      const mask = this.getAlphaMask(frame, halfW, dispH, width, height)
      if (mask) {
        ctx.globalCompositeOperation = 'destination-in'
        ctx.drawImage(mask, 0, 0)
        ctx.globalCompositeOperation = 'source-over'
      }
    } else {
      ctx.drawImage(frame, 0, 0, dispW, dispH, 0, 0, width, height)
    }
    return true
  }

  dispose() {
    super.dispose()
    this.decoder?.dispose()
    this.decoder = null
    this.alphaCanvas = null
  }

  private setup(context: DrawContext) {
    this.loading = true
    const props = context.layer.props as VideoLayerProps
    const state = context.layerView.state

    this.isAlpha = !!props.isAlpha

    const blob = state.getSourceBlob(props.sourceId ?? props.id)
    const source: string | Blob | undefined = blob || props.videoUrl || props.content
    if (!source) {
      this.loading = false
      return
    }

    try {
      this.decoder = new MP4Decoder(source)
    } catch (err) {
      console.error('[LKA] VideoDrawer: MP4Decoder init failed:', err)
    }
  }

  // 把右半灰度转换为「以亮度为 alpha」的遮罩画布
  private getAlphaMask(
    frame: VideoFrame,
    halfW: number,
    dispH: number,
    width: number,
    height: number,
  ): HTMLCanvasElement | null {
    const canvas = this.alphaCanvas || (this.alphaCanvas = document.createElement('canvas'))
    canvas.width = Math.max(1, Math.round(width))
    canvas.height = Math.max(1, Math.round(height))
    const c = canvas.getContext('2d')
    if (!c) return null

    c.clearRect(0, 0, canvas.width, canvas.height)
    c.drawImage(frame, halfW, 0, halfW, dispH, 0, 0, canvas.width, canvas.height)

    // 用亮度写入 alpha 通道
    const img = c.getImageData(0, 0, canvas.width, canvas.height)
    const data = img.data
    for (let i = 0; i < data.length; i += 4) {
      data[i + 3] = data[i] // 取 R 作为 alpha（灰度下 R≈G≈B）
      data[i] = data[i + 1] = data[i + 2] = 255
    }
    c.putImageData(img, 0, 0)
    return canvas
  }
}
