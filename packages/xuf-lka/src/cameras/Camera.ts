import {Vector3} from '../math/Vector3'
import {Object3D} from '../core/Object3D'
import {Matrix4} from '../math/Matrix4'

class Camera extends Object3D {
  constructor() {
    super()

    this.matrixWorldInverse = new Matrix4()

    this.projectionMatrix = new Matrix4()
    this.projectionMatrixInverse = new Matrix4()
  }

  readonly isCamera = true

  matrixWorldInverse: Matrix4

  projectionMatrix: Matrix4
  projectionMatrixInverse: Matrix4

  getWorldDirection(target: Vector3) {
    return super.getWorldDirection(target).negate()
  }

  updateMatrixWorld(force?: boolean) {
    super.updateMatrixWorld(force)

    this.matrixWorldInverse.copy(this.matrixWorld).invert()
  }

  updateWorldMatrix(updateParents: boolean, updateChildren: boolean) {
    super.updateWorldMatrix(updateParents, updateChildren)

    this.matrixWorldInverse.copy(this.matrixWorld).invert()
  }
}

export {Camera}
