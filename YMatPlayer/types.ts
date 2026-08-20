export enum FillMode {
  LongSide = 0, // 默认长边对齐
  ShortSide, // 短边对齐
  Fill, // 填充
}

export enum PlayState {
  None = 0,
  Play,
  Pause,
  End,
  Destroy,
}

export interface PlayerParameters {
  loop?: boolean // 是否循环播放，默认为false

  debug?: boolean // 是否调试模式

  fillMode?: FillMode // 默认LongSide,长边对齐

  playAfterLoad?: boolean // 加载完毕后直接播放，默认为false

  destroyAfterEnd?: boolean // 播放完毕后自动destroy，默认为false

  disableAudio?: boolean // 是否音频

  disableWorker?: boolean // 是否用worker渲染

  disableDecoder?: boolean // 是否用VideoDecoder
}

export class PlayerEventMap {
  play: () => void = <any>null
  pause: () => void = <any>null
  end: () => void = <any>null
  frame: (frameId: number) => void = <any>null
  destroy: () => void = <any>null
  error: (name: string, ...args: any[]) => void = <any>null
  click: (item: {id: number; name: string; type: LayerType} | null) => void = <any>null
}

export enum LayerType {
  Image = 'image',
  Video = 'video',
  Text = 'text',
  Vector = 'vector',
  ShapeLayer = 'ShapeLayer',
  Ellipse = 'Ellipse',
  Rect = 'Rect',
  Path = 'Path',
  Solid = 'Solid',
  // 预合成组件
  PreComposition = 'precomposition',
  // 相机节点
  Camera = 'camera',
}

export interface TransformProps {
  anchorPoint?: {
    inFrame: number
    value: number[]
    timeFunc?: number
  }[]
  position?: {
    inFrame: number
    value: number[]
    timeFunc?: number
  }[]
  scale?: {
    inFrame: number
    value: number[]
    timeFunc?: number
  }[]
  opacity?: {
    inFrame: number
    value: number
    timeFunc?: number
  }[]
  rotationX?: {
    inFrame: number
    value: number
    timeFunc?: number
  }[]
  rotationY?: {
    inFrame: number
    value: number
    timeFunc?: number
  }[]
  rotationZ?: {
    inFrame: number
    value: number
    timeFunc?: number
  }[]
  orientation?: {
    inFrame: number
    value: number[]
    timeFunc?: number
  }[]
  animationConfig?: Record<
    string,
    {
      inFrame: number
      outFrame: number
    }
  >
}

export enum TrackMatteType {
  None = 0,
  ALPHA = 1,
  ALPHA_INVERTED = 2,
  LUMA = 3,
  LUMA_INVERTED = 4,
}

export enum BlendMode {
  None = 0,
  Add,
  Screen,
  Overlay,
  SoftLight,
  Lighten,
  Darken,
  Multiply,
  ColorBurn,
  ColorDodge,
  HardLight,
  Difference,
  Exclusion,
  Hue,
  Saturation,
  Color,
  Luminosity,
}

export interface EffectsProps {
  bri_con?: {
    contrast: number
    brightness: number
  }
  hue_sat?: {
    colorize: number
    hue: number
    saturation: number
    brightness: number
  }
}

export interface LayerBaseProps {
  id: number
  type: string
  name?: string
  transform: TransformProps
  width: number
  height: number
  inFrame: number
  outFrame: number
  isTrackMatte?: boolean
  trackMatteLayer?: number
  trackMatteType?: TrackMatteType
  blendMode?: BlendMode
  is3D?: boolean
  effects?: EffectsProps
  sourceId?: number
  parent?: number
  enabled?: 0 | 1 | 2
  clickAble?: boolean
  endMode?: number
  compDuration?: number
  compFrameRate?: number
}

export type LayerImageProps = {
  type: LayerType.Image
  content: string
  fillMode?: FillMode
} & LayerBaseProps

export type LayerVideoProps = {
  type: LayerType.Video
  content: string
  isAlpha?: boolean
  fillMode?: FillMode
  videoUrl?: string
} & LayerBaseProps

