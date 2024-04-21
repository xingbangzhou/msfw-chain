import {NavLink} from 'react-router-dom'
import PlayData from '../PlayData'
import {drawSimpleTexture, drawTexture, Framebuffer, m4, ThisWebGLContext} from '../base'
import {
  BlendMode,
  FrameInfo,
  LayerImageProps,
  LayerProps,
  LayerShapeProps,
  LayerTextProps,
  LayerType,
  LayerVectorProps,
  LayerVideoProps,
  PreComposition,
  TrackMatteType,
} from '../types'
import AbstractDrawer from './AbstractDrawer'
import ImageDrawer from './ImageDrawer'
import ShapeDrawer from './ShapeDrawer'
import TextDrawer from './TextDrawer'
import VectorDrawer from './VectorDrawer'
import VideoDrawer from './VideoDrawer'
import {setMaskProgram, setProgram} from './setPrograms'

export default class Layer {
  constructor(drawer: AbstractDrawer<LayerProps>) {
    this.drawer = drawer
  }

  private drawer: AbstractDrawer<LayerProps>
  private _framebuffer: Framebuffer | null = null

  // 遮罩
  private _maskLayer?: Layer
  private _maskFramebuffer?: Framebuffer | null = null

  get type() {
    return this.drawer.props.type
  }

  get width() {
    return this.drawer.width
  }

  get height() {
    return this.drawer.height
  }

  get inFrame() {
    return this.drawer.inFrame
  }

  get outFrame() {
    return this.drawer.outFrame
  }

  verifyTime(frameId: number) {
    return frameId >= this.inFrame && frameId <= this.outFrame
  }

  async init(gl: ThisWebGLContext, parentLayers?: LayerProps[]) {
    // 遮罩对象
    const trackMatteType = this.drawer.trackMatteType
    const trackId = this.drawer.props.trackMatteLayer
    if (trackMatteType != TrackMatteType.None && trackId && parentLayers) {
      const trackProps = parentLayers.find(el => el.id == trackId)
      if (trackProps) {
        this._maskLayer = createLayer(trackProps, this.drawer.playData)
      }
    }
    // 初始化
    await this.drawer.init(gl)
    await this._maskLayer?.init(gl)
  }

  render(gl: ThisWebGLContext, parentMatrix: m4.Mat4, frameInfo: FrameInfo) {
    const drawer = this.drawer
    const localMatrix = drawer.getMatrix(frameInfo)
    if (!localMatrix) return
    const opacity = drawer.getOpacity(frameInfo)

    if (this.drawMaskBlend(gl, {localMatrix, opacity}, frameInfo, parentMatrix)) return

    setProgram(gl)
    gl.uniform1f(gl.uniforms.opacity, opacity)
    const matrix = m4.multiply(parentMatrix, localMatrix)
    drawer.draw(gl, matrix, frameInfo)
  }

  destroy(gl?: ThisWebGLContext) {
    this._framebuffer?.destory()
    this._maskFramebuffer?.destory()

    this._maskLayer?.destroy(gl)
    this.drawer.destroy(gl)
  }

  // private drawMask(
  //   maskLayer: Layer,
  //   gl: ThisWebGLContext,
  //   state: {localMatrix: m4.Mat4; opacity: number},
  //   frameInfo: FrameInfo,
  //   parentMatrix: m4.Mat4,
  // ) {
  //   const {localMatrix, opacity} = state
  //   const {width: parentWidth, height: parentHeight, framebuffer: parentFramebuffer} = frameInfo

  //   const framebuffer = this._framebuffer || new Framebuffer(gl)
  //   this._framebuffer = framebuffer
  //   const maskFramebuffer = this._maskFramebuffer || new Framebuffer(gl)
  //   this._maskFramebuffer = maskFramebuffer

  //   // 绘制纹理
  //   framebuffer.bind()
  //   framebuffer.viewport(parentWidth, parentHeight)
  //   let matrix = m4.perspectiveCamera(parentWidth, parentHeight)
  //   matrix = m4.multiply(matrix, localMatrix)
  //   this.drawer.draw(gl, matrix, {
  //     ...frameInfo,
  //     framebuffer: framebuffer,
  //   })

