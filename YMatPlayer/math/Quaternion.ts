import {Vector3} from './Vector3'

export class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this._x = x
    this._y = y
    this._z = z
    this._w = w
  }

  private _x: number
  private _y: number
  private _z: number
  private _w: number

  get x() {
    return this._x
  }

  set x(value) {
    this._x = value
  }

  get y() {
    return this._y
  }

  set y(value) {
    this._y = value
  }

  get z() {
    return this._z
  }

  set z(value) {
    this._z = value
  }

  get w() {
    return this._w
  }

  set w(value) {
    this._w = value
  }

  set(x: number, y: number, z: number, w: number) {
    this._x = x
    this._y = y
    this._z = z
    this._w = w

    return this
  }

  clone() {
    return new Quaternion(this._x, this._y, this._z, this._w)
  }

  setFromAxisAngle(axis: Vector3, angle: number) {
    // http://www.euclideanspace.com/maths/geometry/rotations/conversions/angleToQuaternion/index.htm

    // assumes axis is normalized

    const halfAngle = angle / 2,
      s = Math.sin(halfAngle)

    this._x = axis.x * s
    this._y = axis.y * s
    this._z = axis.z * s
    this._w = Math.cos(halfAngle)

    return this
  }

  identity() {
    return this.set(0, 0, 0, 1)
  }

  multiply(q: Quaternion) {
    return this.multiplyQuaternions(this, q)
  }

  premultiply(q: Quaternion) {
    return this.multiplyQuaternions(q, this)
  }

  multiplyQuaternions(a: Quaternion, b: Quaternion) {
    const qax = a._x,
      qay = a._y,
      qaz = a._z,
      qaw = a._w
    const qbx = b._x,
      qby = b._y,
      qbz = b._z,
      qbw = b._w

    this._x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby
    this._y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz
    this._z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx
    this._w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz

    return this
  }

  equals(quaternion: Quaternion) {
    return (
      quaternion._x === this._x && quaternion._y === this._y && quaternion._z === this._z && quaternion._w === this._w
    )
  }

  rotateOnAxis(axis: Vector3, angle: number) {
    _q1.setFromAxisAngle(axis, angle)

    return this.multiply(_q1)
  }

  rotateX(angle: number) {
    return this.rotateOnAxis(_xAxis, angle)
  }

  rotateY(angle: number) {
    return this.rotateOnAxis(_yAxis, angle)
  }

  rotateZ(angle: number) {
    return this.rotateOnAxis(_zAxis, angle)
  }

  *[Symbol.iterator]() {
    yield this._x
    yield this._y
    yield this._z
    yield this._w
  }
}

const _q1 = /*@__PURE__*/ new Quaternion()
const _xAxis = /*@__PURE__*/ new Vector3(1, 0, 0)
const _yAxis = /*@__PURE__*/ new Vector3(0, 1, 0)
const _zAxis = /*@__PURE__*/ new Vector3(0, 0, 1)
