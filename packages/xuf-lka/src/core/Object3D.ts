import {Quaternion} from '../math/Quaternion'
import {Vector3} from '../math/Vector3'
import {Matrix4} from '../math/Matrix4'
import * as MathUtils from '../math/MathUtils.js'

let _object3DId = 0

const _v1 = /*@__PURE__*/ new Vector3()
const _q1 = /*@__PURE__*/ new Quaternion()
const _m1 = /*@__PURE__*/ new Matrix4()
const _target = /*@__PURE__*/ new Vector3()

const _position = /*@__PURE__*/ new Vector3()
const _scale = /*@__PURE__*/ new Vector3()
const _quaternion = /*@__PURE__*/ new Quaternion()

const _xAxis = /*@__PURE__*/ new Vector3(1, 0, 0)
const _yAxis = /*@__PURE__*/ new Vector3(0, 1, 0)
const _zAxis = /*@__PURE__*/ new Vector3(0, 0, 1)
0
class Object3D {
  static DEFAULT_UP = /*@__PURE__*/ new Vector3(0, 1, 0)
  static DEFAULT_MATRIX_AUTO_UPDATE = true
  static DEFAULT_MATRIX_WORLD_AUTO_UPDATE = true

  constructor() {
    this.id = _object3DId++

    this.uuid = MathUtils.generateUUID()

    this.parent = null
    this.children = []

    this.up = Object3D.DEFAULT_UP.clone()

    this.position = new Vector3()
    this.scale = new Vector3(1, 1, 1)
    this.quaternion = new Quaternion()

    this.matrix = new Matrix4()
    this.matrixWorld = new Matrix4()

    this.matrixAutoUpdate = Object3D.DEFAULT_MATRIX_AUTO_UPDATE

    this.matrixWorldAutoUpdate = Object3D.DEFAULT_MATRIX_WORLD_AUTO_UPDATE // checked by the renderer
    this.matrixWorldNeedsUpdate = false
  }

  readonly id: number
  readonly uuid: string

  parent: Object3D | null
  children: Object3D[]

  up: Vector3
  position: Vector3
  quaternion: Quaternion
  scale: Vector3

  matrix: Matrix4
  matrixWorld: Matrix4
  matrixAutoUpdate: boolean
  matrixWorldAutoUpdate: boolean
  matrixWorldNeedsUpdate: boolean

  applyMatrix4(matrix: Matrix4) {
    if (this.matrixAutoUpdate === true) this.updateMatrix()

    this.matrix.premultiply(matrix)

    this.matrix.decompose(this.position, this.quaternion, this.scale)
  }

  applyQuaternion(q: Quaternion) {
    this.quaternion.premultiply(q)

    return this
  }

  setRotationFromAxisAngle(axis: Vector3, angle: number) {
    // assumes axis is normalized

    this.quaternion.setFromAxisAngle(axis, angle)
  }

  setRotationFromMatrix(m: Matrix4) {
    this.quaternion.setFromRotationMatrix(m)
  }

  setRotationFromQuaternion(q: Quaternion) {
    this.quaternion.copy(q)
  }

  rotateOnAxis(axis: Vector3, angle: number) {
    _q1.setFromAxisAngle(axis, angle)

    this.quaternion.multiply(_q1)

    return this
  }

