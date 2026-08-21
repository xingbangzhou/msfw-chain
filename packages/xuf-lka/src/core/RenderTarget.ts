import {EventDispatcher} from './EventDispatcher'
import {ClampToEdgeWrapping, LinearFilter, RGBAFormat, UByteType} from '../constants'
import {Texture} from '../textures/Texture'

export interface RenderTargetOptions {
  /** color attachment 数据格式 */
  format?: number
  type?: number
  magFilter?: number
  minFilter?: number
  wrapS?: number
  wrapT?: number
  generateMipmaps?: boolean
}

export interface RenderTargetEventMap {
  dispose: object
}

/**
 * RenderTarget — 离屏渲染目标（Framebuffer 抽象）
 *
 * 持有一个作为 color attachment 的 Texture（可被后续 pass 采样）。
 * 面向 2D 合成，只有 color buffer，不含 depth/stencil。
 * Framebuffer 句柄本身不放在 Texture 上，而是由 WebGLTextures
 * 挂在本对象的 properties 里，保持
 * Source(数据) / Texture(采样) / RenderTarget(渲染目标) 三层解耦。
 */
export class RenderTarget extends EventDispatcher<RenderTargetEventMap> {
  readonly isRenderTarget = true

  width: number
  height: number

  /** color attachment，可作为普通纹理被采样 */
  texture: Texture

  /** 备用 color attachment，用于 ping-pong 双纹理 */
  private _swapTexture: Texture | null = null

  constructor(width = 1, height = 1, options: RenderTargetOptions = {}) {
    super()

    this.width = width
    this.height = height
    this.texture = this.createTexture(options)
  }

  /**
   * 交换当前 color attachment 与备用纹理，返回交换前的纹理供后续 pass 采样。
   */
  swap(): Texture {
    const texture = this.texture
    const swapTexture = this._swapTexture ?? this.createTextureFrom(texture)

    this.texture = swapTexture
    this._swapTexture = texture

    return texture
  }

  setSize(width: number, height: number): void {
    if (this.width === width && this.height === height) return

    this.width = width
    this.height = height

    // 尺寸变更需重新分配显存与 framebuffer
    this.dispose()
  }

  dispose(): void {
    this.dispatchEvent('dispose', {})

    if (this._swapTexture !== null) {
      this._swapTexture.dispose()
      this._swapTexture = null
    }
  }

  private createTexture(options: RenderTargetOptions): Texture {
    const texture = new Texture(
      null,
      undefined,
      options.wrapS ?? ClampToEdgeWrapping,
      options.wrapT ?? ClampToEdgeWrapping,
      options.magFilter ?? LinearFilter,
      options.minFilter ?? LinearFilter,
      options.format ?? RGBAFormat,
      options.type ?? UByteType,
    )

    texture.generateMipmaps = options.generateMipmaps ?? false
    texture.flipY = false
    texture.source.dataReady = false
    texture.isRenderTargetTexture = true

    return texture
  }

  private createTextureFrom(reference: Texture): Texture {
    const texture = new Texture(
      null,
      reference.mapping,
      reference.wrapS,
      reference.wrapT,
      reference.magFilter,
      reference.minFilter,
      reference.format,
      reference.type,
      reference.anisotropy,
      reference.colorSpace,
    )

    texture.generateMipmaps = reference.generateMipmaps
    texture.premultiplyAlpha = reference.premultiplyAlpha
    texture.flipY = false
    texture.unpackAlignment = reference.unpackAlignment
    texture.source.dataReady = false
    texture.isRenderTargetTexture = true

    return texture
  }
}
