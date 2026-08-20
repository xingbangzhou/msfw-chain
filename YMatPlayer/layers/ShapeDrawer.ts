import {FrameInfo} from '../renderer/common/RenderStore'
import {WebGLRendererContext} from '../utils/shims'
import {LayerShapeProps, LayerType} from '../types'
import AbstractDrawer from './BaseDrawer'
import Layer, {createLayer} from './Layer'
import LayerView from './LayerView'
import {Matrix4} from '../math/Matrix4'

export default class ShapeDrawer extends AbstractDrawer<LayerShapeProps> {
  protected shapeView = new LayerView()

  async init(gl: WebGLRendererContext) {
    const ref = this.ref
    const shapeElements = ref.props.content
    if (!shapeElements) return

    const shapeView = this.shapeView

    const width = ref.props.width
    const height = ref.props.height
    const cx = width * 0.5
    const cy = height * 0.5
    ref.anchorOffset.set(cx, cy)
    ref.childOffset.set(cx, -cy)
    shapeView.setViewSize(width, height, true)
    shapeView.viewOffset.set(cx, -cy)

    shapeView.clearLayers()
    // WARNING:标记当前图层列表
    const childLayers = (shapeView.childLayers = []) as Layer[]

    const inFrame = ref.props.inFrame
    const outFrame = ref.props.outFrame
    for (let i = shapeElements.length - 1; i >= 0; i--) {
      const element = shapeElements[i]
      const props = {...element, inFrame, outFrame, id: ref.props.id}
      if (props.type === LayerType.Path) {
        props.width = width
        props.height = height
      }
      const layer = createLayer(props, ref.store, shapeView)
      if (!layer) continue
      childLayers.push(layer)
      await layer.init(gl)
    }
  }

  draw(gl: WebGLRendererContext, matrix: Matrix4, frameInfo: FrameInfo) {
    const subLayers = this.shapeView.childLayers
    if (!subLayers?.length) return

    const ref = this.ref
    const opacity = ref.getOpacity(frameInfo.frameId, frameInfo.opacity)

    for (let i = 0, l = subLayers.length; i < l; i++) {
      const layer = subLayers[i]
      if (!layer.isFrameShow(frameInfo.frameId)) continue
      layer.render(gl, matrix, {...frameInfo, opacity: opacity})
    }
  }

  destroy() {
    super.destroy()

    this.shapeView.destroy()
  }

  drawID(gl: WebGLRendererContext, matrix: Matrix4, frameInfo: FrameInfo): void {
    const subLayers = this.shapeView.childLayers
    if (!subLayers?.length) return

    const ref = this.ref
    const opacity = ref.getOpacity(frameInfo.frameId, frameInfo.opacity)

    for (let i = 0, l = subLayers.length; i < l; i++) {
      const layer = subLayers[i]
      if (!layer.isFrameShow(frameInfo.frameId)) continue
      layer.renderID(gl, matrix, {...frameInfo, opacity: opacity})
    }
  }
}
