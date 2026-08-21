import {EllipseProps, LayerBaseProps} from '../types'
import {DrawContext} from './Drawer'
import {ElementDrawer} from './ElementDrawer'
import {paintShapeElement} from './shapeUtils'

type EllipseLayerProps = LayerBaseProps & EllipseProps

export class EllipseDrawer extends ElementDrawer {
  protected paint(ctx: CanvasRenderingContext2D, _w: number, _h: number, context: DrawContext): boolean {
    const props = context.layer.props as EllipseLayerProps
    if (!props.elements) return false
    paintShapeElement(ctx, props.elements)
    return true
  }
}
