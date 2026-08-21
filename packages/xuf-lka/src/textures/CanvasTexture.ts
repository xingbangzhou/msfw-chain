import {Texture} from './Texture'

/**
 * CanvasTexture — 画布纹理
 *
 * 从 HTMLCanvasElement 创建，构造后立即可用。
 * 如需动态更新，手动设 `texture.needsUpdate = true`。
 */
export class CanvasTexture extends Texture {
  readonly isCanvasTexture = true

  constructor(
    canvas: HTMLCanvasElement,
    mapping?: number,
    wrapS?: number,
    wrapT?: number,
    magFilter?: number,
    minFilter?: number,
    format?: number,
    type?: number,
    anisotropy?: number,
  ) {
    super(canvas, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy)

    // 画布内容立即可用，标记首次上传
    this.markNeedsUpdate()
  }
}
