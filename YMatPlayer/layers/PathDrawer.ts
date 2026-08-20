import {WebGLRendererContext} from '../utils/shims'
import {LayerPathProps} from '../types'
import {CanvasContext2D} from '../utils/canvas'
import ElementDrawer from './ElementDrawer'

// Notice: Path的width和height和Shape一致
export default class PathDrawer extends ElementDrawer<LayerPathProps> {
  private points: Array<[number, number]> = []

  async init(gl: WebGLRendererContext) {
    super.init(gl)

    const ref = this.ref

    const cx = ref.props.width * 0.5
    const cy = ref.props.height * 0.5
    this.points = ref.props.elements.shapeInfo.points.map(el => [cx + el[0], cy + el[1]])
    ref.positionOffset.set(-cx, cy)
  }

  protected getDrawPath(ctx: CanvasContext2D) {
    const props = this.ref.props
    const path = new Path2D()

    const points = this.points
    const actions = props.elements.shapeInfo.actions
    for (let ai = 0, pi = 0, al = actions.length; ai < al; ai++) {
      const ac = actions[ai] || 0
      if (ac === 0) {
        const pt = points[pi]
        path.moveTo(pt[0], pt[1])
        pi++
      } else if (ac === 1) {
        const pt = points[pi]
        path.lineTo(pt[0], pt[1])
        pi++
      } else if (ac === 2) {
        const pt1 = points[pi]
        const pt2 = points[pi + 1]
        const pt3 = points[pi + 2]
        path.bezierCurveTo(pt1[0], pt1[1], pt2[0], pt2[1], pt3[0], pt3[1])
        pi += 3
      } else if (ac === 3) {
        const pt = points[points.length - 1]
        const pt0 = points[0]
        path.moveTo(pt[0], pt[1])
        path.lineTo(pt0[0], pt0[1])
      }
    }

    return path
  }
}
