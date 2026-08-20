import {
  BlendMode,
  FillMode,
  LayerImageProps,
  LayerProps,
  LayerTextProps,
  LayerVideoProps,
  PlayerParameters,
  PlayProps,
  YMatKeyInfo,
  YMatKeyProps,
  YMatPlayProps,
} from '../../types'
import Framebuffer from '../webgl/Framebuffer'
import {RenderContext} from './RenderContext'
import {EndMode} from './RenderYMat/types'

// 当前帧信息
export interface FrameInfo {
  frameId: number
  width: number
  height: number
  opacity: number
  framebuffer: Framebuffer
}

export interface FrameSyncObject {
  checkFrameSync(frameId: number): boolean
}

export default class RenderStore {
  constructor(parameters: PlayerParameters, ctx: RenderContext) {
    this.ctx = ctx

    if (parameters.debug) this.debug = true
    if (parameters.loop) this._endMode = EndMode.Loop
    if (parameters.fillMode !== undefined) this.fillMode = parameters.fillMode
    if (parameters.playAfterLoad) this.playAfterLoad = true
    if (parameters.destroyAfterEnd) this.destroyAfterEnd = true
    if (parameters.disableAudio) this.disableAudio = true
    if (parameters.disableDecoder) this.disableDecoder = true
    if (parameters.disableWorker) this.disableWorker = true
  }

  readonly ctx: RenderContext

  readonly debug: boolean = false
  readonly fillMode: FillMode = FillMode.LongSide
  readonly playAfterLoad: boolean = false
  readonly destroyAfterEnd: boolean = false
  readonly disableAudio: boolean = false
  readonly disableDecoder: boolean = false
  readonly disableWorker: boolean = false

  frameId = -1 // 当前帧

  private _playProps?: PlayProps
  private _frames = 0
  private _frameRate = 30
  private _frameTime = 0 // 毫秒
  private _frameTimestamp = 0 // 微秒
  private _endMode: EndMode = EndMode.Normal

  // YMat图层信息
  private _rootLayers?: LayerProps[]
  private _compLayers?: LayerProps[]
  private _sourceMap?: Record<number, Blob>
  private _keyInfoMap?: Record<string, YMatKeyInfo & {fromUser?: boolean}>
  private _blendEnums?: number[] // 启动混合种类标识
  private _brightnessContrast = false // 启用亮度过滤标识
  private _hueSat = false // 启动色相和饱和度
  // 图层映射
  private _mapLayerProps: Record<number, LayerProps> | null = null
  // 帧率同步机
  private _frameSyncObjs: FrameSyncObject[] | null = null

  get playProps() {
    return this._playProps
  }

  get width() {
    return this._playProps?.width || 0
  }

  get height() {
    return this._playProps?.height || 0
  }

  get duration() {
    return this._playProps?.duration || 0
  }

  get frames() {
    return this._frames
  }

  get frameRate() {
    return this._frameRate
  }

  get frameTime() {
    return this._frameTime
  }

  get frameTimestamp() {
    return this._frameTimestamp
  }

  get endMode() {
    return this._endMode
  }

  setPlayProps(props: PlayProps) {
    this._playProps = props
    this._frameRate = props.frameRate || 30
    this._frames = Math.round((props.duration || 0) * props.frameRate)
    this._frameTime = +(1000 / this._frameRate).toFixed(4).slice(0, -1)
    this._frameTimestamp = this._frameTime * 1000
  }

  clear() {
    this.frameId = -1

    this._playProps = undefined
    this._frames = 0
    this._frameRate = 30
    this._frameTime = 0
    this._frameTimestamp = 0

    this._rootLayers = undefined
    this._compLayers = undefined
    this._sourceMap = undefined
    this._keyInfoMap = undefined
    this._blendEnums = undefined
    this._brightnessContrast = false
    this._hueSat = false

    this._frameSyncObjs = null
    this._mapLayerProps = null
  }

