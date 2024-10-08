import * as MathUtils from './MathUtils'

export default class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x
    this.y = y
  }

  x: number
  y: number

  get width() {
    return this.x
  }

  set width(value) {
    this.x = value
  }

  get height() {
    return this.y
  }

  set height(value) {
    this.y = value
  }

  set(x: number, y: number) {
    this.x = x
    this.y = y

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

  setScalar(scalar: number) {
    this.x = scalar
    this.y = scalar

    return this
  }

  clone() {
    return new Vector2(this.x, this.y)
  }

  copy(v: Vector2) {
    this.x = v.x
    this.y = v.y

    return this
  }

  add(v: Vector2) {
    this.x += v.x
    this.y += v.y

    return this
  }

  addScalar(s: number) {
    this.x += s
    this.y += s

    return this
  }

  addVectors(a: Vector2, b: Vector2) {
    this.x = a.x + b.x
    this.y = a.y + b.y

    return this
  }

  addScaledVector(v: Vector2, s: number) {
    this.x += v.x * s
    this.y += v.y * s

    return this
  }

  sub(v: Vector2) {
    this.x -= v.x
    this.y -= v.y

    return this
  }

  subScalar(s: number) {
    this.x -= s
    this.y -= s

    return this
  }

  subVectors(a: Vector2, b: Vector2) {
    this.x = a.x - b.x
    this.y = a.y - b.y

    return this
  }

  multiply(v: Vector2) {
    this.x *= v.x
    this.y *= v.y

    return this
  }

  multiplyScalar(scalar: number) {
    this.x *= scalar
    this.y *= scalar

    return this
  }

  multiplyVectors(a: Vector2, b: Vector2) {
    this.x = a.x * b.x
    this.y = a.y * b.y

    return this
  }

  divide(v: Vector2) {
    this.x /= v.x
    this.y /= v.y

    return this
  }

  divideScalar(scalar: number) {
    return this.multiplyScalar(1 / scalar)
  }

  min(v: Vector2) {
    this.x = Math.min(this.x, v.x)
    this.y = Math.min(this.y, v.y)

    return this
  }

  max(v: Vector2) {
    this.x = Math.max(this.x, v.x)
    this.y = Math.max(this.y, v.y)

    return this
  }

  clamp(min: Vector2, max: Vector2) {
    // assumes min < max, componentwise

    this.x = MathUtils.clamp(this.x, min.x, max.x)
    this.y = MathUtils.clamp(this.y, min.y, max.y)

    return this
  }

  clampScalar(minVal: number, maxVal: number) {
    this.x = MathUtils.clamp(this.x, minVal, maxVal)
    this.y = MathUtils.clamp(this.y, minVal, maxVal)

    return this
  }

  clampLength(min: number, max: number) {
    const length = this.length()

    return this.divideScalar(length || 1).multiplyScalar(Math.max(min, Math.min(max, length)))
  }

  floor() {
    this.x = Math.floor(this.x)
    this.y = Math.floor(this.y)

    return this
  }

  ceil() {
    this.x = Math.ceil(this.x)
    this.y = Math.ceil(this.y)

    return this
  }

  round() {
    this.x = Math.round(this.x)
    this.y = Math.round(this.y)

    return this
  }

  roundToZero() {
    this.x = Math.trunc(this.x)
    this.y = Math.trunc(this.y)

    return this
  }

  negate() {
    this.x = -this.x
    this.y = -this.y

    return this
  }

  dot(v: Vector2) {
    return this.x * v.x + this.y * v.y
  }

  cross(v: Vector2) {
    return this.x * v.y - this.y * v.x
  }

  lengthSq() {
    return this.x * this.x + this.y * this.y
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y)
  }

  manhattanLength() {
    return Math.abs(this.x) + Math.abs(this.y)
  }

  normalize() {
    return this.divideScalar(this.length() || 1)
  }

  setLength(length: number) {
    return this.normalize().multiplyScalar(length)
  }

  angle() {
    // computes the angle in radians with respect to the positive x-axis

    const angle = Math.atan2(-this.y, -this.x) + Math.PI

    return angle
  }

  angleTo(v: Vector2) {
    const denominator = Math.sqrt(this.lengthSq() * v.lengthSq())

    if (denominator === 0) return Math.PI / 2

    const theta = this.dot(v) / denominator

    // clamp, to handle numerical problems

    return Math.acos(MathUtils.clamp(theta, -1, 1))
  }

  distanceTo(v: Vector2) {
    return Math.sqrt(this.distanceToSquared(v))
  }

  distanceToSquared(v: Vector2) {
    const dx = this.x - v.x,
      dy = this.y - v.y
    return dx * dx + dy * dy
  }

  manhattanDistanceTo(v: Vector2) {
    return Math.abs(this.x - v.x) + Math.abs(this.y - v.y)
  }

  lerp(v: Vector2, alpha: number) {
    this.x += (v.x - this.x) * alpha
    this.y += (v.y - this.y) * alpha

    return this
  }

  lerpVectors(v1: Vector2, v2: Vector2, alpha: number) {
    this.x = v1.x + (v2.x - v1.x) * alpha
    this.y = v1.y + (v2.y - v1.y) * alpha

    return this
  }

  equals(v: Vector2) {
    return v.x === this.x && v.y === this.y
  }

  rotateAround(center: Vector2, angle: number) {
    const c = Math.cos(angle),
      s = Math.sin(angle)

    const x = this.x - center.x
    const y = this.y - center.y

    this.x = x * c - y * s + center.x
    this.y = x * s + y * c + center.y

    return this
  }

  random() {
    this.x = Math.random()
    this.y = Math.random()

    return this
  }

  *[Symbol.iterator]() {
    yield this.x
    yield this.y
  }
}
