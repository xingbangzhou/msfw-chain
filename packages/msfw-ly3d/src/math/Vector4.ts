import * as MathUtils from './MathUtils'

export class Vector4 {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x
    this.y = y
    this.z = z
    this.w = w
  }

  x: number
  y: number
  z: number
  w: number

  get width() {
    return this.z
  }

  set width(value) {
    this.z = value
  }

  get height() {
    return this.w
  }

  set height(value) {
    this.w = value
  }

  set(x: number, y: number, z: number, w: number) {
    this.x = x
    this.y = y
    this.z = z
    this.w = w

    return this
  }

  setScalar(scalar: number) {
    this.x = scalar
    this.y = scalar
    this.z = scalar
    this.w = scalar

    return this
  }

  setX(x: number) {
    this.x = x

    return this
  }

  setY(y: number) {
    this.y = y

    return this
  }

  setZ(z: number) {
    this.z = z

    return this
  }

  setW(w: number) {
    this.w = w

    return this
  }

  clone() {
    return new Vector4(this.x, this.y, this.z, this.w)
  }

  copy(v: Vector4) {
    this.x = v.x
    this.y = v.y
    this.z = v.z
    this.w = v.w !== undefined ? v.w : 1

    return this
  }

  add(v: Vector4) {
    this.x += v.x
    this.y += v.y
    this.z += v.z
    this.w += v.w

    return this
  }

  addScalar(s: number) {
    this.x += s
    this.y += s
    this.z += s
    this.w += s

    return this
  }

  addVectors(a: Vector4, b: Vector4) {
    this.x = a.x + b.x
    this.y = a.y + b.y
    this.z = a.z + b.z
    this.w = a.w + b.w

    return this
  }

  addScaledVector(v: Vector4, s: number) {
    this.x += v.x * s
    this.y += v.y * s
    this.z += v.z * s
    this.w += v.w * s

    return this
  }

  sub(v: Vector4) {
    this.x -= v.x
    this.y -= v.y
    this.z -= v.z
    this.w -= v.w

    return this
  }

  subScalar(s: number) {
    this.x -= s
    this.y -= s
    this.z -= s
    this.w -= s

    return this
  }

  subVectors(a: Vector4, b: Vector4) {
    this.x = a.x - b.x
    this.y = a.y - b.y
    this.z = a.z - b.z
    this.w = a.w - b.w

    return this
  }

  multiply(v: Vector4) {
    this.x *= v.x
    this.y *= v.y
    this.z *= v.z
    this.w *= v.w

    return this
  }

  multiplyScalar(scalar: number) {
    this.x *= scalar
    this.y *= scalar
    this.z *= scalar
    this.w *= scalar

    return this
  }

  divideScalar(scalar: number) {
    return this.multiplyScalar(1 / scalar)
  }

  min(v: Vector4) {
    this.x = Math.min(this.x, v.x)
    this.y = Math.min(this.y, v.y)
    this.z = Math.min(this.z, v.z)
    this.w = Math.min(this.w, v.w)

    return this
  }

  max(v: Vector4) {
    this.x = Math.max(this.x, v.x)
    this.y = Math.max(this.y, v.y)
    this.z = Math.max(this.z, v.z)
    this.w = Math.max(this.w, v.w)

    return this
  }

  clamp(min: Vector4, max: Vector4) {
    // assumes min < max, componentwise

    this.x = MathUtils.clamp(this.x, min.x, max.x)
    this.y = MathUtils.clamp(this.y, min.y, max.y)
    this.z = MathUtils.clamp(this.z, min.z, max.z)
    this.w = MathUtils.clamp(this.w, min.w, max.w)

    return this
  }

  clampScalar(minVal: number, maxVal: number) {
    this.x = MathUtils.clamp(this.x, minVal, maxVal)
    this.y = MathUtils.clamp(this.y, minVal, maxVal)
    this.z = MathUtils.clamp(this.z, minVal, maxVal)
    this.w = MathUtils.clamp(this.w, minVal, maxVal)

    return this
  }

  clampLength(min: number, max: number) {
    const length = this.length()

    return this.divideScalar(length || 1).multiplyScalar(Math.max(min, Math.min(max, length)))
  }

  floor() {
    this.x = Math.floor(this.x)
    this.y = Math.floor(this.y)
    this.z = Math.floor(this.z)
    this.w = Math.floor(this.w)

    return this
  }

  ceil() {
    this.x = Math.ceil(this.x)
    this.y = Math.ceil(this.y)
    this.z = Math.ceil(this.z)
    this.w = Math.ceil(this.w)

    return this
  }

  round() {
    this.x = Math.round(this.x)
    this.y = Math.round(this.y)
    this.z = Math.round(this.z)
    this.w = Math.round(this.w)

    return this
  }

  roundToZero() {
    this.x = Math.trunc(this.x)
    this.y = Math.trunc(this.y)
    this.z = Math.trunc(this.z)
    this.w = Math.trunc(this.w)

    return this
  }

  negate() {
    this.x = -this.x
    this.y = -this.y
    this.z = -this.z
    this.w = -this.w

    return this
  }

  dot(v: Vector4) {
    return this.x * v.x + this.y * v.y + this.z * v.z + this.w * v.w
  }

  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w)
  }

  manhattanLength() {
    return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z) + Math.abs(this.w)
  }

  normalize() {
    return this.divideScalar(this.length() || 1)
  }

  setLength(length: number) {
    return this.normalize().multiplyScalar(length)
  }

  lerp(v: Vector4, alpha: number) {
    this.x += (v.x - this.x) * alpha
    this.y += (v.y - this.y) * alpha
    this.z += (v.z - this.z) * alpha
    this.w += (v.w - this.w) * alpha

    return this
  }

  lerpVectors(v1: Vector4, v2: Vector4, alpha: number) {
    this.x = v1.x + (v2.x - v1.x) * alpha
    this.y = v1.y + (v2.y - v1.y) * alpha
    this.z = v1.z + (v2.z - v1.z) * alpha
    this.w = v1.w + (v2.w - v1.w) * alpha

    return this
  }

  equals(v: Vector4) {
    return v.x === this.x && v.y === this.y && v.z === this.z && v.w === this.w
  }

  fromArray(array: number[], offset = 0) {
    this.x = array[offset]
    this.y = array[offset + 1]
    this.z = array[offset + 2]
    this.w = array[offset + 3]

    return this
  }

  toArray(array: number[] = [], offset = 0) {
    array[offset] = this.x
    array[offset + 1] = this.y
    array[offset + 2] = this.z
    array[offset + 3] = this.w

    return array
  }

  random() {
    this.x = Math.random()
    this.y = Math.random()
    this.z = Math.random()
    this.w = Math.random()

    return this
  }

  *[Symbol.iterator]() {
    yield this.x
    yield this.y
    yield this.z
    yield this.w
  }
}