  // YMat信息和图层
  setYMatPlayProps(props: YMatPlayProps, sourceMap?: Record<number, Blob>) {
    this._sourceMap = sourceMap
    this.setPlayProps(props)

    this._rootLayers = props.targetComp.layers
    this._compLayers = props.comps
    // 是否循环
    if (props.endMode && props.endMode > EndMode.Frozen) {
      this._endMode = props.endMode
    }
  }

  get rootLayers() {
    return this._rootLayers
  }

  getCompLayer(id: number) {
    return this._compLayers?.find(el => el.id === id)
  }

  getSource(id: number) {
    return this._sourceMap?.[id]
  }

  getKeyInfo(key: string) {
    return this._keyInfoMap?.[key]
  }

  getAllKeyInfo() {
    if (!this._keyInfoMap) return undefined
    return Object.values(this._keyInfoMap).filter(info => !info.fromUser) as YMatKeyInfo[]
  }

  setKeys(props: YMatKeyProps | YMatKeyProps[]) {
    const keyInfoMap = this._keyInfoMap || (this._keyInfoMap = {})

    // 单个处理
    if (!Array.isArray(props)) {
      const info = keyInfoMap[props.key]
      if (!info) {
        keyInfoMap[props.key] = {
          fromUser: true,
          ...props,
        }
      } else {
        Object.assign(info, props)
      }
      return
    }
    // 列表处理
    for (const el of props) {
      const info = keyInfoMap[el.key]
      if (!info) {
        keyInfoMap[el.key] = {
          fromUser: true,
          ...el,
        }
      } else {
        Object.assign(info, el)
      }
    }
  }

  addLayerKeyInfo(props: LayerImageProps | LayerVideoProps | LayerTextProps) {
    const name = props.name
    if (!name) return

    const keyInfoMap = this._keyInfoMap || (this._keyInfoMap = {})

    const info = keyInfoMap[name] || {key: name}
    info.type = info.type || props.type
    info.content = props.content
    info.inFrame = props.inFrame
    info.outFrame = props.outFrame
    delete info.fromUser

    keyInfoMap[name] = info
  }

  setLayerProps(id: number, props: LayerProps) {
    const mapLayerProps = this._mapLayerProps || (this._mapLayerProps = {})
    mapLayerProps[id] = props
  }

  getLayerProps(id: number) {
    return this._mapLayerProps?.[id]
  }

  // 图层遍历混合值
  enableBlend(value: BlendMode) {
    if (value === BlendMode.None) return
    const enums = this._blendEnums || (this._blendEnums = [])
    if (!enums.includes(value)) {
      enums.push(value)
    }
  }

  get blendEnums() {
    return this._blendEnums
  }

  // 图层遍历亮度
  enableBrightnessContrast(enable: boolean) {
    if (enable) {
      this._brightnessContrast = true
    }
  }

  get brightnessContrast() {
    return this._brightnessContrast
  }

  // 图层遍历色相和饱和度
  enableHueSat(enable: boolean) {
    if (enable) {
      this._hueSat = true
    }
  }

  get hueSat() {
    return this._hueSat
  }

  // 帧率同步机
  addFrameSync(obj: FrameSyncObject) {
    const objList = this._frameSyncObjs || (this._frameSyncObjs = [])

    if (!objList.includes(obj)) {
      objList.push(obj)
    }
  }

  removeFrameSync(obj: FrameSyncObject) {
    if (this._frameSyncObjs !== null) {
      this._frameSyncObjs = this._frameSyncObjs.filter(el => el !== obj)
    }
  }

  checkFrameSync(frameId: number) {
    let synced = true

    const frameSyncObjs = this._frameSyncObjs
    this._frameSyncObjs = null

    frameSyncObjs?.forEach(obj => {
      const flag = obj.checkFrameSync(frameId)
      if (!flag) {
        synced = false
      }
    })

    return synced
  }
}
