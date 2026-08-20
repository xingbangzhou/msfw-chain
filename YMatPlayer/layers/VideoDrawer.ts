import {FillCoord, getFillCoord, ID2RGB} from '../math/mathUtils'
import {FrameInfo} from '../renderer/common/RenderStore'
import Texture from '../renderer/webgl/Texture'
import {WebGLRendererContext} from '../utils/shims'
import {LayerVideoProps} from '../types'
import {autoUrlHttp} from '../utils/common'
import Drawer from './BaseDrawer'
import {drawTexture, drawVideo} from '../renderer/common/primitives'
import {Matrix4} from '../math/Matrix4'
import {Vector3} from '../math/Vector3'
import VideoReader from '../core/video/VideoReader'
import {VIDEO_DECODE_WAIT_FRAME} from '../constant'
import Object3D from '../core/Object3D'

export default class VideoDrawer extends Drawer<LayerVideoProps> {
  constructor(ref: Object3D<LayerVideoProps>) {
    super(ref)

    this.defaultFillCoord = {
      lx: 0,
      ly: 0,
      rx: ref.props.isAlpha ? 0.5 : 1.0,
      ry: 1.0,
      sw: 1.0,
      sh: 1.0,
    }
    this.fillCoord = this.defaultFillCoord
  }

  private videoReader?: VideoReader

  private fillCoord: FillCoord
  private defaultFillCoord: FillCoord
  private drawMatrix = new Matrix4()

  // 同步记录
  private frameSyncDelta?: {frameId: number; num: number}

  get url() {
    const ref = this.ref
    const props = ref.props
    const url =
      autoUrlHttp((ref.store.getKeyInfo(props.name || '')?.value as string) || '') ||
      ref.store.getSource(props.sourceId || props.id) ||
      props.videoUrl ||
      ''

    return url
  }
  cacheUrl: string | Blob = ''
  isAlpha = false

  async init(gl: WebGLRendererContext) {
    const ref = this.ref
    const props = ref.props

    const url = this.url
    this.cacheUrl = url
    this.isAlpha = (ref.store.getKeyInfo(props.name || '')?.isAlpha ?? props.isAlpha) || false
    this.texture = new Texture(gl)

    if (url) {
      const frames = ref.props.outFrame - ref.props.inFrame
      const {frameRate, frameTime, disableDecoder} = ref.store

      this.videoReader = new VideoReader({uri: url, frameTime, frameRate, frames, disableDecoder, name: ref.props.name})
      if (ref.props.inFrame + ref.mainInFrame === 0) {
        ref.store.addFrameSync(this)
      }
      await this.videoReader.init()
    }
  }

  checkFrameSync(frameId: number) {
    if (!this.videoReader) return true

    const ref = this.ref
    frameId = ref.getFrameId(frameId - ref.mainInFrame)
    const flag = this.videoReader.checkFrame(frameId - ref.props.inFrame)
    // 判断为同步
    if (flag) {
      this.frameSyncDelta = undefined
      return true
    }
    // 帧不一样可以重新计算
    if (frameId !== this.frameSyncDelta?.frameId) {
      this.frameSyncDelta = {frameId, num: 1}
    }
    // 判断最多延迟同步MaxSyncNum次数
    this.frameSyncDelta.num += 1
    if (this.frameSyncDelta.num >= VIDEO_DECODE_WAIT_FRAME) {
      this.frameSyncDelta = undefined
      return true
    }
    ref.store.addFrameSync(this)
    return false
  }

  async draw(gl: WebGLRendererContext, matrix: Matrix4, frameInfo: FrameInfo) {
    const videoReader = this.videoReader
    if (!this.texture || !videoReader) return

    const ref = this.ref

    const props = ref.props
    const width = props.width
    const height = props.height
    const frameId = ref.getFrameId(frameInfo.frameId)
    const targetFrame = frameId - props.inFrame

    let videoTex = videoReader.prepare(targetFrame)
    if (videoTex) {
      const videoWidth = videoReader.getVideoWidth()
      const videoHeight = videoReader.getVideoHeight()

      if (videoWidth && videoHeight && this.fillCoord !== this.defaultFillCoord) {
        this.fillCoord = getFillCoord(videoWidth, videoHeight, width, height, props.fillMode, this.isAlpha)
      }

      this.texture.texImage2D(videoTex)
      videoTex = null
    }

    gl.activeTexture(gl.TEXTURE0)

    this.texture.bind()

    // 尺寸适配
    const {lx, ly, rx, ry, sw, sh} = this.fillCoord
    this.drawMatrix.multiplyMatrices(
      matrix,
      new Matrix4().makeTranslation(width * (1 - sw) * 0.5, -height * (1 - sh) * 0.5, 0),
    )
    this.drawMatrix.scale(new Vector3(sw, sh, 1.0))

    gl.uniformMatrix4fv(gl.uniforms.matrix, false, this.drawMatrix.elements)
    gl.uniform1i(gl.uniforms.isAlpha, this.isAlpha ? 1 : 0)

    drawVideo(
      this.getAttribBuffer(gl),
      width,
      height,
      {lx, ly, rx, ry},
      ref.hueSaturation,
      ref.brightness,
      ref.contrast,
    )

    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.uniform1i(gl.uniforms.isAlpha, 0)

    const nextFrame = targetFrame + 1
    videoReader.prepareNext(nextFrame)
    if (!videoReader.checkFrame(nextFrame)) {
      ref.store.addFrameSync(this)
    }
  }

  destroy() {
    super.destroy()

    this.videoReader?.destroy()
    this.videoReader = undefined
    this.frameSyncDelta = undefined
  }

  drawID(gl: WebGLRendererContext, matrix: Matrix4, frameInfo: FrameInfo): void {
    const texture = this.texture
    if (texture === null || !this.ref.id) return

    const ref = this.ref
    const width = ref.props.width
    const height = ref.props.height

    let rgbTexture = this.rgbTexture
    if (rgbTexture === null) {
      const rgb = ID2RGB(ref.id)
      rgbTexture = new Texture(gl)
      rgbTexture.texPixel2D(new Uint8Array([...rgb, 255]), 1, 1)
    }

    gl.activeTexture(gl.TEXTURE0)
    rgbTexture.bind()
    gl.activeTexture(gl.TEXTURE1)
    texture.bind()

    gl.uniform1i(gl.uniforms.isAlpha, this.isAlpha ? 1 : 0)
    gl.uniformMatrix4fv(gl.uniforms.matrix, false, this.drawMatrix.elements)

    drawTexture(this.getAttribBuffer(gl), width, height, undefined)

    gl.uniform1i(gl.uniforms.isAlpha, 0)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  checkReset(): void {
    this.videoReader?.prepare(0)
    this.checkFrameSync(0)
  }
}
