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

    const canvasWidth = canvas.width
    const canvasHeight = canvas.height
    this._width = canvasWidth
    this._height = canvasHeight

    this._pixelRatio = 1
    this._viewport = new Vector4(0, 0, canvasWidth, canvasHeight)

    canvas.addEventListener('webglcontextlost', this.onContextLost, false)
    canvas.addEventListener('webglcontextrestored', this.onContextRestore, false)
    canvas.addEventListener('webglcontextcreationerror', this.onContextCreationError, false)

    this._gl = canvas.getContext('webgl2', {
      alpha: true,
    }) as WebGL2RenderingContext

    this.initContext()
  }

  readonly canvas: HTMLCanvasElement | OffscreenCanvas

  private _gl: WebGL2RenderingContext
  private _isContextLost = false
  private _width: number
  private _height: number
  private _pixelRatio: number
  private _viewport: Vector4

  getContext() {
    return this._gl
  }

  setPixelRatio(value: number) {
    this._pixelRatio = value

    this.setSize(this._width, this._height)
  }

  setSize(width: number, height: number) {
    const canvas = this.canvas

    this._width = width
    this._height = height

    const pixelRatio = this._pixelRatio
    canvas.width = Math.floor(width * pixelRatio)
    canvas.height = Math.floor(height * pixelRatio)

    this.setViewport(0, 0, width, height)
  }

  setViewport(x: number, y: number, width: number, height: number) {
    this._viewport.set(x, y, width, height)
  }

  dispose() {
    const canvas = this.canvas

    canvas.removeEventListener('webglcontextlost', this.onContextLost, false)
    canvas.removeEventListener('webglcontextrestored', this.onContextRestore, false)
    canvas.removeEventListener('webglcontextcreationerror', this.onContextCreationError, false)
  }

  render(scene: Scene, camera: Camera) {
    if (this._isContextLost === true) return

    if (scene.matrixWorldAutoUpdate === true) scene.updateMatrixWorld()

    if (camera.matrixWorldAutoUpdate === true) camera.updateMatrixWorld()
  }

  private initContext() {}

  private onContextLost = (event: Event) => {
    console.log('ANIM3D.WebGLRenderer: Context Lost.')

    event.preventDefault()

    this._isContextLost = true
  }

  private onContextRestore = () => {
    console.log('ANIM3D.WebGLRenderer: Context Restored.')

    this._isContextLost = false

    this.initContext()
  }

  private onContextCreationError = (event: Event) => {
    console.error('ANIM3D.WebGLRenderer: Context could not be created, Error: ', (event as any).statusMessage)
  }
}
