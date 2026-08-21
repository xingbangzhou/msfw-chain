import {EllipseProps, PathProps, RectProps} from '../types'
import {toRGBA} from './ElementDrawer'

const LINE_CAP: CanvasLineCap[] = ['butt', 'round', 'square']
const LINE_JOIN: CanvasLineJoin[] = ['bevel', 'miter', 'round']

type ShapeElement = RectProps['elements'] | EllipseProps['elements'] | PathProps['elements']

function buildRectPath(info: RectProps['elements']['rectInfo']): Path2D {
  const [w, h] = info.size
  const [cx, cy] = info.position
  const x = cx - w / 2
  const y = cy - h / 2
  const path = new Path2D()
  const r = Math.min(info.roundness || 0, w / 2, h / 2)
  if (r > 0) {
    path.moveTo(x + r, y)
    path.arcTo(x + w, y, x + w, y + h, r)
    path.arcTo(x + w, y + h, x, y + h, r)
    path.arcTo(x, y + h, x, y, r)
    path.arcTo(x, y, x + w, y, r)
    path.closePath()
  } else {
    path.rect(x, y, w, h)
  }
  return path
}

function buildEllipsePath(info: EllipseProps['elements']['ellipseInfo']): Path2D {
  const [w, h] = info.size
  const [cx, cy] = info.position
  const path = new Path2D()
  path.ellipse(cx, cy, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2)
  return path
}

function buildFreePath(info: PathProps['elements']['shapeInfo']): Path2D {
  const path = new Path2D()
  const points = info.points || []
  if (!points.length) return path
  path.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) {
    path.lineTo(points[i][0], points[i][1])
  }
  path.closePath()
  return path
}

function getPath(elements: ShapeElement): Path2D | null {
  if ('rectInfo' in elements) return buildRectPath(elements.rectInfo)
  if ('ellipseInfo' in elements) return buildEllipsePath(elements.ellipseInfo)
  if ('shapeInfo' in elements) return buildFreePath(elements.shapeInfo)
  return null
}

/** 将单个矢量元素（Rect/Ellipse/Path）填充/描边到画布 */
export function paintShapeElement(ctx: CanvasRenderingContext2D, elements: ShapeElement): void {
  const path = getPath(elements)
  if (!path) return

  const fillInfo = elements.fillInfo
  if (fillInfo) {
    ctx.fillStyle = toRGBA(fillInfo.color, fillInfo.opacity ?? 1)
    ctx.fill(path)
  }

  const strokeInfo = elements.strokeInfo
  if (strokeInfo) {
    ctx.strokeStyle = toRGBA(strokeInfo.color, strokeInfo.opacity ?? 1)
    ctx.lineWidth = strokeInfo.width || 1
    ctx.lineCap = LINE_CAP[strokeInfo.lineCap] || 'butt'
    ctx.lineJoin = LINE_JOIN[strokeInfo.lineJoin] || 'miter'
    ctx.miterLimit = strokeInfo.miterLimit || 10
    if (strokeInfo.dashesInfo?.dash) {
      ctx.setLineDash(strokeInfo.dashesInfo.dash)
      ctx.lineDashOffset = strokeInfo.dashesInfo.offset?.[0]?.value || 0
    }
    ctx.stroke(path)
    ctx.setLineDash([])
  }
}
