import Framebuffer from '../renderer/webgl/Framebuffer'
import {WebGLRendererContext} from '../utils/shims'
import {LayerImageProps, LayerProps, LayerTextProps, LayerType, LayerVideoProps, TrackMatteType} from '../types'
import BaseDrawer from './BaseDrawer'
import RenderStore, {FrameInfo} from '../renderer/common/RenderStore'
import {drawSimpleTexture} from '../renderer/common/primitives'
import LayerView from './LayerView'
import TextDrawer from './TextDrawer'
import VideoDrawer from './VideoDrawer'
import ImageDrawer from './ImageDrawer'
import VectorDrawer from './VectorDrawer'
import ShapeDrawer from './ShapeDrawer'
import {Matrix4, identMat4} from '../math/Matrix4'
import Object3D from '../core/Object3D'
import SolidDrawer from './SolidDrawer'
import RectDrawer from './RectDrawer'
import EllipseDrawer from './EllipseDrawer'
import PathDrawer from './PathDrawer'

export default class Layer<Drawer extends BaseDrawer = BaseDrawer> extends Object3D {
  constructor(props: LayerProps, store: RenderStore, view: LayerView, DrawerClass: new (...args: any) => Drawer) {
    super(props, store)

    this.view = view
    this.drawer = new DrawerClass(this)

    if (props.clickAble) this.clickAble = true
  }

  readonly view: LayerView

  // 不建议外部使用
  public drawer: BaseDrawer

  private _framebuffer: Framebuffer | null = null
  private _trackLayer: Layer | null = null
  private _maskFramebuffer: Framebuffer | null = null

  set trackLayer(layer: Layer | null) {
    this._trackLayer = layer
  }

  // 视图偏移
  get viewOffset() {
    return this.view.viewOffset
  }

  async init(gl: WebGLRendererContext) {
    let drawer = this.drawer
    // 初始化
    await drawer.init(gl)

    // 如果在异步区间触发了Reset，导致drawer发生变更，则原来需要释放掉
    if (drawer !== this.drawer) {
      drawer.destroy()
      drawer = null as any
    }
  }

  async reset(gl: WebGLRendererContext) {
    this._trackLayer?.reset(gl)

    const type = this.type
    if (type === LayerType.Text) {
      // 文本
      const textDrawer = this.drawer as TextDrawer
      if (textDrawer.cacheText !== textDrawer.text) {
        // 如果文本不一样，就需要重新初始化一下
        await textDrawer.init(gl)
      }
      return
    }
    if (type === LayerType.Image || type === LayerType.Video) {
      // 图片、视频
      let drawer = this.drawer as ImageDrawer | VideoDrawer
      if (drawer.cacheUrl !== drawer.url) {
        const keyInfo = this.store.getKeyInfo(this.props.name || '')
        const newType = keyInfo?.type || type
        if (newType === LayerType.Video) {
          drawer.destroy()
          this.props.type = newType as LayerType.Video
          drawer = new VideoDrawer(this as unknown as Object3D<LayerVideoProps>)
          await drawer.init(gl)
          this.drawer = drawer
        } else {
          await drawer.init(gl)
        }
      }
      return
    }
    if (type === LayerType.Vector) {
      const vectorDrawer = this.drawer as VectorDrawer
      const subLayers = vectorDrawer.childLayers
      if (subLayers) {
        for (const subLayer of subLayers) {
          await subLayer.reset(gl)
        }
      }
    }
  }

  render(gl: WebGLRendererContext, parentMatrix: Matrix4, frameInfo: FrameInfo) {
    const frameId = frameInfo.frameId
    const worldMatrix = this.updateWorldMatrix(frameId, parentMatrix, this.view.camera3D)
    if (!worldMatrix) return

    if (this.drawMaskBlend(gl, worldMatrix, frameInfo, parentMatrix)) return

    const opacity = this.getOpacity(frameId, frameInfo.opacity)
    gl.uniform1f(gl.uniforms.opacity, opacity)

    this.drawer.draw(gl, worldMatrix, frameInfo)

    gl.uniform1f(gl.uniforms.opacity, 1.0)
  }

  destroy() {
    super.destroy()

    this._framebuffer?.destory()
    this._framebuffer = null
    this._maskFramebuffer?.destory()
    this._maskFramebuffer = null

    this.drawer.destroy()

    this._trackLayer?.destroy()
    this._trackLayer = null
  }

  renderID(gl: WebGLRendererContext, parentMatrix: Matrix4, frameInfo: FrameInfo) {
    const worldMatrix = this.worldMatrix
    if (worldMatrix === null) return

    const opacity = this.getOpacity(frameInfo.frameId, frameInfo.opacity)

    const maskFramebuffer = this._maskFramebuffer
    if (maskFramebuffer) {
      const {width: parentWidth, height: parentHeight, framebuffer: parentFramebuffer} = frameInfo

      const attribBuffer = this.drawer.getAttribBuffer(gl)

      // 预先绘制图层
      const framebuffer = this._framebuffer || (this._framebuffer = new Framebuffer(gl))
      framebuffer.bind()
      framebuffer.viewport(parentWidth, parentHeight)
      this.drawer.drawID(gl, worldMatrix, {
        ...frameInfo,
        framebuffer: framebuffer,
      })

      parentFramebuffer.bind()
      gl.activeTexture(gl.TEXTURE0)
      framebuffer.texture?.bind()
      gl.activeTexture(gl.TEXTURE1)
      maskFramebuffer.texture?.bind()

      gl.uniformMatrix4fv(gl.uniforms.matrix, false, identMat4)
      gl.uniform1f(gl.uniforms.opacity, 1.0)
      gl.uniform1i(gl.uniforms.maskMode, this.props.trackMatteType || TrackMatteType.None)

      drawSimpleTexture(attribBuffer)

      gl.bindTexture(gl.TEXTURE_2D, null)
      gl.uniform1i(gl.uniforms.maskMode, 0)

      return
    }

    gl.uniform1f(gl.uniforms.opacity, opacity)
    this.drawer.drawID(gl, worldMatrix, frameInfo)
  }

