import {Camera} from '../cameras/Camera'
import {LkaCamera} from '../cameras/LkaCamera'
import {Matrix4} from '../math/Matrix4'
import {Vector2} from '../math/Vector2'
import {Vector3} from '../math/Vector3'
import {PlayerState} from '../PlayerState'
import {WebGLRenderer} from '../renderers/WebGLRenderer'
import {LayerProps} from '../types'
import {RenderContext} from './Drawer'
import type {Layer} from './Layer'

const DEG2RAD = Math.PI / 180

export class LayerView {
  viewSize: Vector2
  // 视图偏移：把「左上角原点、y 向下」的图层坐标搬到「中心原点、y 向上」的相机空间
  viewOffset: Vector2
  // 2D 透视相机矩阵（P * V），图层像素坐标经此矩阵映射到裁剪空间
  cameraMatrix: Matrix4
  // 额外扩展3D相机
  lkaCamera: LkaCamera | null = null

  readonly renderer: WebGLRenderer
  readonly state: PlayerState

  protected camera: Camera
  protected childLayers: Layer[] | null = null

  constructor(renderer: WebGLRenderer, state: PlayerState) {
    this.renderer = renderer
    this.state = state

    this.camera = new Camera()
    this.viewSize = new Vector2()
    this.viewOffset = new Vector2()
    this.cameraMatrix = new Matrix4()
  }

  getCamera() {
    return this.camera
  }

  setViewSize(width: number, height: number) {
    this.viewSize.set(width, height)
    this.viewOffset.set(-width * 0.5, height * 0.5)

    if (!width || !height) return

    // 与 YMat 一致的透视相机：fov 40°，视点沿 +z 后退使图层按 1:1 像素铺满
    const fov = DEG2RAD * 40
    const aspect = width / height
    const zNear = 1
    const zFar = 20000

    const perspectiveMatrix = new Matrix4().makePerspectiveFromFov(40, aspect, zNear, zFar)

    const zFlat = (height / Math.tan(fov * 0.5)) * 0.5
    const eye = new Vector3(0, 0, zFlat)
    const target = new Vector3(0, 0, 0)
    const up = new Vector3(0, 1, 0)

    const cameraMatrix = this.cameraMatrix.makeTranslation(eye.x, eye.y, eye.z)
    cameraMatrix.lookAt(eye, target, up)
    cameraMatrix.invert()
    cameraMatrix.premultiply(perspectiveMatrix)
  }

  async initLayers(childProps: LayerProps[], viewInFrame: number, viewOutFrame: number) {
    // 动态导入 createLayer，打破 LayerView ↔ Layer ↔ Drawer 的模块循环初始化
    const {createLayer} = await import('./Layer')

    this.childLayers?.forEach(layer => layer.dispose())
    this.childLayers = null
    this.lkaCamera = null
    this.camera = new Camera()

    let endIdx = 0

    // 是否有3D相机
    if (childProps[0]?.type === 'camera') {
      const viewSize = this.viewSize
      this.lkaCamera = new LkaCamera({...childProps[0], width: viewSize.width, height: viewSize.height})
      this.camera = this.lkaCamera
      endIdx = 1
    }

    const childLayers = (this.childLayers = [])
    const newLayers: Layer[] = []
    for (let i = childProps.length - 1; i >= endIdx; i--) {
      const props = childProps[i]
      // 创建图层
      const outFrame = Math.min(viewOutFrame, props.outFrame ?? viewOutFrame)
      const layer = createLayer({...props, outFrame}, this)
      if (!layer) continue

      layer.viewInFrame = viewInFrame
      newLayers.push(layer)
    }

    await Promise.all(
      newLayers.map(
        layer =>
          new Promise(resolve => {
            layer.init().then(resolve)
          }),
      ),
    )

    // WARNING:异步重入安全对象清理
    if (childLayers !== this.childLayers) {
      newLayers.forEach(el => el.dispose())
    }
  }

  renderChildren() {
    const frameId = this.state.frameId

    this.lkaCamera?.update(frameId)

    const context: RenderContext = {
      frameId,
      camera: this.camera,
      layerView: this,
    }

    this.childLayers?.forEach(layer => layer.render(context))
  }
}
