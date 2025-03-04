import {Camera} from '../cameras/Camera'
import {Vector4} from '../math/Vector4'
import {createCanvasElement} from '../utils'
import {Scene} from './scenes/Scene'

export interface WebGLRendererParameters {
  canvas?: HTMLCanvasElement | OffscreenCanvas

  /**
   * default is false.
   */
  alpha?: boolean

  /**
   * default is true.
   */
  premultipliedAlpha?: boolean
}

export class WebGLRenderer {
  constructor(parameters: WebGLRendererParameters = {}) {
    const {canvas = createCanvasElement(), alpha = false, premultipliedAlpha = true} = parameters

    this.canvas = canvas

    const width = canvas.width
    const height = canvas.height

    this._viewport = new Vector4(0, 0, width, height)

    canvas.addEventListener('webglcontextlost', this.onContextLost, false)
    canvas.addEventListener('webglcontextrestored', this.onContextRestore, false)
    canvas.addEventListener('webglcontextcreationerror', this.onContextCreationError, false)

    this._gl = canvas.getContext('webgl2', {alpha: true})

    this.initContext()
  }

  readonly canvas: HTMLCanvasElement | OffscreenCanvas

  private _gl: RenderingContext | null
  private _viewport: Vector4
  private _isContextLost = false

  setSize(width: number, height: number) {
    const canvas = this.canvas

    canvas.width = Math.floor(width)
    canvas.height = Math.floor(height)

    this.setViewport(0, 0, width, height)
  }

  setViewport(x: number, y: number, width: number, height: number) {
    this._viewport.set(x, y, width, height)
  }

  dispose() {}

  render(scene: Scene, camera: Camera) {
    if (this._isContextLost === true) return

    if (scene.matrixWorldAutoUpdate === true) scene.updateMatrixWorld()

    if (camera.matrixWorldAutoUpdate === true) camera.updateMatrixWorld()
  }

  private initContext() {}

  private onContextLost = (event: Event) => {
    event.preventDefault()

    console.log('LIB3D.WebGLRenderer: Context Lost.')

    this._isContextLost = true
  }

  private onContextRestore = () => {
    console.log('LIB3D.WebGLRenderer: Context Restored.')

    this._isContextLost = false

    this.initContext()
  }

  private onContextCreationError = (event: Event) => {
    console.error('LIB3D.WebGLRenderer: Context could not be created, Error: ', (event as any).statusMessage)
  }
}
