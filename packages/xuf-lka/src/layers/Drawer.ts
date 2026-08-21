import {Camera} from '../cameras/Camera'
import {PlayerState} from '../PlayerState'
import {WebGLRenderer} from '../renderers/WebGLRenderer'
import type {Layer} from './Layer'
import type {LayerView} from './LayerView'

export interface RenderContext {
  frameId: number
  camera: Camera
  layerView: LayerView
}

export interface DrawContext extends RenderContext {
  layer: Layer
}

export interface DrawerLike {
  init(): Promise<void>

  draw(context: DrawContext): void

  dispose(): void
}

export abstract class Drawer implements DrawerLike {
  constructor(
    protected readonly renderer: WebGLRenderer,
    protected readonly state: PlayerState,
  ) {}

  abstract init(): Promise<void>

  abstract draw(context: DrawContext): void

  dispose() {}
}

export type DrawerConstructor<D extends DrawerLike = DrawerLike> = new (
  renderer: WebGLRenderer,
  state: PlayerState
) => D
