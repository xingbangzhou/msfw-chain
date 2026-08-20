import {DEG2RAD} from '../math/mathUtils'
import {Matrix4} from '../math/Matrix4'
import {Quaternion} from '../math/Quaternion'
import {Vector2} from '../math/Vector2'
import {Vector3} from '../math/Vector3'
import RenderStore from '../renderer/common/RenderStore'
import {EndMode, HueStaturation} from '../renderer/common/RenderYMat/types'
import {BlendMode, LayerProps, LayerType, TransformProps} from '../types'
import Camera3D from './Camera3D'
import {Transform3D} from './Transform3D'

export default abstract class Object3D<Props extends LayerProps = LayerProps> {
  constructor(props: Props, store: RenderStore) {
    this.props = props
    this.store = store
    this.transformProps = props.transform
    this.transform = new Transform3D(this.transformProps)
    this.enabled = props.enabled
    this.endMode = props.endMode || EndMode.Normal
    const animationConfig = props.transform.animationConfig
    if (animationConfig && Object.keys(animationConfig).length) {
      this.animationConfig = animationConfig
    }

    // 混合
    const blendMode = props.blendMode || BlendMode.None
    this.blendMode = blendMode
    store.enableBlend(blendMode)
    // 明亮度
    const bri_con = props.effects?.bri_con
    if (bri_con) {
      const brightness = bri_con.brightness || 0
      const contrast = bri_con.contrast || 0
      this.brightness = brightness
      this.contrast = contrast
      store.enableBrightnessContrast(brightness !== 0 || contrast !== 0)
    }
    // 色相和对比度
    let hueSaturation: HueStaturation | undefined = undefined
    const hue_sat = props.effects?.hue_sat
    if (hue_sat) {
      hueSaturation = {
        colorize: hue_sat.colorize ? 2 : 1,
        hue: hue_sat.hue,
        saturation: hue_sat.saturation,
        lightness: hue_sat.brightness,
      }
      this.hueSaturation = hueSaturation
      store.enableHueSat(true)
    }

    // 方便点击查找
    store.setLayerProps(props.id, props)
  }

  readonly props: Props
  readonly store: RenderStore
  readonly blendMode: BlendMode
  readonly brightness: number = 0
  readonly contrast: number = 0
  readonly hueSaturation?: HueStaturation
  readonly endMode: EndMode
  readonly enabled?: number
  readonly animationConfig?: TransformProps['animationConfig']

  protected transformProps: TransformProps
  protected transform: Transform3D
  protected worldMatrix: Matrix4 | null = null

  protected _parent: Object3D | null = null
  protected _children: Object3D[] | null = null

  // 锚点偏移
  anchorOffset = new Vector2()
  // 定点偏移
  positionOffset = new Vector2()
  // 子图层偏移
  childOffset = new Vector2()

  // 主时间轴
  mainInFrame = 0
  // 是否可点击
  clickAble = false

  get id() {
    return this.props.id
  }

  get type() {
    return this.props.type
  }

  get is3D() {
    return !!this.props.is3D
  }

  get parent() {
    return this._parent
  }

  // 视图偏移
  abstract get viewOffset(): Vector2

  getFrameId(frameId: number, name?: keyof TransformProps) {
    const props = this.props
    const endMode = this.endMode
    const rootEndMode = this.store.endMode

    // 普通模式
    if (endMode === EndMode.Normal) {
      return frameId
    }
    // 冻结模式
    if (endMode === EndMode.Frozen) {
      return Math.min(props.outFrame - 1, frameId)
    }

    if (rootEndMode !== EndMode.Continuous && endMode === EndMode.Loop) {
      return frameId
    }

    let inFrame = props.inFrame
    let outFrame = props.outFrame
    const compDuration = props.compDuration
    const compFrameRate = props.compFrameRate
    if (this.type === LayerType.Vector && compDuration && compFrameRate) {
      outFrame = Math.floor(compDuration * compFrameRate)
    }
    if (name) {
      const config = this.animationConfig?.[name]
      if (config) {
        inFrame = config.inFrame
        outFrame = config.outFrame
      } else {
        inFrame = outFrame - 1
      }
    }
    const diff = frameId - inFrame
    if (diff <= 0) return frameId
    return inFrame + (diff % (outFrame - inFrame))
  }

  getOpacity(frameId: number, parentOpacity: number) {
    return this.transform.getOpacity(this.getFrameId(frameId, 'opacity')) * parentOpacity
  }

  isFrameShow(frameId: number) {
    if (this.enabled === 2) return false

    frameId = this.getFrameId(frameId)
    const {inFrame, outFrame} = this.props

    return frameId >= inFrame && frameId < outFrame
  }

  setParent(parent: Object3D | null = null) {
    const lastParent = this._parent
    if (lastParent && lastParent !== parent) {
      lastParent.removeChild(this)
      if (parent) {
        parent.addChild(this)
      }
    }
    this._parent = parent
  }

