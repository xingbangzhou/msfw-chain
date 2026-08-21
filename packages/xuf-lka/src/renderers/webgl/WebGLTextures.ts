import {
  ClampToEdgeWrapping,
  FloatType,
  Float16Type,
  LinearFilter,
  LinearMipMapLinearFilter,
  LinearMipmapNearestFilter,
  MirroredRepeatWrapping,
  NearestFilter,
  NearestMipMapNearestFilter,
  NearestMipmapLinearFilter,
  RGBAFormat,
  RGBFormat,
  RGBAIntFormat,
  RedFormat,
  RedIntFormat,
  RGFormat,
  RGIntFormat,
  AlphaFormat,
  LuminanceFormat,
  LuminanceAlphaFormat,
  RepeatWrapping,
  UByteType,
  ByteType,
  ShortType,
  UShortType,
  IntType,
  UIntType,
  UShort4444Type,
  UShort5551Type,
  UInt248Type,
} from '../../constants'
import {Vector3} from '../../math/Vector3'
import type {Texture} from '../../textures/Texture'
import type {DataTexture} from '../../textures/DataTexture'
import type {VideoTexture} from '../../textures/VideoTexture'
import {RenderTarget} from '../../core/RenderTarget'
import type {TextureData} from '../../textures/Source'
import type {WebGLInfo} from './WebGLInfo'
import {WebGLProperties} from './WebGLProperties'

interface TextureProperties extends Record<string, unknown> {
  __webglTexture?: WebGLTexture
  __webglDisposeListener?: true
}

interface RenderTargetProperties extends Record<string, unknown> {
  __webglFramebuffer?: WebGLFramebuffer
  __webglDisposeListener?: true
}

const _size = /*@__PURE__*/ new Vector3()

/**
 * WebGLTextures — 纹理上传管线
 *
 * 职责：将 Texture/Source 的像素数据上传到 GPU，管理 WebGLTexture 生命周期。
 * - 基于 texture.needsUpdate / source.needsUpdate 标志决定是否重新配置/上传
 * - Image/Canvas/Video 走 HTML 元素上传分支，DataTexture 走 TypedArray 分支
 * - Video 纹理帧节流；DataTexture 支持局部更新
 */
export class WebGLTextures {
  private gl: WebGL2RenderingContext
  private properties: WebGLProperties
  private info: WebGLInfo

  private maxTextures: number
  private maxTextureSize: number

  /** Video 帧节流：texture → 上次更新的帧号 */
  private _videoTextures = new WeakMap<object, number>()

  /** 当前渲染帧号 */
  frame = 0

  /** 当前一轮 uniform 绑定中已分配的纹理单元数 */
  private _usedTextureUnits = 0

  constructor(
    gl: WebGL2RenderingContext,
    info: WebGLInfo,
    properties: WebGLProperties = new WebGLProperties(),
  ) {
    this.gl = gl
    this.properties = properties
    this.info = info

    this.maxTextures = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
  }

  private onTextureDispose = (event: {target: Texture | null}): void => {
    const texture = event.target
    if (texture === null) return

    texture.removeEventListener('dispose', this.onTextureDispose)
    this.dispose(texture)
  }

  private onRenderTargetDispose = (event: {target: RenderTarget | null}): void => {
    const renderTarget = event.target
    if (renderTarget === null) return

    renderTarget.removeEventListener('dispose', this.onRenderTargetDispose)
    this.disposeRenderTarget(renderTarget)
  }

  // ===== 纹理单元分配 =====

  /**
   * 重置纹理单元分配计数，应在每次 useProgram/绑定 uniform 之前调用
   */
  resetTextureUnits(): void {
    this._usedTextureUnits = 0
  }

  /**
   * 分配下一个可用纹理单元
   */
  allocateTextureUnit(): number {
    const unit = this._usedTextureUnits

    if (unit >= this.maxTextures) {
      console.warn(
        `[LKA] WebGLTextures: Trying to use ${unit + 1} texture units while this GPU supports only ${this.maxTextures}.`,
      )
    }

    this._usedTextureUnits += 1

    return unit
  }

  // ===== 入口 =====

