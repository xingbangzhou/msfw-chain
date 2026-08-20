import {DEG2RAD} from '../math/mathUtils'
import {Matrix4} from '../math/Matrix4'
import {Vector3} from '../math/Vector3'
import RenderStore from '../renderer/common/RenderStore'
import {WebGLRendererContext} from '../utils/shims'
import {LayerCameraProps, LayerProps, LayerType} from '../types'
import Camera3D from '../core/Camera3D'
import Layer, {createLayer} from './Layer'
import {Vector2} from '../math/Vector2'
/**
 * 视图类，含有多个子图层
 */

export default class LayerView {
  constructor() {}

  cameraMatrix = new Matrix4()

  viewSize = new Vector2()
  viewOffset = new Vector2()

  camera3D: Camera3D | null = null
  childLayers: Layer[] | null = null

  isDestroied = false

  setViewSize(w: number, h: number, isShape?: boolean) {
    this.viewSize.width = w
    this.viewSize.height = h
    if (w && h && !isShape) {
      const fov = DEG2RAD * 40
      const aspect = w / h
      const zNear = 1
      const zFar = 20000

      const perspectiveMatrix = new Matrix4().makePerspective(fov, aspect, zNear, zFar)

      const zFlat = (h / Math.tan(fov * 0.5)) * 0.5
      const eye = new Vector3(0, 0, zFlat)
      const target = new Vector3(0, 0, 0)
      const up = new Vector3(0, 1, 0)
      const cameraMatrix = this.cameraMatrix.makeTranslation(eye.x, eye.y, eye.z)
      cameraMatrix.lookAt(eye, target, up)
      cameraMatrix.invert()
      cameraMatrix.premultiply(perspectiveMatrix)

      this.cameraMatrix = cameraMatrix
    }
  }

  async initLayers(
    layerProps: LayerProps[],
    gl: WebGLRendererContext,
    store: RenderStore,
    inFrame: number,
    outFrame: number,
  ) {
    this.clearLayers()
    // WARNING:标记当前图层列表
    const childLayers = (this.childLayers = []) as Layer[]

    let end = 0
    // 相机处理
    const cameraProps = layerProps[0] as any as LayerCameraProps
    if (cameraProps?.type === LayerType.Camera) {
      if (cameraProps.enabled !== 2) {
        this.camera3D = new Camera3D({...cameraProps, width: this.viewSize.width, height: this.viewSize.height})
      }
      end = 1
    }
    // 创建
    const frames = outFrame - inFrame
    const newLayers: Layer[] = []
    const mapLayers: Record<number, Layer> = {}

    for (let i = layerProps.length - 1; i >= end; i--) {
      const props = layerProps[i]
      // 创建图层
      const outFrame = Math.min(frames, props.outFrame ?? frames)
      const layer = createLayer({...props, outFrame}, store, this)
      if (!layer) continue

      layer.mainInFrame = inFrame

      newLayers.push(layer)
      mapLayers[props.id] = layer
    }
    // 初始化
    await Promise.all(
      newLayers.map(
        layer =>
          new Promise(resolve => {
            const props = layer.props
            // 过滤渲染图层
            if (!props.isTrackMatte || props.enabled === 1) {
              const trackMatteLayerId = props.trackMatteLayer
              // 设置遮罩
              if (trackMatteLayerId) {
                layer.trackLayer = mapLayers[trackMatteLayerId]
              }
              // 加入渲染队列
              childLayers.push(layer)
            }
            // 设置父子跟随
            const parentId = props.parent
            if (parentId) {
              layer.setParent(mapLayers[parentId])
            }

            // 初始化
            layer.init(gl).then(resolve)
          }),
      ),
    )

    // WARNING:异步重入安全对象清理
    if (childLayers !== this.childLayers) {
      newLayers.forEach(el => el.destroy())
    }
  }

  getChildLayer(id: number) {
    return this.childLayers?.find(el => el.id === id)
  }

  clearLayers() {
    this.childLayers?.forEach(layer => layer.destroy())
    this.childLayers = null
  }

  destroy() {
    this.camera3D = null
    this.clearLayers()

    this.isDestroied = true
  }
}
