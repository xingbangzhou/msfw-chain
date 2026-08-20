export class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x
    this.y = y
    this.z = z
  }

  x: number
  y: number
  z: number

  set(x: number, y: number, z?: number) {
    if (z === undefined) z = this.z // sprite.scale.set(x,y)

    this.x = x
    this.y = y
    this.z = z

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

  clone() {
    return new Vector3(this.x, this.y, this.z)
  }

  copy(v: Vector3) {
    this.x = v.x
    this.y = v.y
    this.z = v.z

    return this
  }

  subVectors(a: Vector3, b: Vector3) {
    this.x = a.x - b.x
    this.y = a.y - b.y
    this.z = a.z - b.z

    return this
  }

  multiplyScalar(scalar: number) {
    this.x *= scalar
    this.y *= scalar
    this.z *= scalar

    return this
  }

  divideScalar(scalar: number) {
    return this.multiplyScalar(1 / scalar)
  }

  min(v: Vector3) {
    this.x = Math.min(this.x, v.x)
    this.y = Math.min(this.y, v.y)
    this.z = Math.min(this.z, v.z)

    return this
  }

  max(v: Vector3) {
    this.x = Math.max(this.x, v.x)
    this.y = Math.max(this.y, v.y)
    this.z = Math.max(this.z, v.z)

    return this
  }

  clamp(min: Vector3, max: Vector3) {
    // assumes min < max, componentwise

    this.x = Math.max(min.x, Math.min(max.x, this.x))
    this.y = Math.max(min.y, Math.min(max.y, this.y))
    this.z = Math.max(min.z, Math.min(max.z, this.z))

    return this
  }

  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z)
  }

  normalize() {
    return this.divideScalar(this.length() || 1)
  }

  crossVectors(a: Vector3, b: Vector3) {
    const ax = a.x,
      ay = a.y,
      az = a.z
    const bx = b.x,
      by = b.y,
      bz = b.z

    this.x = ay * bz - az * by
    this.y = az * bx - ax * bz
    this.z = ax * by - ay * bx

    return this
  }

  equals(v: Vector3) {
    return v.x === this.x && v.y === this.y && v.z === this.z
  }

  fromArray(array: number[], offset = 0) {
    this.x = array[offset]
    this.y = array[offset + 1]
    this.z = array[offset + 2]

    return this
  }

  toArray(array: number[] = [], offset = 0) {
    array[offset] = this.x
    array[offset + 1] = this.y
    array[offset + 2] = this.z

    return array
  }

  *[Symbol.iterator]() {
    yield this.x
    yield this.y
    yield this.z
  }
}