  /**
   * 绑定纹理到指定纹理单元，必要时先上传数据
   */
  setTexture2D(texture: Texture, slot: number): void {
    const gl = this.gl
    const textureProps = this.properties.get<TextureProperties>(texture)

    // Video 纹理：帧节流
    if ((texture as VideoTexture).isVideoTexture) {
      this.updateVideoTexture(texture as VideoTexture)
    }

    if (texture.needsUpdate || texture.source.needsUpdate) {
      const image = texture.image

      if (image === null) {
        // RenderTarget 纹理由 setupRenderTarget 分配显存，无 image，直接绑定
        if (!texture.isRenderTargetTexture) {
          console.warn('[LKA] WebGLTextures: Texture marked for update but no image data found.')
        }
        texture.needsUpdate = false
      } else {
        this.uploadTexture(textureProps, texture, slot)
        return
      }
    }

    gl.activeTexture(gl.TEXTURE0 + slot)
    gl.bindTexture(gl.TEXTURE_2D, textureProps.__webglTexture ?? null)
  }

  /**
   * 释放纹理占用的 GPU 资源
   */
  dispose(texture: Texture): void {
    const textureProps = this.properties.get<TextureProperties>(texture)

    if (textureProps.__webglDisposeListener === true) {
      texture.removeEventListener('dispose', this.onTextureDispose)
    }

    if (textureProps.__webglTexture !== undefined) {
      this.gl.deleteTexture(textureProps.__webglTexture)
      this.info.memory.textures = Math.max(0, this.info.memory.textures - 1)
    }

    this.properties.remove(texture)
    this.properties.remove(texture.source)
  }

  // ===== RenderTarget（离屏渲染目标 / Framebuffer） =====

  /**
   * 为 RenderTarget 分配 color 纹理显存并创建 framebuffer，幂等。
   * Framebuffer 句柄挂在 RenderTarget 的 properties 上，而非 Texture。
   */
  setupRenderTarget(renderTarget: RenderTarget): void {
    const gl = this.gl
    const rtProps = this.properties.get<RenderTargetProperties>(renderTarget)

    if (rtProps.__webglDisposeListener !== true) {
      renderTarget.addEventListener('dispose', this.onRenderTargetDispose)
      rtProps.__webglDisposeListener = true
    }

    if (rtProps.__webglFramebuffer !== undefined) return

    const texture = renderTarget.texture
    const textureProps = this.properties.get<TextureProperties>(texture)

    // 1. 分配 color 纹理显存（data=null，只开空间不传数据）
    this.initTexture(texture, textureProps)
    gl.bindTexture(gl.TEXTURE_2D, textureProps.__webglTexture!)
    this.setTextureParameters(gl.TEXTURE_2D, texture)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      this.getInternalFormat(texture),
      renderTarget.width,
      renderTarget.height,
      0,
      this.formatToGL(texture.format),
      this.typeToGL(texture.type),
      null,
    )
    gl.bindTexture(gl.TEXTURE_2D, null)