export interface TextDocAttr {
  text: string
  textColor: number[]
  font: string
  fontFamily: string
  fontSize: number
  fontStyle: string
  fauxBold?: boolean
  fauxItalic?: boolean
  lineSpacing?: number
  wordSpacing?: number
  textAligment?: number
  orientation?: number
}

export type LayerTextProps = {
  type: LayerType.Text
  textDocAttr: TextDocAttr
  content: string
} & LayerBaseProps

interface ShapeFillInfo {
  blendMode?: number
  color: [number, number, number, number]
  opacity: number
}

interface ShapeStrokeInfo {
  blendMode?: number
  color: [number, number, number, number]
  opacity: number
  width: number
  lineCap: number
  lineJoin: number
  miterLimit: number
  dashesInfo?: {
    dash: number[]
    offset: [{inFrame: number; value: number; timeFunc?: number}]
  }
}

export type LayerPathProps = {
  type: LayerType.Path
  name?: string
  blendMode?: number
  elements: {
    shapeInfo: {
      points: Array<[number, number]>
      actions: number[]
    }
    strokeInfo?: ShapeStrokeInfo
    fillInfo?: ShapeFillInfo
  }
} & LayerBaseProps

export type LayerRectProps = {
  type: LayerType.Rect
  name?: string
  blendMode?: number
  elements: {
    rectInfo: {
      direction?: number
      size: [number, number]
      position: [number, number]
      roundness?: number
    }
    strokeInfo?: ShapeStrokeInfo
    fillInfo?: ShapeFillInfo
  }
  transform: TransformProps
} & LayerBaseProps

export type LayerEllipseProps = {
  type: LayerType.Ellipse
  name?: string
  blendMode?: number
  elements: {
    ellipseInfo: {
      direction?: number
      size: [number, number]
      position: [number, number]
    }
    strokeInfo?: ShapeStrokeInfo
    fillInfo?: ShapeFillInfo
  }
} & LayerBaseProps

export type LayerShapeProps = {
  type: LayerType.ShapeLayer
  content: Array<LayerRectProps | LayerEllipseProps | LayerPathProps>
} & LayerBaseProps

export type LayerVectorProps = {
  type: LayerType.Vector
  layers: LayerProps[]
} & LayerBaseProps

export type LayerCameraProps = {
  type: LayerType.Camera
  options?: {
    zoom?: {
      inFrame: number
      value: number
      timeFunc?: number
    }[]
  }
} & LayerBaseProps

export type LayerSolidProps = {
  type: LayerType.Solid
  color: number[]
} & LayerBaseProps

export type LayerProps =
  | LayerImageProps
  | LayerVideoProps
  | LayerTextProps
  | LayerShapeProps
  | LayerVectorProps
  | LayerRectProps
  | LayerEllipseProps
  | LayerPathProps
  | LayerSolidProps

export interface PlayProps {
  width: number
  height: number
  duration: number // 单位：秒
  frameRate: number
}

export type YMatPlayProps = PlayProps & {
  targetComp: {
    layers: LayerProps[]
  }
  comps: LayerProps[]
  endMode?: number
}

export interface PlayInfo {
  width: number
  height: number
  duration: number // 秒
  frameRate: number
  frames: number
}

export interface YMatTextValue {
  value: string
  color?: string
  fontFamily?: string
  fontSize?: number
  bold?: boolean
}

export interface YMatKeyProps {
  key: string
  type: 'image' | 'video' | 'text'
  value: string | YMatTextValue | YMatTextValue[]
  isAlpha?: boolean
}

export type YMatKeyInfo = YMatKeyProps & {
  inFrame?: number
  outFrame?: number
  content?: string
}

// Svga
export interface SvgaSwapItemInfo {
  type?: number // 0: 文本；1：图片 默认为0
  content: string
  family?: string
  fontSize?: number
  bold?: boolean
  color?: string
  align?: number
  width?: number
}
