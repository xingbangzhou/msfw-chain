class Vector2 {
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

  *[Symbol.iterator]() {
    yield this.x
    yield this.y
  }
}

export {Vector2}