    // 2. 创建 framebuffer 并挂 color attachment
    rtProps.__webglFramebuffer = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, rtProps.__webglFramebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textureProps.__webglTexture!, 0)

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.warn(`[LKA] WebGLTextures: Framebuffer incomplete (status 0x${status.toString(16)}).`)
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  /**
   * 重新将 RenderTarget 当前 texture 挂到 framebuffer，用于 ping-pong swap。
   */
  updateRenderTarget(renderTarget: RenderTarget): void {
    const gl = this.gl
    const rtProps = this.properties.get<RenderTargetProperties>(renderTarget)

    if (rtProps.__webglFramebuffer === undefined) {
      this.setupRenderTarget(renderTarget)
      return
    }

    const texture = renderTarget.texture
    const textureProps = this.properties.get<TextureProperties>(texture)

    this.initTexture(texture, textureProps)
    gl.bindTexture(gl.TEXTURE_2D, textureProps.__webglTexture!)
    this.setTextureParameters(gl.TEXTURE_2D, texture)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      this.getInternalFormat(texture),
      renderTarget.width,
      renderTarget.height,
      0,
      this.formatToGL(texture.format),
      this.typeToGL(texture.type),
      null,
    )
    gl.bindTexture(gl.TEXTURE_2D, null)

    gl.bindFramebuffer(gl.FRAMEBUFFER, rtProps.__webglFramebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textureProps.__webglTexture!, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  /**
   * 获取 RenderTarget 的 framebuffer 句柄，供 renderer 绑定
   */
  getFramebuffer(renderTarget: RenderTarget): WebGLFramebuffer | null {
    return this.properties.get<RenderTargetProperties>(renderTarget).__webglFramebuffer ?? null
  }

  /**
   * 释放 RenderTarget 的 framebuffer / color 纹理
   */
  disposeRenderTarget(renderTarget: RenderTarget): void {
    const gl = this.gl
    const rtProps = this.properties.get<RenderTargetProperties>(renderTarget)

    if (rtProps.__webglDisposeListener === true) {
      renderTarget.removeEventListener('dispose', this.onRenderTargetDispose)
    }

    if (rtProps.__webglFramebuffer !== undefined) {
      gl.deleteFramebuffer(rtProps.__webglFramebuffer)
    }

    this.properties.remove(renderTarget)
    this.dispose(renderTarget.texture)
  }

  // ===== 上传 =====

  private uploadTexture(textureProps: TextureProperties, texture: Texture, slot: number): void {
    const gl = this.gl

    // 1. 创建/复用 WebGLTexture
    this.initTexture(texture, textureProps)

    // 2. 绑定
    gl.activeTexture(gl.TEXTURE0 + slot)
    gl.bindTexture(gl.TEXTURE_2D, textureProps.__webglTexture!)

    const source = texture.source
    const needsUpload = source.needsUpdate

    // 3. 像素存储参数（每次上传都要设置，因为是全局状态）
    if (needsUpload) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, texture.flipY ? 1 : 0)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, texture.premultiplyAlpha ? 1 : 0)
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, texture.unpackAlignment)
    }

    // 4. 采样参数
    this.setTextureParameters(gl.TEXTURE_2D, texture)

    // 5. 上传像素数据。DataTexture 支持 data=null，只分配显存不上传像素。
    if (needsUpload) {
      const isDataTexture = (texture as DataTexture).isDataTexture

      if (source.dataReady || isDataTexture) {
        this.uploadPixels(texture)

        if (texture.generateMipmaps && this.canGenerateMipmaps(texture)) {
          gl.generateMipmap(gl.TEXTURE_2D)
        }
      }

      source.needsUpdate = false
    }

    texture.needsUpdate = false
  }

  /**
   * 按类型分发上传：DataTexture 传 TypedArray，其他传 HTML 元素
   */
  private uploadPixels(texture: Texture): void {
    const gl = this.gl
    const target = gl.TEXTURE_2D
    const glFormat = this.formatToGL(texture.format)
    const glType = this.typeToGL(texture.type)
    const internalFormat = this.getInternalFormat(texture)

    if ((texture as DataTexture).isDataTexture) {
      const image = texture.image as unknown as TextureData
      const width = image.width
      const height = image.height

      gl.texImage2D(target, 0, internalFormat, width, height, 0, glFormat, glType, image.data)
    } else {
      let image = texture.image as TexImageSource
      image = this.resizeImage(image)

      gl.texImage2D(target, 0, internalFormat, glFormat, glType, image)
    }
  }

  // ===== WebGLTexture 生命周期 =====

  private initTexture(texture: Texture, textureProps: TextureProperties): void {
    if (textureProps.__webglDisposeListener !== true) {
      texture.addEventListener('dispose', this.onTextureDispose)
      textureProps.__webglDisposeListener = true
    }

    if (textureProps.__webglTexture === undefined) {
      textureProps.__webglTexture = this.gl.createTexture()!
      this.info.memory.textures++
    }
  }

  private setTextureParameters(target: number, texture: Texture): void {
    const gl = this.gl

    gl.texParameteri(target, gl.TEXTURE_WRAP_S, this.wrapToGL(texture.wrapS))
    gl.texParameteri(target, gl.TEXTURE_WRAP_T, this.wrapToGL(texture.wrapT))

    gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, this.filterToGL(texture.magFilter))
    gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, this.filterToGL(texture.minFilter))
  }

  // ===== Video 帧节流 =====

  private updateVideoTexture(texture: VideoTexture): void {
    const frame = this.frame

    // 每个渲染帧只更新一次
    if (this._videoTextures.get(texture) !== frame) {
      this._videoTextures.set(texture, frame)
      texture.update()
    }
  }

  // ===== 尺寸限制 =====

  /**
   * 超过 maxTextureSize 时缩放（仅 Image/Canvas/Bitmap）
   */
  private resizeImage(image: TexImageSource): TexImageSource {
    const width = (image as {width?: number}).width ?? 0
    const height = (image as {height?: number}).height ?? 0

    const maxSize = this.maxTextureSize
    if (width <= maxSize && height <= maxSize) return image

    const scale = maxSize / Math.max(width, height)
    const newWidth = Math.floor(width * scale)
    const newHeight = Math.floor(height * scale)

    if (
      typeof HTMLImageElement !== 'undefined' &&
      (image instanceof HTMLImageElement ||
        image instanceof HTMLCanvasElement ||
        (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap))
    ) {
      const canvas = document.createElement('canvas')
      canvas.width = newWidth
      canvas.height = newHeight

      const ctx = canvas.getContext('2d')!
      ctx.drawImage(image as CanvasImageSource, 0, 0, newWidth, newHeight)

      console.warn(`[LKA] WebGLTextures: Texture resized from (${width}x${height}) to fit maxTextureSize.`)

      return canvas
    }

    console.warn('[LKA] WebGLTextures: Image too big and cannot be resized.')
    return image
  }

  private canGenerateMipmaps(texture: Texture): boolean {
    texture.source.getSize(_size)
    return this.isPowerOfTwo(_size.x) && this.isPowerOfTwo(_size.y)
  }

  private isPowerOfTwo(value: number): boolean {
    return (value & (value - 1)) === 0 && value !== 0
  }

  // ===== 常量映射 =====

  private wrapToGL(wrap: number): number {
    const gl = this.gl
    switch (wrap) {
      case RepeatWrapping:
        return gl.REPEAT
      case MirroredRepeatWrapping:
        return gl.MIRRORED_REPEAT
      case ClampToEdgeWrapping:
      default:
        return gl.CLAMP_TO_EDGE
    }
  }

  private filterToGL(filter: number): number {
    const gl = this.gl
    switch (filter) {
      case NearestFilter:
        return gl.NEAREST
      case NearestMipMapNearestFilter:
        return gl.NEAREST_MIPMAP_NEAREST
      case NearestMipmapLinearFilter:
        return gl.NEAREST_MIPMAP_LINEAR
      case LinearFilter:
        return gl.LINEAR
      case LinearMipmapNearestFilter:
        return gl.LINEAR_MIPMAP_NEAREST
      case LinearMipMapLinearFilter:
      default:
        return gl.LINEAR_MIPMAP_LINEAR
    }
  }

  private formatToGL(format: number): number {
    const gl = this.gl
    switch (format) {
      case AlphaFormat:
        return gl.ALPHA
      case RGBFormat:
        return gl.RGB
      case RGBAFormat:
        return gl.RGBA
      case LuminanceFormat:
        return gl.LUMINANCE
      case LuminanceAlphaFormat:
        return gl.LUMINANCE_ALPHA
      case RedFormat:
        return gl.RED
      case RedIntFormat:
        return gl.RED_INTEGER
      case RGFormat:
        return gl.RG
      case RGIntFormat:
        return gl.RG_INTEGER
      case RGBAIntFormat:
        return gl.RGBA_INTEGER
      default:
        return gl.RGBA
    }
  }

  private typeToGL(type: number): number {
    const gl = this.gl
    switch (type) {
      case UByteType:
        return gl.UNSIGNED_BYTE
      case ByteType:
        return gl.BYTE
      case ShortType:
        return gl.SHORT
      case UShortType:
        return gl.UNSIGNED_SHORT
      case IntType:
        return gl.INT
      case UIntType:
        return gl.UNSIGNED_INT
      case FloatType:
        return gl.FLOAT
      case Float16Type:
        return gl.HALF_FLOAT
      case UShort4444Type:
        return gl.UNSIGNED_SHORT_4_4_4_4
      case UShort5551Type:
        return gl.UNSIGNED_SHORT_5_5_5_1
      case UInt248Type:
        return gl.UNSIGNED_INT_24_8
      default:
        return gl.UNSIGNED_BYTE
    }
  }

  /**
   * 根据 format + type 推导 sized internal format（WebGL2）
   */
  private getInternalFormat(texture: Texture): number {
    const gl = this.gl
    const format = texture.format
    const type = texture.type

    if (format === RGBAFormat) {
      if (type === FloatType) return gl.RGBA32F
      if (type === Float16Type) return gl.RGBA16F
      return gl.RGBA8
    }

    if (format === RGBFormat) {
      if (type === FloatType) return gl.RGB32F
      if (type === Float16Type) return gl.RGB16F
      return gl.RGB8
    }

    if (format === RedFormat) {
      if (type === FloatType) return gl.R32F
      if (type === Float16Type) return gl.R16F
      return gl.R8
    }

    // 非 sized 格式回退到与 format 相同的枚举
    return this.formatToGL(format)
  }
}
