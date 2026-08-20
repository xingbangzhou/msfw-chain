import Object3D from '../core/Object3D'
import {LayerEllipseProps} from '../types'
import {CanvasContext2D} from '../utils/canvas'
import ElementDrawer from './ElementDrawer'

export default class EllipseDrawer extends ElementDrawer<LayerEllipseProps> {
  constructor(ref: Object3D<LayerEllipseProps>) {
    super(ref)
    const width = (ref.props.width = ref.props.elements.ellipseInfo.size[0] || 0)
    const height = (ref.props.height = ref.props.elements.ellipseInfo.size[1] || 0)

    // x、y的偏移值
    const offX = ref.props.elements?.ellipseInfo?.position?.[0] || 0
    const offY = ref.props.elements?.ellipseInfo?.position?.[1] || 0
    ref.anchorOffset.set(width * 0.5 + offX, height * 0.5 + offY)
  }

  protected getDrawPath(ctx: CanvasContext2D): Path2D {
    const ref = this.ref
    const width = ref.props.width
    const height = ref.props.height

    const path = new Path2D()
    const cx = width * 0.5
    const cy = height * 0.5
    path.ellipse(cx, cy, cx, cy, 0, 0, height)

    return path
  }
}
