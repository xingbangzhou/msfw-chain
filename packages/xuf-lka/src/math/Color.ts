import {clamp} from './MathUtils'

export class Color {
  constructor(rOrHex: number, g?: number, b?: number) {
    this.r = 1
    this.g = 1
    this.b = 1

    this.set(rOrHex, g, b)
  }

  r: number
  g: number
  b: number

  set(rOrHex: number, g?: number, b?: number) {
    if (g === undefined && b === undefined) {
      this.setHex(rOrHex)
    } else {
      this.setRGB(rOrHex, g || 0, b || 0)
    }

    return this
  }

  setHex(hex: number) {
    hex = Math.floor(hex)

    this.r = ((hex >> 16) & 255) / 255
    this.g = ((hex >> 8) & 255) / 255
    this.b = (hex & 255) / 255

    return this
  }

  setRGB(r: number, g: number, b: number) {
    this.r = r
    this.g = g
    this.b = b

    return this
  }

  clone() {
    return new Color(this.r, this.g, this.b)
  }

  copy(color: Color) {
    this.r = color.r
    this.g = color.g
    this.b = color.b

    return this
  }

  getHex() {
    return (
      Math.round(clamp(this.r * 255, 0, 255)) * 65536 +
      Math.round(clamp(this.g * 255, 0, 255)) * 256 +
      Math.round(clamp(this.b * 255, 0, 255))
    )
  }

  equals(c: Color) {
    return c.r === this.r && c.g === this.g && c.b === this.b
  }

  fromArray(array: number[], offset = 0) {
    this.r = array[offset]
    this.g = array[offset + 1]
    this.b = array[offset + 2]

    return this
  }

  toArray(array: number[] = [], offset = 0) {
    array[offset] = this.r
    array[offset + 1] = this.g
    array[offset + 2] = this.b

    return array
  }

  toJSON() {
    return this.getHex()
  }

  *[Symbol.iterator]() {
    yield this.r
    yield this.g
    yield this.b
  }
}
