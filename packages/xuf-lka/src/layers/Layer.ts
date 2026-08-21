import {Object3D} from '../core/Object3D'
import {RenderTarget} from '../core/RenderTarget'
import {Transform3D} from '../core/Transform3D'
import {Matrix4} from '../math/Matrix4'
import {Quaternion} from '../math/Quaternion'
import {Vector3} from '../math/Vector3'
import {compositeBlend} from '../renderers/renderLayer'
import {BlendMode, LayerProps} from '../types'
import {DrawerConstructor, DrawerLike, RenderContext} from './Drawer'
import {EllipseDrawer} from './EllipseDrawer'
import {ImageDrawer} from './ImageDrawer'
import type {LayerView} from './LayerView'
import {PathDrawer} from './PathDrawer'
import {RectDrawer} from './RectDrawer'
import {ShapeDrawer} from './ShapeDrawer'
import {SolidDrawer} from './SolidDrawer'
import {TextDrawer} from './TextDrawer'
import {VectorDrawer} from './VectorDrawer'
import {VideoDrawer} from './VideoDrawer'

const DEG2RAD = Math.PI / 180

const _anchorMatrix = /*@__PURE__*/ new Matrix4()
const _renderMatrix = /*@__PURE__*/ new Matrix4()
const _q1 = /*@__PURE__*/ new Quaternion()
const _xAxis = /*@__PURE__*/ new Vector3(1, 0, 0)
const _yAxis = /*@__PURE__*/ new Vector3(0, 1, 0)
const _zAxis = /*@__PURE__*/ new Vector3(0, 0, 1)

export class Layer<D extends DrawerLike = DrawerLike> extends Object3D {
  constructor(props: LayerProps, layerView: LayerView, DrawerClass: DrawerConstructor<D>) {
    super()

    this.props = props
    this.layerView = layerView
    this.transform = new Transform3D(props.transform)
    this._DrawerClass = DrawerClass
    this._drawer = new DrawerClass(layerView.renderer, layerView.state)

    // 采集图层效果信息，供着色器裁剪/编译；并缓存 props 供拾取反查
    const state = layerView.state
    state.enableBlend(props.blendMode)
    const bri_con = props.effects?.bri_con
    if (bri_con) {
      state.enableBrightnessContrast((bri_con.brightness || 0) !== 0 || (bri_con.contrast || 0) !== 0)
    }
    if (props.effects?.hue_sat) {
      state.enableHueSat(true)
    }
    state.setLayerProps(props.id, props)
  }

  // 视图的帧率偏移
  viewInFrame = 0

  readonly props: LayerProps
  readonly layerView: LayerView
  readonly transform: Transform3D

  private _drawer: D
  private _DrawerClass: DrawerConstructor<D>
  // 混合模式用的离屏图层目标（仅 blendMode 图层分配）
  private _blendRT: RenderTarget | null = null
  // 当前帧的透明度（0~1）
  private _opacity = 1

  get type() {
    return this.props.type
  }

  get width() {
    return this.props.width
  }

  get height() {
    return this.props.height
  }

  /** 当前帧透明度（render 时更新） */
  get opacity() {
    return this._opacity
  }

  /**
   * 当前帧最终变换矩阵：相机矩阵(P*V) * 世界矩阵。
   * 用于把图层「像素空间」的四边形顶点映射到裁剪空间。
   */
  getRenderMatrix() {
    return _renderMatrix.multiplyMatrices(this.layerView.cameraMatrix, this.matrixWorld)
  }

  async init() {
    await this._drawer.init()
  }

  /** 内容/关键字变化后重建绘制器（drawer 惰性加载时会读取最新的 key 覆盖） */
  async reset() {
    this._drawer.dispose()
    this._drawer = new this._DrawerClass(this.layerView.renderer, this.layerView.state)
    await this._drawer.init()
  }

  get drawer() {
    return this._drawer
  }

  render(context: RenderContext) {
    const frameId = context.frameId - this.viewInFrame

    if (frameId < this.props.inFrame || frameId >= this.props.outFrame) {
      return
    }

    this._opacity = this.transform.getOpacity(frameId)
    this.updateFrameMatrix(frameId)

    const blendMode = this.props.blendMode
    if (blendMode) {
      this.renderBlended(context, blendMode)
    } else {
      this._drawer.draw({...context, layer: this})
    }
  }

