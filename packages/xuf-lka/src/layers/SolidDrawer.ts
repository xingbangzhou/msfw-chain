import {LayerBaseProps, SolidProps} from '../types'
import {DrawContext} from './Drawer'
import {ElementDrawer, toRGBA} from './ElementDrawer'

type SolidLayerProps = LayerBaseProps & SolidProps

export class SolidDrawer extends ElementDrawer {
  protected paint(ctx: CanvasRenderingContext2D, width: number, height: number, context: DrawContext): boolean {
    const props = context.layer.props as SolidLayerProps
    ctx.fillStyle = toRGBA(props.color)
    ctx.fillRect(0, 0, width, height)
    return true
  }
}