  rotateOnWorldAxis(axis: Vector3, angle: number) {
    // rotate object on axis in world space
    // axis is assumed to be normalized
    // method assumes no rotated parent

    _q1.setFromAxisAngle(axis, angle)

    this.quaternion.premultiply(_q1)

    return this
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

  translateOnAxis(axis: Vector3, distance: number) {
    // translate object by distance along axis in object space
    // axis is assumed to be normalized

    _v1.copy(axis).applyQuaternion(this.quaternion)

    this.position.add(_v1.multiplyScalar(distance))

    return this
  }

  translateX(distance: number) {
    return this.translateOnAxis(_xAxis, distance)
  }

  translateY(distance: number) {
    return this.translateOnAxis(_yAxis, distance)
  }

  translateZ(distance: number) {
    return this.translateOnAxis(_zAxis, distance)
  }

  localToWorld(vector: Vector3) {
    this.updateWorldMatrix(true, false)

    return vector.applyMatrix4(this.matrixWorld)
  }

  worldToLocal(vector: Vector3) {
    this.updateWorldMatrix(true, false)

    return vector.applyMatrix4(_m1.copy(this.matrixWorld).invert())
  }

  lookAt(x: number, y: number, z: number) {
    _target.set(x, y, z)

    const parent = this.parent

    this.updateWorldMatrix(true, false)

    _position.setFromMatrixPosition(this.matrixWorld)

    if ((this as any).isCamera) {
      _m1.lookAt(_position, _target, this.up)
    } else {
      _m1.lookAt(_target, _position, this.up)
    }

    this.quaternion.setFromRotationMatrix(_m1)

    if (parent) {
      _m1.extractRotation(parent.matrixWorld)
      _q1.setFromRotationMatrix(_m1)
      this.quaternion.premultiply(_q1.invert())
    }
  }

  add(object: Object3D, ...args: Object3D[]) {
    if (args.length > 1) {
      this.add(object)
      for (let i = 0; i < args.length; i++) {
        this.add(args[i])
      }

      return this
    }

    if (object === (this as any)) {
      console.error("Object3D.add: object can't be added as a child of itself.", object)
      return this
    }

    object.removeFromParent()
    object.parent = this
    this.children.push(object)

    return this
  }

  remove(...args: Object3D[]) {
    if (args.length === 0) return this
    if (args.length > 1) {
      for (let i = 0; i < args.length; i++) {
        this.remove(args[i])
      }

      return this
    }
    const object = args[0]
    const index = this.children.indexOf(object)

    if (index !== -1) {
      object.parent = null
      this.children.splice(index, 1)
    }

    return this
  }

  removeFromParent() {
    const parent = this.parent

    if (parent !== null) {
      parent.remove(this as any)
    }

    return this
  }

  clear() {
    return this.remove(...this.children)
  }

  attach(object: Object3D) {
    this.updateWorldMatrix(true, false)

    _m1.copy(this.matrixWorld).invert()

    if (object.parent !== null) {
      object.parent.updateWorldMatrix(true, false)

      _m1.multiply(object.parent.matrixWorld)
    }

    object.applyMatrix4(_m1)

    object.removeFromParent()
    object.parent = this
    this.children.push(object)

    object.updateWorldMatrix(false, true)

    return this
  }

  getObjectById(id: number) {
    return this.getObjectByProperty('id', id)
  }

  getObjectByProperty(prop: string, value: any): Object3D | undefined {
    const _this = this as any
    if (_this[prop] === value) return this

    for (let i = 0, l = this.children.length; i < l; i++) {
      const child = this.children[i]
      const object = child.getObjectByProperty(prop, value)

      if (object !== undefined) {
        return object
      }
    }

    return undefined
  }

  getObjectsByProperty(prop: string, value: any, result: Object3D[] = []) {
    const _this = this as any
    if (_this[prop] === value) result.push(_this)

    const children = this.children

    for (let i = 0, l = children.length; i < l; i++) {
      children[i].getObjectsByProperty(prop, value, result)
    }

    return result
  }

  getWorldPosition(target: Vector3) {
    this.updateWorldMatrix(true, false)

    return target.setFromMatrixPosition(this.matrixWorld)
  }

  getWorldQuaternion(target: Quaternion) {
    this.updateWorldMatrix(true, false)

    this.matrixWorld.decompose(_position, target, _scale)

    return target
  }

  getWorldScale(target: Vector3) {
    this.updateWorldMatrix(true, false)

    this.matrixWorld.decompose(_position, _quaternion, target)

    return target
  }

  getWorldDirection(target: Vector3) {
    this.updateWorldMatrix(true, false)

    const e = this.matrixWorld.elements

    return target.set(e[8], e[9], e[10]).normalize()
  }

  traverse(callback: (object: Object3D) => any) {
    callback(this as any)

    const children = this.children

    for (let i = 0, l = children.length; i < l; i++) {
      children[i].traverse(callback)
    }
  }

  updateMatrix() {
    this.matrix.compose(this.position, this.quaternion, this.scale)

    this.matrixWorldNeedsUpdate = true
  }

  updateMatrixWorld(force?: boolean) {
    if (this.matrixAutoUpdate) this.updateMatrix()

    if (this.matrixWorldNeedsUpdate || force) {
      if (this.matrixWorldAutoUpdate === true) {
        if (this.parent === null) {
          this.matrixWorld.copy(this.matrix)
        } else {
          this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix)
        }
      }

      this.matrixWorldNeedsUpdate = false

      force = true
    }

    const children = this.children

    for (let i = 0, l = children.length; i < l; i++) {
      const child = children[i]

      child.updateMatrixWorld(force)
    }
  }

  updateWorldMatrix(updateParents: boolean, updateChildren: boolean) {
    const parent = this.parent

    if (updateParents === true && parent !== null) {
      parent.updateWorldMatrix(true, false)
    }

    if (this.matrixAutoUpdate) this.updateMatrix()

    if (this.matrixWorldAutoUpdate === true) {
      if (this.parent === null) {
        this.matrixWorld.copy(this.matrix)
      } else {
        this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix)
      }
    }

    if (updateChildren === true) {
      const children = this.children

      for (let i = 0, l = children.length; i < l; i++) {
        const child = children[i]

        child.updateWorldMatrix(false, true)
      }
    }
  }

  clone(recursive?: boolean) {
    return new Object3D().copy(this, recursive)
  }

  copy(source: Object3D, recursive = true) {
    this.up.copy(source.up)

    this.position.copy(source.position)
    this.quaternion.copy(source.quaternion)
    this.scale.copy(source.scale)

    this.matrix.copy(source.matrix)
    this.matrixWorld.copy(source.matrixWorld)

    this.matrixAutoUpdate = source.matrixAutoUpdate

    this.matrixWorldAutoUpdate = source.matrixWorldAutoUpdate
    this.matrixWorldNeedsUpdate = source.matrixWorldNeedsUpdate

    if (recursive === true) {
      for (let i = 0; i < source.children.length; i++) {
        const child = source.children[i]
        this.add(child.clone())
      }
    }

    return this
  }
}

export {Object3D}
