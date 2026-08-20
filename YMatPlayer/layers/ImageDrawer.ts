import Texture from '../renderer/webgl/Texture'
import {WebGLRendererContext} from '../utils/shims'
import {LayerImageProps} from '../types'
import {autoUrlHttp, loadImage} from '../utils/common'
import Drawer from './BaseDrawer'
import {FrameInfo} from '../renderer/common/RenderStore'
import {drawTexture} from '../renderer/common/primitives'
import {Matrix4} from '../math/Matrix4'
import {createCanvas, getContext2D} from '../utils/canvas'

export default class ImageDrawer extends Drawer<LayerImageProps> {
  get url() {
    const ref = this.ref
    const store = ref.store
    const props = ref.props

    return (
      autoUrlHttp((store.getKeyInfo(props.name || '')?.value as string) || '') ||
      store.getSource(props.sourceId || props.id) ||
      props.content ||
      ''
    )
  }
  cacheUrl: string | Blob = ''

  async init(gl: WebGLRendererContext) {
    const url = this.url
    if (!url) return

    const ref = this.ref

    loadImage(url)
      .then(image => {
        if (!image) return
        const imageWidth = image.width
        const imageHeight = image.height
        const width = ref.props.width
        const height = ref.props.height

        let canvas = createCanvas(width, height)
        let ctx = getContext2D(canvas)
        if (ref.props.fillMode === 1) {
          // 长边对齐
          const isLead = width / height < imageWidth / imageHeight
          const drawWidth = !isLead ? width : height * (imageWidth / imageHeight)
          const drawHeight = isLead ? height : width / (imageWidth / imageHeight)
          const drawX = -(drawWidth - width) / 2
          const drawY = -(drawHeight - height) / 2
          ctx?.drawImage(image, drawX, drawY, drawWidth, drawHeight)
        } else if (ref.props.fillMode === 2) {
          // 平铺
          ctx?.drawImage(image, 0, 0, width, height)
        } else {
          // 短边对齐
          const isLead = width / height < imageWidth / imageHeight
          const drawWidth = isLead ? width : height * (imageWidth / imageHeight)
          const drawHeight = !isLead ? height : width / (imageWidth / imageHeight)
          const drawX = (width - drawWidth) / 2
          const drawY = (height - drawHeight) / 2
          ctx?.drawImage(image, drawX, drawY, drawWidth, drawHeight)
        }
        if (this.isDestroied) {
          // 如果图层已经释放掉了
          throw 'ImageDrawer is destroid: ' + url
        }

        if (!this.texture) {
          this.texture = new Texture(gl)
        }
        this.texture.texImage2D(<TexImageSource>canvas)
        ;(<ImageBitmap>image)?.close?.()
        ctx = null
        canvas = null as any
        this.cacheUrl = url
      })
      .catch(err => {
        console.error(url, err)
      })
  }

  draw(gl: WebGLRendererContext, matrix: Matrix4, frameInfo: FrameInfo) {
    if (!this.texture) return
    const ref = this.ref

    gl.activeTexture(gl.TEXTURE0)
    this.texture.bind()
    gl.uniformMatrix4fv(gl.uniforms.matrix, false, matrix.elements)

    drawTexture(
      this.getAttribBuffer(gl),
      ref.props.width,
      ref.props.height,
      undefined,
      ref.hueSaturation,
      ref.brightness,
      ref.contrast,
    )
  }
}
