import {LayerBaseProps, PathProps} from '../types'
import {DrawContext} from './Drawer'
import {ElementDrawer} from './ElementDrawer'
import {paintShapeElement} from './shapeUtils'

type PathLayerProps = LayerBaseProps & PathProps

export class PathDrawer extends ElementDrawer {
  // 虚线偏移可能逐帧变化，交由基类每帧重绘（此处保持一次绘制，动画偏移取首帧）
  protected paint(ctx: CanvasRenderingContext2D, _w: number, _h: number, context: DrawContext): boolean {
    const props = context.layer.props as PathLayerProps
    if (!props.elements) return false
    paintShapeElement(ctx, props.elements)
    return true
  }
}
