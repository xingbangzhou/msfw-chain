import {Property, Transform3D} from './Transform3D'
import {LayerCameraProps} from '../types'
import {Vector3} from '../math/Vector3'
import {DEG2RAD} from '../math/mathUtils'
import {Matrix4} from '../math/Matrix4'
import {Quaternion} from '../math/Quaternion'

export default class Camera3D {
  constructor(props: LayerCameraProps) {
    this.props = props

    this.transform = new Transform3D(props.transform)
    if (props.options?.zoom) {
      this.zoomProp = new Property<number>(props.options.zoom)
    }

    this.outFrame = props.outFrame
  }

  readonly props: LayerCameraProps
  readonly transform: Transform3D
  readonly zoomProp?: Property<number>
  readonly outFrame: number

  getMatrix(frameId: number) {
    const zoom = this.zoomProp?.getValue(frameId) as number | undefined
    if (!zoom) return null

    const {x: px, y: py, z: pz} = this.transform.getPosition(frameId) || _zeroV3
    const {x: ax, y: ay, z: az} = this.transform.getAnchorPoint(frameId) || _zeroV3
    const {x: ox, y: oy, z: oz} = this.transform.getOrientation(frameId)
    const rx = this.transform.getRotationX(frameId)
    const ry = this.transform.getRotationY(frameId)
    const rz = this.transform.getRotationZ(frameId)

    const width = this.props.width
    const height = this.props.height
    const cw = width * 0.5
    const ch = height * 0.5

    // 透视矩阵
    const fieldOfViewRadians = Math.atan(ch / zoom) * 2
    const aspect = width / height
    const zNear = 1
    const zFar = 20000
    _persM4.makePerspective(fieldOfViewRadians, aspect, zNear, zFar)

    // 相机向量和左边信息
    const cameraPosition = new Vector3(px - cw, ch - py, -pz)
    const target = new Vector3(ax - cw, ch - ay, -az)
    const up = new Vector3(0, 1, 0)

    const cameraMatrix = new Matrix4()
    cameraMatrix.makeTranslation(cameraPosition.x, cameraPosition.y, cameraPosition.z)
    cameraMatrix.lookAt(cameraPosition, target, up)

    const quaternion = new Quaternion()
    // 方向旋转
    if (ox % 360) {
      quaternion.rotateX(DEG2RAD * ox)
    }
    if (oy % 360) {
      quaternion.rotateY(DEG2RAD * (360 - oy))
    }
    if (oz % 360) {
      quaternion.rotateZ(DEG2RAD * (360 - oz))
    }

    // 轴旋转
    if (rx % 360) {
      quaternion.rotateX(DEG2RAD * rx)
    }
    if (ry % 360) {
      quaternion.rotateY(DEG2RAD * (360 - ry))
    }
    if (rz % 360) {
      quaternion.rotateZ(DEG2RAD * (360 - rz))
    }
    cameraMatrix.multiply(_quatM4.makeRotationFromQuaternion(quaternion))

    cameraMatrix.invert()
    cameraMatrix.premultiply(_persM4)

    return cameraMatrix
  }
}

const _persM4 = /*@__PURE__*/ new Matrix4()
const _quatM4 = /*@__PURE__*/ new Matrix4()
const _zeroV3 = /*@__PURE__*/ new Vector3()
