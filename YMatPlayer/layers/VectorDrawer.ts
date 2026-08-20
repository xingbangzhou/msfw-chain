import RenderStore, {FrameInfo} from '../renderer/common/RenderStore'
import {LayerVectorProps} from '../types'
import Drawer from './BaseDrawer'
import Framebuffer from '../renderer/webgl/Framebuffer'
import {WebGLRendererContext} from '../utils/shims'
import {drawTexture} from '../renderer/common/primitives'
import LayerView from './LayerView'
import {Matrix4} from '../math/Matrix4'

export default class VectorDrawer extends Drawer<LayerVectorProps> {
  private vecView = new LayerView()

  private framebuffer: Framebuffer | null = null

  get childLayers() {
    return this.vecView.childLayers
  }

  async init(gl: WebGLRendererContext) {
    const vecView = this.vecView
    this.framebuffer = new Framebuffer(gl)

    const ref = this.ref
    const width = ref.props.width
    const height = ref.props.height
    vecView.setViewSize(width, height)
    vecView.viewOffset.set(-width * 0.5, height * 0.5)

    const mainInFrame = ref.mainInFrame + ref.props.inFrame
    const mainOutFrame = ref.mainInFrame + ref.props.outFrame
    await vecView.initLayers(ref.props.layers || [], gl, ref.store, mainInFrame, mainOutFrame)
    // 子图层有可点击则需要绘制
    ref.clickAble = !!this.childLayers?.some(el => el.clickAble === true)
  }

  draw(gl: WebGLRendererContext, matrix: Matrix4, frameInfo: FrameInfo) {
    const framebuffer = this.framebuffer
    const subLayers = this.vecView.childLayers
    if (!framebuffer || !subLayers?.length) return

    const ref = this.ref
    const width = ref.props.width
    const height = ref.props.height
    const opacity = ref.getOpacity(frameInfo.frameId, frameInfo.opacity)

    // 子图层渲染
    framebuffer.bind()
    framebuffer.viewport(width, height)

    const frameId = ref.getFrameId(frameInfo.frameId) - ref.props.inFrame

    const vecFrameInfo = {frameId, width: width, height: height, opacity, framebuffer}
    const cameraMatrix = this.vecView.cameraMatrix

    for (let i = 0, l = subLayers.length; i < l; i++) {
      const layer = subLayers[i]
      if (!layer.isFrameShow(vecFrameInfo.frameId)) continue
      layer.render(gl, cameraMatrix, vecFrameInfo)
    }

    // 上屏
    const parentFramebuffer = frameInfo.framebuffer
    parentFramebuffer.bind()
    parentFramebuffer.viewport(frameInfo.width, frameInfo.height, true)

    gl.activeTexture(gl.TEXTURE0)
    framebuffer.texture?.bind()
    gl.uniform1f(gl.uniforms.opacity, opacity)
    gl.uniformMatrix4fv(gl.uniforms.matrix, false, matrix.elements)

    drawTexture(this.getAttribBuffer(gl), width, height, true, ref.hueSaturation, ref.brightness, ref.contrast)

    // 释放
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  destroy() {
    super.destroy()

    this.framebuffer?.destory()
    this.framebuffer = null

    this.vecView.destroy()
  }

  drawID(gl: WebGLRendererContext, matrix: Matrix4, mainFrameInfo: FrameInfo): void {
    const framebuffer = this.framebuffer
    const subLayers = this.vecView.childLayers
    if (!framebuffer || !subLayers?.length) return

    const ref = this.ref
    const width = ref.props.width
    const height = ref.props.height
    const opacity = ref.getOpacity(mainFrameInfo.frameId, mainFrameInfo.opacity)

    // 子图层渲染
    framebuffer.bind()
    framebuffer.viewport(width, height)

    const frameId = mainFrameInfo.frameId - ref.props.inFrame

    const frameInfo = {frameId, width: width, height: height, opacity, framebuffer}
    const cameraMatrix = this.vecView.cameraMatrix
    let hasClickAble = false
    for (let i = 0, l = subLayers.length; i < l; i++) {
      const layer = subLayers[i]
      if (layer.clickAble) hasClickAble = true
      if (!layer.isFrameShow(frameInfo.frameId) || !hasClickAble) continue
      layer.renderID(gl, cameraMatrix, frameInfo)
    }

    // 上屏
    const mainFramebuffer = mainFrameInfo.framebuffer
    mainFramebuffer.bind()
    mainFramebuffer.viewport(mainFrameInfo.width, mainFrameInfo.height, true)

    gl.activeTexture(gl.TEXTURE0)
    framebuffer.texture?.bind()
    gl.uniform1f(gl.uniforms.opacity, 1.0)
    gl.uniformMatrix4fv(gl.uniforms.matrix, false, matrix.elements)

    drawTexture(this.getAttribBuffer(gl), width, height, true)

    // 释放
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  checkReset(): void {
    this.childLayers?.forEach(el => el.checkReset())
  }
}
