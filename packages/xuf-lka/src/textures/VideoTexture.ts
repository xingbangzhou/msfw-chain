import {LinearFilter} from '../constants'
import {Texture} from './Texture'

/**
 * VideoTexture — 视频纹理
 *
 * 从 HTMLVideoElement 创建，帧驱动自动更新。
 * 优先使用 requestVideoFrameCallback 帧驱动，降级为渲染器每帧调用 update()。
 */
export class VideoTexture extends Texture {
  readonly isVideoTexture = true

  constructor(
    video: HTMLVideoElement,
    mapping?: number,
    wrapS?: number,
    wrapT?: number,
    magFilter: number = LinearFilter,
    minFilter: number = LinearFilter,
    format?: number,
    type?: number,
    anisotropy?: number,
  ) {
    super(video, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy)

    // 视频每帧更新，mipmap 计算代价过高
    this.generateMipmaps = false
  }

  /**
   * 降级方案：无 requestVideoFrameCallback 时由渲染器每帧调用
   */
  update() {
    const video = this.source.data as unknown as HTMLVideoElement

    if (video.readyState >= video.HAVE_CURRENT_DATA) {
      this.source.needsUpdate = true
    }
  }

  dispose() {
    super.dispose()
  }
}
