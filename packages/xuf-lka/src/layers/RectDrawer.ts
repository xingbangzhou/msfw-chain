import {LayerBaseProps, RectProps} from '../types'
import {DrawContext} from './Drawer'
import {ElementDrawer} from './ElementDrawer'
import {paintShapeElement} from './shapeUtils'

type RectLayerProps = LayerBaseProps & RectProps

export class RectDrawer extends ElementDrawer {
  protected paint(ctx: CanvasRenderingContext2D, _w: number, _h: number, context: DrawContext): boolean {
    const props = context.layer.props as RectLayerProps
    if (!props.elements) return false
    paintShapeElement(ctx, props.elements)
    return true
  }
}
