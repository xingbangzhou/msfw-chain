export interface RawImages {
  [key: string]: ImageBitmap | HTMLImageElement
}

export interface Transform {
  a: number
  b: number
  c: number
  d: number
  tx: number
  ty: number
}

export const enum LINE_CAP_CODE {
  BUTT = 0,
  ROUND = 1,
  SQUARE = 2,
}

export const enum LINE_JOIN_CODE {
  MITER = 0,
  ROUND = 1,
  BEVEL = 2,
}

export interface RGBA_CODE {
  r: number
  g: number
  b: number
  a: number
}

export type RGBA<
  R extends number,
  G extends number,
  B extends number,
  A extends number,
> = `rgba(${R}, ${G}, ${B}, ${A})`

export const enum SHAPE_TYPE_CODE {
  SHAPE = 0,
  RECT = 1,
  ELLIPSE = 2,
  KEEP = 3,
}

export const enum SHAPE_TYPE {
  SHAPE = 'shape',
  RECT = 'rect',
  ELLIPSE = 'ellipse',
}

export interface MovieStyles {
  fill: RGBA_CODE | null
  stroke: RGBA_CODE | null
  strokeWidth: number | null
  lineCap: LINE_CAP_CODE | null
  lineJoin: LINE_JOIN_CODE | null
  miterLimit: number | null
  lineDashI: number | null
  lineDashII: number | null
  lineDashIII: number | null
}

export interface ShapeStyles {
  fill: RGBA<number, number, number, number> | null
  stroke: RGBA<number, number, number, number> | null
  strokeWidth: number | null
  lineCap: CanvasLineCap | null
  lineJoin: CanvasLineJoin | null
  miterLimit: number | null
  lineDash: number[] | null
}

export interface MaskPath {
  d: string
  transform: Transform | undefined
  styles: ShapeStyles
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface ShapePath {
  d: string
}

export interface RectPath {
  x: number
  y: number
  width: number
  height: number
  cornerRadius: number
}

export interface EllipsePath {
  x: number
  y: number
  radiusX: number
  radiusY: number
}

export interface MovieShape {
  type: SHAPE_TYPE_CODE | SHAPE_TYPE | null
  shape: ShapePath | null
  rect: RectPath | null
  ellipse: EllipsePath | null
  styles: MovieStyles | null
  transform: Transform | null
}

export interface ShapeShape {
  type: SHAPE_TYPE.SHAPE
  path: ShapePath
  styles: ShapeStyles
  transform: Transform
}

export interface ShapeRect {
  type: SHAPE_TYPE.RECT
  path: RectPath
  styles: ShapeStyles
  transform: Transform
}

export interface ShapeEllipse {
  type: SHAPE_TYPE.ELLIPSE
  path: EllipsePath
  styles: ShapeStyles
  transform: Transform
}

export interface MovieFrame {
  alpha: number
  transform: Transform | null
  nx: number
  ny: number
  layout: Rect
  clipPath: string
  maskPath: MaskPath | null
  shapes: MovieShape[]
}

export interface MovieSprite {
  matteKey?: string
  imageKey: string
  frames: MovieFrame[]
}

export interface Movie {
  version: string
  images: {
    [key: string]: Uint8Array
  }
  params: {
    fps: number
    frames: number
    viewBoxHeight: number
    viewBoxWidth: number
  }
  sprites: MovieSprite[]
}

export type FrameShape = ShapeShape | ShapeRect | ShapeEllipse

export type FrameShapes = FrameShape[]

export interface SpriteFrame {
  alpha: number
  transform: Transform | null
  layout: Rect
  clipPath?: string
  shapes: FrameShapes
}

export interface SpriteInfo {
  matteKey?: string
  imageKey: string
  frames: SpriteFrame[]
}

export type ReplaceElement = HTMLImageElement | HTMLCanvasElement | OffscreenCanvas

export interface ReplaceElements {
  [key: string]: ReplaceElement
}

export type DynamicElement = HTMLImageElement | HTMLCanvasElement | OffscreenCanvas

export interface DynamicElements {
  [key: string]: DynamicElement
}

export interface SvgaPlayInfo {
  version: string
  size: {
    width: number
    height: number
  }
  fps: number
  frames: number
  images: RawImages
  sprites: SpriteInfo[]
  withShape?: boolean
}