  addChild(child: Object3D) {
    const childrens = this._children || (this._children = [])
    if (!childrens.includes(child)) {
      childrens.push(child)
    }
  }

  removeChild(child: Object3D) {
    this._children = this._children?.filter(el => el !== child) || null
  }

  getLocalMatrix(frameId: number, no3D?: boolean) {
    const position = this.getPosition(frameId, no3D)
    const anchorPoint = this.getAnchorPoint(frameId, no3D)
    if (!anchorPoint || !position) {
      return null
    }

    const quaternion = this.getQuaternion(frameId, no3D)
    const scale = this.getScale(frameId, no3D)

    const matrix = new Matrix4().compose(position, quaternion, scale)
    matrix.compose(position, quaternion, scale)
    matrix.multiply(_m1.makeTranslation(-anchorPoint.x, anchorPoint.y, anchorPoint.z))

    return matrix
  }

  updateWorldMatrix(frameId: number, parentMatrix: Matrix4, camera3D: Camera3D | null = null) {
    let matrix = this.getLocalMatrix(frameId)

    if (matrix) {
      // 根据矩阵
      let is3D = this.is3D
      let parent = this.parent
      while (parent) {
        const m = parent.getLocalMatrix(frameId, !is3D)
        if (!m) break
        matrix.premultiply(m)
        is3D = parent.is3D
        parent = parent.parent
      }
      // 世界矩阵
      const viewMatrix = (this.is3D ? camera3D?.getMatrix(frameId) : null) || parentMatrix
      matrix = new Matrix4().multiplyMatrices(viewMatrix, matrix)
    }

    this.worldMatrix = matrix

    return matrix
  }

  setTransform(props: TransformProps) {
    const newTransformProps = {
      ...this.transformProps,
      ...props,
    }
    this.transform = new Transform3D(newTransformProps)
    this.transformProps = newTransformProps
  }

  destroy() {
    this._parent = null
    this._children = null
  }

  protected getPosition(frameId: number, no3D?: boolean) {
    const position = this.transform.getPosition(this.getFrameId(frameId, 'position'))
    if (!position) return null

    let offX = this.positionOffset.x
    let offY = this.positionOffset.y
    const parent = this._parent
    if (parent) {
      offX += parent.childOffset.x
      offY += parent.childOffset.y
    } else {
      const viewOffset = this.viewOffset
      offX += viewOffset.x
      offY += viewOffset.y
    }
    const x = position.x + offX
    const y = -position.y + offY
    const z = -position.z

    return new Vector3(x, y, no3D ? 0 : z)
  }

  protected getQuaternion(frameId: number, no3D?: boolean) {
    const {x: ox, y: oy, z: oz} = this.transform.getOrientation(this.getFrameId(frameId, 'orientation'))
    const rx = this.transform.getRotationX(this.getFrameId(frameId, 'rotationX'))
    const ry = this.transform.getRotationY(this.getFrameId(frameId, 'rotationY'))
    const rz = this.transform.getRotationZ(this.getFrameId(frameId, 'rotationZ'))

    const quaternion = new Quaternion()
    if (!no3D) {
      // 方向旋转-
      if (ox % 360) {
        quaternion.rotateX(DEG2RAD * ox)
      }
      if (oy % 360) {
        quaternion.rotateY(DEG2RAD * (360 - oy))
      }
      if (oz % 360) {
        quaternion.rotateZ(DEG2RAD * (360 - oz))
      }
    }
    // 轴旋转
    if (!no3D) {
      if (rx % 360) {
        quaternion.rotateX(DEG2RAD * rx)
      }
      if (ry % 360) {
        quaternion.rotateY(DEG2RAD * (360 - ry))
      }
    }
    if (rz % 360) {
      quaternion.rotateZ(DEG2RAD * (360 - rz))
    }

    return quaternion
  }

  protected getScale(frameId: number, no3D?: boolean) {
    const scale = this.transform.getScale(this.getFrameId(frameId, 'scale'))
    if (!scale) return

    return new Vector3(scale.x * 0.01, scale.y * 0.01, no3D ? 1.0 : scale.z * 0.01)
  }

  protected getAnchorPoint(frameId: number, no3D?: boolean) {
    const anchorPoint = this.transform.getAnchorPoint(this.getFrameId(frameId, 'anchorPoint'))
    if (!anchorPoint) return null

    anchorPoint.setX(anchorPoint.x + this.anchorOffset.x)
    anchorPoint.setY(anchorPoint.y + this.anchorOffset.y)

    return new Vector3(anchorPoint.x, anchorPoint.y, no3D ? 0 : anchorPoint.z)
  }
}

const _m1 = /*@__PURE__*/ new Matrix4()