  //   // 遮罩纹理
  //   maskFramebuffer.bind()
  //   maskFramebuffer.viewport(parentWidth, parentHeight)
  //   maskLayer.render(gl, parentMatrix, {
  //     ...frameInfo,
  //     framebuffer: maskFramebuffer,
  //   })

  //   // 合并纹理
  //   parentFramebuffer.bind()
  //   setMaskProgram(gl, this.drawer.trackMatteType)

  //   gl.activeTexture(gl.TEXTURE0)
  //   gl.bindTexture(gl.TEXTURE_2D, framebuffer.texture)
  //   gl.activeTexture(gl.TEXTURE1)
  //   gl.bindTexture(gl.TEXTURE_2D, maskFramebuffer.texture)
  //   gl.uniform1f(gl.uniforms.opacity, opacity)
  //   gl.uniformMatrix4fv(gl.uniforms.matrix, false, parentMatrix)

  //   drawTexture(gl, parentWidth, parentHeight, true)

  //   // 释放
  //   gl.bindTexture(gl.TEXTURE_2D, null)
  // }

  private drawMaskBlend(
    gl: ThisWebGLContext,
    state: {localMatrix: m4.Mat4; opacity: number},
    frameInfo: FrameInfo,
    parentMatrix: m4.Mat4,
  ) {
    const blendMode = this.drawer.blendMode
    const maskLayer = this._maskLayer
    if (!blendMode && !maskLayer) return false

    const {localMatrix, opacity} = state
    const {width: parentWidth, height: parentHeight, framebuffer: parentFramebuffer} = frameInfo

    // 默认着色器
    setProgram(gl)

    // 预先绘制图层
    const framebuffer = this._framebuffer || new Framebuffer(gl)
    this._framebuffer = framebuffer

    framebuffer.bind()
    framebuffer.viewport(parentWidth, parentHeight)
    let matrix = m4.perspectiveCamera(parentWidth, parentHeight)
    matrix = m4.multiply(matrix, localMatrix)
    this.drawer.draw(gl, matrix, {
      ...frameInfo,
      framebuffer: framebuffer,
    })

    // 绘制遮罩层
    if (maskLayer) {
      const maskFramebuffer = this._maskFramebuffer || new Framebuffer(gl)
      this._maskFramebuffer = maskFramebuffer

      maskFramebuffer.bind()
      maskFramebuffer.viewport(parentWidth, parentHeight)
      maskLayer.render(gl, parentMatrix, {
        ...frameInfo,
        framebuffer: maskFramebuffer,
      })

      // 遮罩着色器
      setMaskProgram(gl, this.drawer.trackMatteType)
      const texutre0 = framebuffer.reset()
      framebuffer.bind()
      framebuffer.viewport(parentWidth, parentHeight)

      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texutre0)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, maskFramebuffer.texture)

      drawSimpleTexture(gl)
      gl.bindTexture(gl.TEXTURE_2D, null)
    }

    // 绘制到父Framebuffer
    setProgram(gl)
    parentFramebuffer.bind()

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, framebuffer.texture)
    gl.uniform1f(gl.uniforms.opacity, opacity)
    gl.uniformMatrix4fv(gl.uniforms.matrix, false, parentMatrix)

    drawTexture(gl, parentWidth, parentHeight, true)
    gl.bindTexture(gl.TEXTURE_2D, null)

    return true
  }
}

export function createLayer(props: LayerProps, playData: PlayData) {
  const {id, type, ...other} = props
  if (type === PreComposition) {
    const compProps = playData.getLayerByComps(id)
    if (!compProps) return undefined
    props = {...compProps, ...other}
  }

  const curType = props.type
  switch (curType) {
    case LayerType.Image:
      return new Layer(new ImageDrawer(props as LayerImageProps, playData))
    case LayerType.Video:
      return new Layer(new VideoDrawer(props as LayerVideoProps, playData))
    case LayerType.Text:
      return new Layer(new TextDrawer(props as LayerTextProps, playData))
    case LayerType.Vector:
      return new Layer(new VectorDrawer(props as LayerVectorProps, playData))
    case LayerType.ShapeLayer:
      return new Layer(new ShapeDrawer(props as LayerShapeProps, playData))
  }

  return undefined
}
