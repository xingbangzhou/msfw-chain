import {EventDispatcher} from '../core/EventDispatcher'
import {Matrix3} from '../math/Matrix3'
import {Vector2} from '../math/Vector2'
import {Vector3} from '../math/Vector3'
import {generateUUID} from '../math/MathUtils'
import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipMapLinearFilter,
  NoColorSpace,
  RGBAFormat,
  UByteType,
  UVMapping,
} from '../constants'
import {Source, type SourceData} from './Source'

let _textureId = 0

const _tempVec3 = /*@__PURE__*/ new Vector3()

export interface TextureEventMap {
  dispose: object
}

/**
 * Texture — 采样参数的封装
 *
 * 持有 wrap / filter / UV 变换等采样参数，通过 `this.source` 引用实际数据（Source）。
 * 数据与采样参数解耦，多个 Texture 可共享同一个 Source。
 */
export class Texture extends EventDispatcher<TextureEventMap> {
  readonly isTexture = true

  readonly id: number = _textureId++
  readonly uuid: string = generateUUID()

  name = ''

  /** 数据定义 */
  source: Source

  /** 手动 mipmap */
  mipmaps: unknown[] = []

  /** 是否为 RenderTarget 的 color attachment（只分配显存、不上传像素） */
  isRenderTargetTexture = false

  // ---- 采样参数 ----
  mapping: number
  wrapS: number
  wrapT: number
  magFilter: number
  minFilter: number
  format: number
  type: number
  colorSpace: string

  // ---- UV 变换 ----
  offset = new Vector2(0, 0)
  repeat = new Vector2(1, 1)
  center = new Vector2(0, 0)
  rotation = 0
  matrixAutoUpdate = true
  matrix = new Matrix3()

  // ---- GPU 上传控制 ----
  generateMipmaps = false
  premultiplyAlpha = false
  flipY = true
  unpackAlignment = 4

  /** 采样参数是否需要重新配置到 GPU */
  needsUpdate = false

  constructor(
    image: SourceData = null,
    mapping: number = UVMapping,
    wrapS: number = ClampToEdgeWrapping,
    wrapT: number = ClampToEdgeWrapping,
    magFilter: number = LinearFilter,
    minFilter: number = LinearMipMapLinearFilter,
    format: number = RGBAFormat,
    type: number = UByteType,
    colorSpace: string = NoColorSpace,
  ) {
    super()

    this.source = new Source(image)

    this.mapping = mapping
    this.wrapS = wrapS
    this.wrapT = wrapT
    this.magFilter = magFilter
    this.minFilter = minFilter
    this.format = format
    this.type = type
    this.colorSpace = colorSpace
  }

  get image(): SourceData {
    return this.source.data
  }

  set image(value: SourceData) {
    this.source.data = value
  }

  get width(): number {
    return this.source.getSize(_tempVec3).x
  }

  get height(): number {
    return this.source.getSize(_tempVec3).y
  }

  updateMatrix() {
    this.matrix.setUvTransform(
      this.offset.x,
      this.offset.y,
      this.repeat.x,
      this.repeat.y,
      this.rotation,
      this.center.x,
      this.center.y,
    )
  }

  setImage(image: SourceData): this {
    this.image = image
    this.source.dataReady = image !== null
    this.markNeedsUpdate()

    return this
  }

  /**
   * 标记纹理需要重新配置/上传，同时标记 source 需要重新上传数据
   */
  markNeedsUpdate() {
    this.needsUpdate = true
    this.source.needsUpdate = true
  }

  dispose() {
    this.dispatchEvent('dispose', {})
  }
}
