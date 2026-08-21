import {Property, Transform3D} from '../core/Transform3D'
import {Quaternion} from '../math/Quaternion'
import {Vector3} from '../math/Vector3'
import {CameraProps, LayerProps} from '../types'
import {Camera} from './Camera'

const DEG2RAD = Math.PI / 180
const DEFAULT_NEAR = 0.1
const DEFAULT_FAR = 100000
const MIN_ZOOM = 0.0001

const _position = /*@__PURE__*/ new Vector3()
const _q1 = /*@__PURE__*/ new Quaternion()
const _xAxis = /*@__PURE__*/ new Vector3(1, 0, 0)
const _yAxis = /*@__PURE__*/ new Vector3(0, 1, 0)
const _zAxis = /*@__PURE__*/ new Vector3(0, 0, 1)

export class LkaCamera extends Camera {
  readonly props: CameraProps & LayerProps
  readonly transform: Transform3D
  readonly zoomProp: Property<number> | null = null
  readonly width: number
  readonly height: number

  near = DEFAULT_NEAR
  far = DEFAULT_FAR

  constructor(props: CameraProps & LayerProps) {
    super()

    this.props = props
    this.transform = new Transform3D(props.transform)
    this.width = props.width || 1
    this.height = props.height || 1

    if (props.options?.zoom) {
      this.zoomProp = new Property(props.options.zoom)
    }
  }

  update(frameId: number) {
    const zoom = this.getZoom(frameId)
    const aspect = this.width / this.height
    const fov = this.getFov(frameId)

    this.projectionMatrix.makePerspectiveFromFov(fov, aspect, this.near, this.far)
    this.projectionMatrixInverse.copy(this.projectionMatrix).invert()

    this.updateTransform(frameId, zoom)
    this.updateMatrixWorld(true)

    return this
  }

  getZoom(frameId: number) {
    const zoom = this.zoomProp?.getValue(frameId)

    if (typeof zoom !== 'number' || zoom <= 0) {
      return Math.max(this.height, MIN_ZOOM)
    }

    return Math.max(zoom, MIN_ZOOM)
  }

  getFov(frameId: number) {
    const zoom = this.getZoom(frameId)

    return (2 * Math.atan(this.height / (2 * zoom))) / DEG2RAD
  }

  private updateTransform(frameId: number, zoom: number) {
    const position = this.transform.getPosition(frameId) ?? _position.set(this.width / 2, this.height / 2, -zoom)
    const scale = this.transform.getScale(frameId)

    this.position.copy(position)
    this.scale.set((scale?.x ?? 100) * 0.01, (scale?.y ?? 100) * 0.01, (scale?.z ?? 100) * 0.01)
    this.quaternion.identity()

    const orientation = this.transform.getOrientation(frameId)
    this.applyRotation(orientation.x, _xAxis)
    this.applyRotation(orientation.y, _yAxis)
    this.applyRotation(orientation.z, _zAxis)
    this.applyRotation(this.transform.getRotationX(frameId), _xAxis)
    this.applyRotation(this.transform.getRotationY(frameId), _yAxis)
    this.applyRotation(this.transform.getRotationZ(frameId), _zAxis)
  }

  private applyRotation(degrees: number, axis: Vector3) {
    if (degrees === 0) return

    this.quaternion.multiply(_q1.setFromAxisAngle(axis, degrees * DEG2RAD))
  }
}
