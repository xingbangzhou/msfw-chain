import {LayerBaseProps, ShapeProps} from '../types'
import {DrawContext} from './Drawer'
import {ElementDrawer} from './ElementDrawer'
import {paintShapeElement} from './shapeUtils'

type ShapeLayerProps = LayerBaseProps & ShapeProps

export class ShapeDrawer extends ElementDrawer {
  protected paint(ctx: CanvasRenderingContext2D, _w: number, _h: number, context: DrawContext): boolean {
    const props = context.layer.props as ShapeLayerProps
    const content = props.content
    if (!content || !content.length) return false
    for (const item of content) {
      if (item.elements) paintShapeElement(ctx, item.elements)
    }
    return true
  }
}
