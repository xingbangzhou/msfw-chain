import * as MathUtils from './MathUtils'
import {Matrix4} from './Matrix4'
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

  copy(quaternion: Quaternion) {
    this._x = quaternion.x
    this._y = quaternion.y
    this._z = quaternion.z
    this._w = quaternion.w

    return this
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

  setFromRotationMatrix(m: Matrix4) {
    // http://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToQuaternion/index.htm

    // assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)

    const te = m.elements,
      m11 = te[0],
      m12 = te[4],
      m13 = te[8],
      m21 = te[1],
      m22 = te[5],
      m23 = te[9],
      m31 = te[2],
      m32 = te[6],
      m33 = te[10],
      trace = m11 + m22 + m33

    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1.0)

      this._w = 0.25 / s
      this._x = (m32 - m23) * s
      this._y = (m13 - m31) * s
      this._z = (m21 - m12) * s
    } else if (m11 > m22 && m11 > m33) {
      const s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33)

      this._w = (m32 - m23) / s
      this._x = 0.25 * s
      this._y = (m12 + m21) / s
      this._z = (m13 + m31) / s
    } else if (m22 > m33) {
      const s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33)

      this._w = (m13 - m31) / s
      this._x = (m12 + m21) / s
      this._y = 0.25 * s
      this._z = (m23 + m32) / s
    } else {
      const s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22)

      this._w = (m21 - m12) / s
      this._x = (m13 + m31) / s
      this._y = (m23 + m32) / s
      this._z = 0.25 * s
    }

    return this
  }

  setFromUnitVectors(vFrom: Vector3, vTo: Vector3) {
    // assumes direction vectors vFrom and vTo are normalized

    let r = vFrom.dot(vTo) + 1

    if (r < Number.EPSILON) {
      // vFrom and vTo point in opposite directions

      r = 0

      if (Math.abs(vFrom.x) > Math.abs(vFrom.z)) {
        this._x = -vFrom.y
        this._y = vFrom.x
        this._z = 0
        this._w = r
      } else {
        this._x = 0
        this._y = -vFrom.z
        this._z = vFrom.y
        this._w = r
      }
    } else {
      // crossVectors( vFrom, vTo ); // inlined to avoid cyclic dependency on Vector3

      this._x = vFrom.y * vTo.z - vFrom.z * vTo.y
      this._y = vFrom.z * vTo.x - vFrom.x * vTo.z
      this._z = vFrom.x * vTo.y - vFrom.y * vTo.x
      this._w = r
    }

    return this.normalize()
  }

  angleTo(q: Quaternion) {
    return 2 * Math.acos(Math.abs(MathUtils.clamp(this.dot(q), -1, 1)))
  }

  identity() {
    return this.set(0, 0, 0, 1)
  }

  invert() {
    return this.conjugate()
  }

  conjugate() {
    this._x *= -1
    this._y *= -1
    this._z *= -1

    return this
  }

  dot(q: Quaternion) {
    return this._x * q.x + this._y * q.y + this._z * q.z + this._w * q.w
  }

  lengthSq() {
    return this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w
  }

  length() {
    return Math.sqrt(this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w)
  }

  normalize() {
    let l = this.length()

    if (l === 0) {
      this._x = 0
      this._y = 0
      this._z = 0
      this._w = 1
    } else {
      l = 1 / l

      this._x = this._x * l
      this._y = this._y * l
      this._z = this._z * l
      this._w = this._w * l
    }

    return this
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

  random() {
    const theta1 = 2 * Math.PI * Math.random()
    const theta2 = 2 * Math.PI * Math.random()

    const x0 = Math.random()
    const r1 = Math.sqrt(1 - x0)
    const r2 = Math.sqrt(x0)

    return this.set(r1 * Math.sin(theta1), r1 * Math.cos(theta1), r2 * Math.sin(theta2), r2 * Math.cos(theta2))
  }

  equals(quaternion: Quaternion) {
    return (
      quaternion._x === this._x && quaternion._y === this._y && quaternion._z === this._z && quaternion._w === this._w
    )
  }

  fromArray(array: number[], offset = 0) {
    this._x = array[offset]
    this._y = array[offset + 1]
    this._z = array[offset + 2]
    this._w = array[offset + 3]

    return this
  }

  *[Symbol.iterator]() {
    yield this._x
    yield this._y
    yield this._z
    yield this._w
  }
}
