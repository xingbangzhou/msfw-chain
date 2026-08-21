import {PlayerState} from '../PlayerState'
import {WebGLRenderer} from '../renderers/WebGLRenderer'
import {LayerBaseProps, VectorProps} from '../types'
import {DrawerLike, DrawContext} from './Drawer'
import {LayerView} from './LayerView'

type VectorLayerProps = LayerBaseProps & VectorProps

/**
 * VectorDrawer — 矢量/预合成图层容器
 *
 * 本身是一个 LayerView：把 props.layers 作为子图层初始化并逐帧渲染。
 * 子图层复用父视图的相机矩阵与视图偏移（即在合成空间内定位）。
 * 注：矢量图层自身 transform 尚未叠加到子图层，后续可加。
 */
export class VectorDrawer extends LayerView implements DrawerLike {
  constructor(renderer: WebGLRenderer, state: PlayerState) {
    super(renderer, state)
  }

  private initialized = false

  async init() {}

  draw(context: DrawContext) {
    if (!this.initialized) {
      this.setup(context)
      return
    }
    // 每帧同步父视图相机，随窗口尺寸变化保持一致
    this.cameraMatrix = context.layerView.cameraMatrix
    this.viewOffset.copy(context.layerView.viewOffset)

    this.renderChildren()
  }

  dispose() {}

  private setup(context: DrawContext) {
    this.initialized = true

    const parentView = context.layerView
    const props = context.layer.props as VectorLayerProps
    const layers = props.layers
    if (!layers || !layers.length) return

    // 复用父视图的相机与尺寸
    this.viewSize.copy(parentView.viewSize)
    this.cameraMatrix = parentView.cameraMatrix
    this.viewOffset.copy(parentView.viewOffset)

    const frames = this.state.frames
    // 异步初始化子图层，完成后即可参与渲染
    void this.initLayers(layers, 0, frames)
  }
}
