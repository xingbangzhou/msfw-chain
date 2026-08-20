import {Vector3} from '../math/Vector3'
import {TransformProps} from '../types'

function linear(cur: number, start: number, end: number) {
  return (cur - start) / (end - start)
}

function easeInQuad(cur: number, start: number, end: number) {
  const fas = (cur - start) / (end - start)
  return fas * fas
}

function easeOutQuad(cur: number, start: number, end: number) {
  const fas = (cur - start) / (end - start)
  return -fas * (fas - 2)
}

function easeInOutQuad(cur: number, start: number, end: number) {
  let fas = ((cur - start) * 2) / (end - start)
  if (fas < 1) return fas * fas * 0.5
  fas--
  return -0.5 * (fas * (fas - 2) - 1)
}

const timeFuncs = [linear, easeInQuad, easeOutQuad, easeInOutQuad]

export class Property<T = number[] | number> {
  constructor(data: {inFrame: number; value: T; timeFunc?: number}[]) {
    this.data = data
  }

  readonly data: {inFrame: number; value: T; timeFunc?: number}[]

  getValue(frameId: number) {
    if (!this.data?.length) return null
    const data0 = this.data[0]
    if (frameId <= data0.inFrame) return data0.value

    const l = this.data.length
    let idx = 0
    for (let i = 0, l = this.data.length; i < l; i++) {
      const item = this.data[i]
      if (item.inFrame === frameId) return item.value
      if (item.inFrame > frameId) break
      idx = i
    }
    if (idx >= l - 1) {
      return this.data[l - 1].value
    }
    // 计算
    const lhs = this.data[idx]
    const rhs = this.data[idx + 1]

    const timeFunc = rhs.timeFunc || 0
    const fas = timeFuncs[timeFunc](frameId, lhs.inFrame, rhs.inFrame)

    if (typeof lhs.value === 'number') {
      return lhs.value + (<number>rhs.value - lhs.value) * fas
    }

    const larr = <number[]>lhs.value
    const rarr = <number[]>rhs.value

    return larr.map((lvalue, index) => lvalue + (rarr[index] - lvalue) * fas)
  }
}

export class Transform3D {
  constructor(props: TransformProps) {
    const {anchorPoint, position, scale, opacity, rotationX, rotationY, rotationZ, orientation} = props

    this.anchorPoint = anchorPoint ? new Property<number[]>(anchorPoint) : undefined
    this.position = position ? new Property<number[]>(position) : undefined
    this.scale = scale ? new Property<number[]>(scale) : undefined
    this.opacity = opacity ? new Property<number>(opacity) : undefined
    this.rotationX = rotationX ? new Property<number>(rotationX) : undefined
    this.rotationY = rotationY ? new Property<number>(rotationY) : undefined
    this.rotationZ = rotationZ ? new Property<number>(rotationZ) : undefined
    this.orientation = orientation ? new Property<number[]>(orientation) : undefined
  }

  // 锚点
  anchorPoint?: Property<number[]>
  // 位置
  position?: Property<number[]>
  // 缩放
  scale?: Property<number[]>
  // 透明度
  opacity?: Property<number>
  // 旋转
  rotationX?: Property<number>
  // 旋转
  rotationY?: Property<number>
  // 旋转
  rotationZ?: Property<number>
  // 朝向
  orientation?: Property<number[]>

  getAnchorPoint(frameId: number) {
    const value = this.anchorPoint?.getValue(frameId) as number[] | undefined
    if (!value) return undefined

    const x = value[0] || 0
    const y = value[1] || 0
    const z = value[2] || 0

    return new Vector3(x, y, z)
  }

  getPosition(frameId: number) {
    const value = this.position?.getValue(frameId) as number[] | undefined
    if (!value) return undefined

    const x = value[0] || 0
    const y = value[1] || 0
    const z = value[2] || 0

    return new Vector3(x, y, z)
  }

  getScale(frameId: number) {
    const value = this.scale?.getValue(frameId) as number[] | undefined
    if (!value) return undefined

    const x = value[0] ?? 100
    const y = value[1] ?? 100
    const z = value[2] ?? 100

    return new Vector3(x, y, z)
  }

  getOpacity(frameId: number) {
    const value = this.opacity?.getValue(frameId) as number | undefined

    return (value || 0) * 0.01
  }

  getRotationX(frameId: number) {
    return (this.rotationX?.getValue(frameId) as number) || 0
  }

  getRotationY(frameId: number) {
    return (this.rotationY?.getValue(frameId) as number) || 0
  }

  getRotationZ(frameId: number) {
    return (this.rotationZ?.getValue(frameId) as number) || 0
  }

  getOrientation(frameId: number) {
    const value = (this.orientation?.getValue(frameId) || [0, 0, 0]) as number[]

    const x = value[0] || 0
    const y = value[1] || 0
    const z = value[2] || 0

    return new Vector3(x, y, z)
  }
}
