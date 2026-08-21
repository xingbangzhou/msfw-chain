import {
  BlendMode,
  EndMode,
  FillMode,
  LayerProps,
  LkaKeyInfo,
  LkaKeyProps,
  LkaPlayProps,
  PlayerParameters,
} from './types'

export class PlayerState {
  duration = 0
  frameId = -1
  frames = 0
  frameRate = 30
  frameTimeMs = 0
  width = 0
  height = 0

  compLayers?: LayerProps[]
  sourceBlobMap?: Record<number, Blob>

  readonly loop: boolean = false
  readonly debug: boolean = false
  readonly fillMode: FillMode = FillMode.LongSide
  readonly autoPlay: boolean = false

  constructor(parameters: PlayerParameters) {
    this.loop = parameters.loop ?? this.loop
    this.debug = parameters.debug ?? this.debug
    if (parameters.autoPlay !== undefined) this.autoPlay = parameters.autoPlay
    if (parameters.fillMode !== undefined) this.fillMode = parameters.fillMode
    if (this.loop) this._endMode = EndMode.Loop
  }

  private _playProps?: LkaPlayProps
  private _rootLayers?: LayerProps[]
  private _endMode: EndMode = EndMode.Normal

  // 动态关键字信息（对外暴露 & 外部替换）
  private _keyInfoMap?: Record<string, LkaKeyInfo & {fromUser?: boolean}>
  // 图层 props 缓存（按 id），供拾取/动态修改反查
  private _layerPropsMap: Record<number, LayerProps> | null = null
  // 图层遍历采集的效果标识
  private _blendEnums?: number[]
  private _brightnessContrast = false
  private _hueSat = false

  get playProps() {
    return this._playProps
  }

  get rootLayers() {
    return this._rootLayers
  }

  get endMode() {
    return this._endMode
  }

  setLkaProps(props: LkaPlayProps, sourceMap?: Record<number, Blob>) {
    this._playProps = props
    this.duration = props.duration || 0
    this.frameId = -1
    this.frameRate = props.frameRate || 30
    this.frames = Math.round(this.duration * this.frameRate)
    this.frameTimeMs = 1000 / this.frameRate
    this.width = props.width
    this.height = props.height
    // lka props
    this._rootLayers = props.targetComp?.layers
    this.compLayers = props.comps
    this.sourceBlobMap = sourceMap
    // 是否循环
    if (props.endMode && props.endMode > EndMode.Frozen) {
      this._endMode = props.endMode
    }
  }

  clear() {
    this.frameId = -1
    this.duration = 0
    this.frames = 0
    this.frameRate = 30
    this.frameTimeMs = 0
    this.width = 0
    this.height = 0

    this._playProps = undefined
    this._rootLayers = undefined
    this.compLayers = undefined
    this.sourceBlobMap = undefined

    this._keyInfoMap = undefined
    this._layerPropsMap = null
    this._blendEnums = undefined
    this._brightnessContrast = false
    this._hueSat = false
  }

  getCompLayerProps(id: number) {
    return this.compLayers?.find(comp => comp.id === id)
  }

  /** 按 sourceId 取内嵌资源 Blob（图片/视频等） */
  getSourceBlob(id?: number) {
    if (id === undefined) return undefined
    return this.sourceBlobMap?.[id]
  }

  // ===== 动态关键字 =====

  getKeyInfo(key: string) {
    return this._keyInfoMap?.[key]
  }

  /** 对外暴露的可替换关键字（不含仅由用户注入、图层中并不存在的项） */
  getAllKeyInfo(): LkaKeyInfo[] | undefined {
    if (!this._keyInfoMap) return undefined
    return Object.values(this._keyInfoMap).filter(info => !info.fromUser)
  }

  /** 外部注入替换值（单个或列表） */
  setKeys(props: LkaKeyProps | LkaKeyProps[]) {
    const keyInfoMap = this._keyInfoMap || (this._keyInfoMap = {})

    const apply = (el: LkaKeyProps) => {
      const info = keyInfoMap[el.key]
      if (!info) {
        keyInfoMap[el.key] = {fromUser: true, ...el}
      } else {
        Object.assign(info, el)
      }
    }

    if (Array.isArray(props)) {
      props.forEach(apply)
    } else {
      apply(props)
    }
  }

  /** 图层初始化时登记自身可替换关键字（以 name 为 key） */
  addLayerKeyInfo(props: LayerProps & {content?: string}) {
    const name = props.name
    if (!name) return

    const keyInfoMap = this._keyInfoMap || (this._keyInfoMap = {})

    const info = keyInfoMap[name] || {key: name}
    if (props.type === 'image' || props.type === 'video' || props.type === 'text') {
      info.type = info.type || (props.type as LkaKeyInfo['type'])
    }
    info.content = props.content
    info.inFrame = props.inFrame
    info.outFrame = props.outFrame
    delete info.fromUser

    keyInfoMap[name] = info
  }

  // ===== 图层 props 缓存 =====

  setLayerProps(id: number, props: LayerProps) {
    const map = this._layerPropsMap || (this._layerPropsMap = {})
    map[id] = props
  }

  getLayerProps(id: number) {
    return this._layerPropsMap?.[id]
  }

  // ===== 效果采集（供着色器裁剪/编译使用） =====

  enableBlend(value?: BlendMode) {
    if (!value) return
    const enums = this._blendEnums || (this._blendEnums = [])
    if (!enums.includes(value)) enums.push(value)
  }

  get blendEnums() {
    return this._blendEnums
  }

  enableBrightnessContrast(enable: boolean) {
    if (enable) this._brightnessContrast = true
  }

  get brightnessContrast() {
    return this._brightnessContrast
  }

  enableHueSat(enable: boolean) {
    if (enable) this._hueSat = true
  }

  get hueSat() {
    return this._hueSat
  }
}
