import Object3D from '../core/Object3D'
import {LayerRectProps} from '../types'
import {CanvasContext2D} from '../utils/canvas'
import ElementDrawer from './ElementDrawer'

function drawRoundedRect(ctx: CanvasContext2D, width: number, height: number, radius: number) {
  ctx.beginPath()
  ctx.moveTo(radius, 0)
  ctx.lineTo(width - radius, 0)
  ctx.arcTo(width, 0, width, 0 + radius, radius)
  ctx.lineTo(width, 0 + height - radius)
  ctx.arcTo(width, 0 + height, width - radius, 0 + height, radius)
  ctx.lineTo(radius, 0 + height)
  ctx.arcTo(0, 0 + height, 0, 0 + height - radius, radius)
  ctx.lineTo(0, 0 + radius)
  ctx.arcTo(0, 0, radius, 0, radius)
  ctx.closePath()
}

export default class RectDrawer extends ElementDrawer<LayerRectProps> {
  constructor(ref: Object3D<LayerRectProps>) {
    super(ref)

    const props = ref.props
    const width = (props.width = props.elements.rectInfo.size[0] || 0)
    const height = (props.height = props.elements.rectInfo.size[1] || 0)

    const offX = props.elements?.rectInfo?.position?.[0] || 0
    const offY = props.elements?.rectInfo?.position?.[1] || 0
    ref.anchorOffset.set(width * 0.5 + offX, height * 0.5 + offY)
  }

  protected getDrawPath(ctx: CanvasContext2D) {
    const props = this.ref.props
    const width = props.width
    const height = props.height
    const path = new Path2D()

    const rectInfo = props.elements.rectInfo
    let radius = rectInfo?.roundness || 0
    if (radius > 0) {
      if (radius > height * 0.5) {
        radius = Math.floor(height * 0.5)
      }
      if ('roundRect' in path) {
        ;(<any>path)['roundRect'](0, 0, width, height, radius)
      } else {
        drawRoundedRect(ctx, width, height, radius)
        return null
      }
    } else {
      path.rect(0, 0, width, height)
    }

    return path
  }
}
