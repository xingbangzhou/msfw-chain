import {Color} from '../../math/Color'

export default class Color4 extends Color {
  constructor(r: number, g: number, b: number, a = 1) {
    super(r, g, b)

    this.a = a
  }

  a: number

  set(r: number, g: number, b: number, a = 1) {
    this.a = a

    return super.set(r, g, b)
  }

  copy(color: Color4 | Color) {
    if (color instanceof Color4) this.a = color.a

    return super.copy(color)
  }

  clone() {
    return new Color4(this.r, this.g, this.b, this.a)
  }
}