  /**
   * 混合模式渲染（与 YMat framebuffer swap 一致）：
   * 1) 图层先画进自身 RenderTarget（src，含 HSBC 等效果）；
   * 2) 交换主 RenderTarget 取出背景（dst），再全屏 compositeBlend 合成回主 RT。
   */
  private renderBlended(context: RenderContext, blendMode: BlendMode) {
    const renderer = this.layerView.renderer
    const mainRT = renderer.getRenderTarget()
    const width = this.layerView.state.width
    const height = this.layerView.state.height

    // 无离屏主目标或尺寸无效时，退化为普通绘制
    if (!mainRT || width <= 0 || height <= 0) {
      this._drawer.draw({...context, layer: this})
      return
    }

    const layerRT = this._blendRT || (this._blendRT = new RenderTarget(width || 1, height || 1))
    layerRT.setSize(width, height)

    // 1) 图层单独渲染到自身 RT
    renderer.setRenderTarget(layerRT)
    renderer.clear(true)
    this._drawer.draw({...context, layer: this})

    // 2) 取主 RT 的既有内容作为 dst，全屏合成回主 RT
    renderer.setRenderTarget(mainRT)
    const dstTexture = renderer.swapRenderTarget(mainRT)
    if (dstTexture) {
      compositeBlend(renderer, layerRT.texture, dstTexture, blendMode)
    }
  }

  dispose() {
    this._drawer.dispose()
    this._blendRT?.dispose()
    this._blendRT = null
  }

  private updateFrameMatrix(frameId: number) {
    const position = this.transform.getPosition(frameId)
    const scale = this.transform.getScale(frameId)
    const anchorPoint = this.transform.getAnchorPoint(frameId)

    // 与 YMat 一致：叠加视图偏移并翻转 y/z，把「左上角原点、y 向下」映射到「中心原点、y 向上」
    const viewOffset = this.layerView.viewOffset
    this.position.set(
      (position?.x ?? 0) + viewOffset.x,
      -(position?.y ?? 0) + viewOffset.y,
      -(position?.z ?? 0),
    )
    this.scale.set((scale?.x ?? 100) * 0.01, (scale?.y ?? 100) * 0.01, (scale?.z ?? 100) * 0.01)
    this.quaternion.identity()

    const orientation = this.transform.getOrientation(frameId)
    this.applyRotation(orientation.x, _xAxis)
    this.applyRotation(orientation.y, _yAxis)
    this.applyRotation(orientation.z, _zAxis)
    this.applyRotation(this.transform.getRotationX(frameId), _xAxis)
    this.applyRotation(this.transform.getRotationY(frameId), _yAxis)
    this.applyRotation(this.transform.getRotationZ(frameId), _zAxis)

    this.updateMatrix()

    if (anchorPoint) {
      this.matrix.multiply(_anchorMatrix.makeTranslation(-anchorPoint.x, anchorPoint.y, anchorPoint.z))
    }

    this.matrixWorldNeedsUpdate = true
    this.updateMatrixWorld(true)
  }

  private applyRotation(degrees: number, axis: Vector3) {
    if (degrees === 0) return

    this.quaternion.multiply(_q1.setFromAxisAngle(axis, degrees * DEG2RAD))
  }
}

export const createLayer = (props: LayerProps, layerView: LayerView) => {
  // 预合成处理
  if (props.type === 'precomposition') {
    const compProps = layerView.state.getCompLayerProps(props.id)
    if (compProps) {
      const {id, sourceId, type, ...other} = props
      props = {...compProps, ...other, id, sourceId}
    }
  }
  switch (props.type) {
    case 'text':
      layerView.state.addLayerKeyInfo(props)
      return new Layer(props, layerView, TextDrawer)
    case 'image':
    case 'video': {
      layerView.state.addLayerKeyInfo(props)
      // 关键字可将图片替换为视频（或反之），据此选择绘制器
      const keyType = layerView.state.getKeyInfo(props.name || '')?.type || props.type
      return keyType === 'video'
        ? new Layer(props, layerView, VideoDrawer)
        : new Layer(props, layerView, ImageDrawer)
    }
    case 'Solid':
      return new Layer(props, layerView, SolidDrawer)
    case 'vector':
      return new Layer(props, layerView, VectorDrawer)
    case 'ShapeLayer':
      return new Layer(props, layerView, ShapeDrawer)
    case 'Rect':
      return new Layer(props, layerView, RectDrawer)
    case 'Ellipse':
      return new Layer(props, layerView, EllipseDrawer)
    case 'Path':
      return new Layer(props, layerView, PathDrawer)
  }
}
