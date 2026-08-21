import {generateUUID} from '../math/MathUtils'
import {Vector3} from '../math/Vector3'

let _sourceId = 0

/**
 * DataTexture 使用的结构化数据形态
 */
export interface TextureData {
  data: ArrayBufferView | null
  width: number
  height: number
  depth?: number
}

export type SourceData = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap | TextureData | null

/**
 * Source — 纹理原始数据的封装
 *
 * 只关心「数据是什么、多大、是否需要更新」，与采样参数（Texture）解耦。
 * 多个 Texture 可共享同一个 Source（如精灵表场景），避免重复存储数据。
 */
export class Source {
  readonly isSource = true

  readonly id: number = _sourceId++
  readonly uuid: string = generateUUID()

  /** 原始数据：HTML 元素 / ImageBitmap / {data, width, height} */
  data: SourceData

  /** false = 只分配 GPU 内存，不传输数据 */
  dataReady = true

  /** 数据是否需要重新上传到 GPU */
  needsUpdate = false

  constructor(data: SourceData = null) {
    this.data = data
  }

  /**
   * 统一尺寸查询，兼容所有数据类型
   */
  getSize(target = new Vector3()): Vector3 {
    const data = this.data

    if (typeof HTMLVideoElement !== 'undefined' && data instanceof HTMLVideoElement) {
      target.set(data.videoWidth, data.videoHeight, 0)
    } else if (data !== null) {
      const d = data as {width: number; height: number; depth?: number}
      target.set(d.width, d.height, d.depth || 0)
    } else {
      target.set(0, 0, 0)
    }

    return target
  }
}