  checkReset() {
    const drawer = this.drawer
    drawer.checkReset()
  }

  private drawMaskBlend(gl: WebGLRendererContext, matrix: Matrix4, frameInfo: FrameInfo, parentMatrix: Matrix4) {
    const blendMode = this.blendMode
    if (!blendMode && !this._trackLayer) return false

    const {frameId, width: parentWidth, height: parentHeight, framebuffer: parentFramebuffer} = frameInfo

    const attribBuffer = this.drawer.getAttribBuffer(gl)

    // 预先绘制图层
    const framebuffer = this._framebuffer || (this._framebuffer = new Framebuffer(gl))

    framebuffer.bind()
    framebuffer.viewport(parentWidth, parentHeight)

    const opacity = this.getOpacity(frameId, frameInfo.opacity)
    gl.uniform1f(gl.uniforms.opacity, opacity)

    this.drawer.draw(gl, matrix, {
      ...frameInfo,
      framebuffer: framebuffer,
    })

    gl.uniform1f(gl.uniforms.opacity, 1.0)

    this.drawMask(gl, frameInfo, parentMatrix, framebuffer)

    if (blendMode) {
      // Blend
      const dstTexture = parentFramebuffer.reset()
      parentFramebuffer.bind()
      parentFramebuffer.viewport(parentWidth, parentHeight)

      gl.activeTexture(gl.TEXTURE0)
      framebuffer.texture?.bind()
      gl.activeTexture(gl.TEXTURE1)
      dstTexture?.bind()

      gl.uniformMatrix4fv(gl.uniforms.matrix, false, identMat4)
      gl.uniform1i(gl.uniforms.blendMode, blendMode)

      drawSimpleTexture(attribBuffer)

      dstTexture?.destroy()
      gl.uniform1i(gl.uniforms.blendMode, 0)
      gl.bindTexture(gl.TEXTURE_2D, null)
    } else {
      // 普通模式
      parentFramebuffer.bind()
      gl.activeTexture(gl.TEXTURE0)
      framebuffer.texture?.bind()
      gl.uniform1f(gl.uniforms.opacity, 1.0)
      gl.uniformMatrix4fv(gl.uniforms.matrix, false, identMat4)

      drawSimpleTexture(attribBuffer)
    }

    return true
  }

  private drawMask(gl: WebGLRendererContext, frameInfo: FrameInfo, parentMatrix: Matrix4, framebuffer: Framebuffer) {
    const parentWidth = frameInfo.width
    const parentHeight = frameInfo.height
    const attribBuffer = this.drawer.getAttribBuffer(gl)
    const maskFramebuffer = this._maskFramebuffer || (this._maskFramebuffer = new Framebuffer(gl))
    // 绘制TrackLayer
    const trackLayer = this._trackLayer
    if (trackLayer) {
      maskFramebuffer.bind()
      maskFramebuffer.viewport(parentWidth, parentHeight)

      trackLayer.render(gl, parentMatrix, {
        ...frameInfo,
        framebuffer: maskFramebuffer,
      })

      // 合并
      const srcTexture = framebuffer.reset()
      framebuffer.bind()
      framebuffer.viewport(parentWidth, parentHeight)

      gl.activeTexture(gl.TEXTURE0)
      srcTexture?.bind()
      gl.activeTexture(gl.TEXTURE1)
      maskFramebuffer.texture?.bind()

      gl.uniformMatrix4fv(gl.uniforms.matrix, false, identMat4)
      gl.uniform1i(gl.uniforms.maskMode, this.props.trackMatteType || TrackMatteType.None)

      drawSimpleTexture(attribBuffer)

      srcTexture?.destroy()
      gl.bindTexture(gl.TEXTURE_2D, null)
      gl.uniform1i(gl.uniforms.maskMode, 0)
    }
  }
}

export const createLayer = (props: LayerProps, store: RenderStore, view: LayerView) => {
  // 预合成
  if ((props.type as string) === LayerType.PreComposition) {
    const compProps = store.getCompLayer(props.sourceId || props.id)
    if (compProps) {
      const {id, sourceId, type, ...other} = props
      props = {...compProps, ...other, id, sourceId} as LayerProps
    }
  }

  const propsType = props.type as string
  switch (propsType) {
    case LayerType.Text: {
      store.addLayerKeyInfo(props as LayerTextProps)
      return new Layer(props, store, view, TextDrawer)
    }
    case LayerType.Image:
    case LayerType.Video: {
      store.addLayerKeyInfo(props as LayerVideoProps | LayerImageProps)
      const kv = store.getKeyInfo(props.name || '')
      const type = kv?.type || propsType

      return type === LayerType.Video
        ? new Layer(props, store, view, VideoDrawer)
        : new Layer(props, store, view, ImageDrawer)
    }
    case LayerType.Vector:
      return new Layer(props, store, view, VectorDrawer)
    case LayerType.ShapeLayer:
      return new Layer(props, store, view, ShapeDrawer)
    case LayerType.Solid:
      return new Layer(props, store, view, SolidDrawer)
    case LayerType.Rect:
      return new Layer(props, store, view, RectDrawer)
    case LayerType.Ellipse:
      return new Layer(props, store, view, EllipseDrawer)
    case LayerType.Path:
      return new Layer(props, store, view, PathDrawer)
  }

  return null
}
