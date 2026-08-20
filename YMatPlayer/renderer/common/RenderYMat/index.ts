import {WebGLRendererContext} from '../../../utils/shims'
import {
  LayerProps,
  LayerType,
  LayerVideoProps,
  PlayInfo,
  TransformProps,
  YMatKeyProps,
  YMatPlayProps,
} from '../../../types'
import AttribBuffer from '../../webgl/AttribBuffer'
import Framebuffer from '../../webgl/Framebuffer'
import RenderImpl from '../RenderImpl'
import RenderStore from '../RenderStore'
import {loadYMat} from './utils'
import Program from '../../webgl/Program'
import Layer, {createLayer} from '../../../layers/Layer'
import LayerView from '../../../layers/LayerView'
import {getFillCoord, RGB2ID} from '../../../math/mathUtils'
import VectorDrawer from '../../../layers/VectorDrawer'
import {identMat4} from '../../../math/Matrix4'
import {getFragment, getVertex} from '../../shaders/ymat.glsl'

const uniformNames = [
  'matrix',
  'opacity',
  'isAlpha',
  'blendMode',
  'maskMode',
  // 亮度和对比度
  'brightness',
  'contrast',
  // 色相和饱和度
  'colorize',
  'hue',
  'saturation',
  'lightness',
  // 抓取模式
  'grapMode',
]

export default class RenderYMat extends LayerView implements RenderImpl {
  constructor(store: RenderStore, gl: WebGLRendererContext) {
    super()
    this.store = store
    this.gl = gl
  }

  readonly store: RenderStore
  readonly gl: WebGLRendererContext

  private program: Program | null = null
  private framebuffer: Framebuffer | null = null
  private attribBuffer: AttribBuffer | null = null
  private attrPosition: number[] = []
  private attrTexCoord: number[] = []

  private isEmptyMockJson = false

  // 抓取
  private grapFramebuffer: Framebuffer | null = null

  isReady() {
    if (this.isEmptyMockJson) {
      return true
    }
    return this.childLayers?.length !== 0 && !!this.program
  }

  async load(props: {
    file: ArrayBufferLike | string
    keys?: YMatKeyProps | YMatKeyProps[]
    mockJson?: YMatPlayProps
    isPreview?: boolean
  }) {
    this.isEmptyMockJson = false
    const store = this.store
    store.clear()

    const info = await loadYMat(props.file, props.mockJson)
    if (!info || this.isDestroied) {
      throw `RenderYmat, load error: info(${!!info}), destroied:(${!!this.isDestroied})`
    }
    store.debug && store.ctx.log('RenderYMat', 'loadYMat, result:', info)
    store.setYMatPlayProps(info.playInfo, info.sourceMap)

    const gl = this.gl
    this.onResize(gl.canvas.width, gl.canvas.height)

    if (props.keys) {
      store.setKeys(props.keys)
    }
    // 初始化视图
    await this.initView(gl, store)

    this.useProgram()

    const keys = store.getAllKeyInfo()
    return {
      keys,
      info: {
        width: store.width,
        height: store.height,
        frames: Math.round(store.duration * store.frameRate),
        duration: store.duration,
        frameRate: store.frameRate,
      } as PlayInfo,
      ...(props.isPreview ? {previewProps: store.playProps as YMatPlayProps} : undefined),
    }
  }

  async loadJson(mockJson: YMatPlayProps) {
    this.isEmptyMockJson = true
    // 加载Store
    const store = this.store
    store.clear()
    store.setYMatPlayProps(mockJson)

    const canvasWidth = this.gl.canvas.width
    const canvasHeight = this.gl.canvas.height
    this.onResize(canvasWidth, canvasHeight)

    // 初始化视图
    await this.initView(this.gl, store)

    this.useProgram()

    const keys = store.getAllKeyInfo()
    return {
      keys,
      info: {
        width: store.width,
        height: store.height,
        frames: Math.round(store.duration * store.frameRate),
        duration: store.duration,
        frameRate: store.frameRate,
      } as PlayInfo,
    }
  }

  async setKeys(keys: YMatKeyProps | YMatKeyProps[]) {
    this.store.setKeys(keys)

    const gl = this.gl
    // 重置图层
    const childLayers = this.childLayers
    if (childLayers) {
      await Promise.all(
        childLayers.map(
          layer =>
            new Promise(resolve => {
              layer.reset(gl).then(resolve)
            }),
        ),
      )
    }
  }

  onResize(canvasWidth: number, canvasHeight: number) {
    const store = this.store
    const width = store.width
    const height = store.height
    if (!width || !height) return
    // 适配尺寸
    const {lx, ly, rx, ry, sw, sh} = getFillCoord(width, height, canvasWidth, canvasHeight, store.fillMode)
    const x1 = -sw
    const y1 = -sh
    const x2 = sw
    const y2 = sh
    this.attrPosition = [x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2]
    const tx1 = lx
    const ty1 = ly
    const tx2 = rx
    const ty2 = ry
    this.attrTexCoord = [tx1, ty1, tx2, ty1, tx1, ty2, tx1, ty2, tx2, ty1, tx2, ty2]
  }

  render() {
    const gl = this.gl

    const framebuffer = this.framebuffer || (this.framebuffer = new Framebuffer(gl))
    const frameId = this.store.frameId
    const width = this.store.width
    const height = this.store.height
    if (width <= 0 || height <= 0) return

    const frames = this.store.frames
    const frameInfo = {
      frames,
      frameId,
      width,
      height,
      opacity: 1.0,
      framebuffer: framebuffer,
    }

    // Alpha预乘、混合模式
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    framebuffer.bind()
    framebuffer.viewport(width, height)

    const cameraMatrix = this.cameraMatrix
    const childLayers = this.childLayers || []
    for (let i = 0, l = childLayers.length; i < l; i++) {
      const layer = childLayers[i]
      if (!layer.isFrameShow(frameInfo.frameId)) continue
      layer.render(gl, cameraMatrix, frameInfo)
    }

    // 上屏
    const canvasWidth = gl.canvas.width
    const canvasHeight = gl.canvas.height
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.disable(gl.BLEND)

    gl.activeTexture(gl.TEXTURE0)
    framebuffer.texture?.bind()
    gl.uniform1f(gl.uniforms.opacity, 1.0)
    gl.uniformMatrix4fv(gl.uniforms.matrix, false, identMat4)

    const attribBuffer = this.attribBuffer || (this.attribBuffer = new AttribBuffer(gl))
    attribBuffer.setArribInfo(gl.attribs.position, {
      data: this.attrPosition,
    })
    attribBuffer.setArribInfo(gl.attribs.texcoord, {
      data: this.attrTexCoord,
    })

    const primitiveType = gl.TRIANGLES
    gl.drawArrays(primitiveType, 0, 6)
  }

  destroy() {
    super.destroy()

    this.program?.destroy()
    this.program = null
    this.framebuffer?.destory()
    this.framebuffer = null
    this.attribBuffer?.destroy()
    this.attribBuffer = null
  }

  // 动态插入元素
  async insertItem(
    layerInfo: LayerProps & {
      maskUrl?: string
    },
  ) {
    const nowFrame = this.store.frameId
    // 修改inFrame
    layerInfo.inFrame = (layerInfo.inFrame || 0) + nowFrame
    layerInfo.outFrame = layerInfo.outFrame ? layerInfo.outFrame + nowFrame : 0
    const keys = ['anchorPoint', 'position', 'scale', 'opacity', 'rotationX', 'rotationY', 'rotationZ', 'orientation']
    if (layerInfo.transform) {
      keys.forEach((key: string) => {
        const arr = (layerInfo.transform as any)[key]
        if (Array.isArray(arr)) {
          arr.forEach((item: any) => {
            item.inFrame = (item.inFrame || 0) + nowFrame
          })
        }
      })
    }
    if ((layerInfo as any).options && (layerInfo as any).options.zoom) {
      ;(layerInfo as any).options.zoom.forEach((item: any) => {
        item.inFrame = (item.inFrame || 0) + nowFrame
      })
    }
    if ((layerInfo as any).dashesInfo && (layerInfo as any).dashesInfo.offset) {
      ;(layerInfo as any).dashesInfo.offset.forEach((item: any) => {
        item.inFrame = (item.inFrame || 0) + nowFrame
      })
    }
    // 如果有遮罩，就设置一下遮罩类型
    if (layerInfo.maskUrl) {
      layerInfo.trackMatteType = 1
    }
    // 特殊处理视频props
    if (layerInfo.type === LayerType.Video) {
      ;(layerInfo as LayerVideoProps).videoUrl = (layerInfo as LayerVideoProps).content
    }
    const newLayer = createLayer({...layerInfo}, this.store, this)
    if (!newLayer) {
      return false
    }
    // 如果有遮罩图片
    if (layerInfo.maskUrl) {
      const maskId = layerInfo.id + 10086
      const maskLayerInfo = {
        id: maskId,
        type: 'image',
        content: layerInfo.maskUrl,
        name: `${maskId}`,
        fillMode: 1,
        transform: {
          anchorPoint: [
            {
              inFrame: 0,
              value: [0, 0, 0],
            },
          ],
          position: [
            {
              inFrame: 0,
              value: [0, 0, 0],
            },
          ],
          opacity: [
            {
              inFrame: 0,
              value: 100,
            },
          ],
          rotationX: [
            {
              inFrame: 0,
              value: 0,
            },
          ],
          rotationY: [
            {
              inFrame: 0,
              value: 0,
            },
          ],
          rotationZ: [
            {
              inFrame: 0,
              value: 0,
            },
          ],
          scale: [
            {
              inFrame: 0,
              value: [100, 100, 100],
            },
          ],
        },
        isTrackMatte: true,
        width: this.store.width,
        height: this.store.height,
        blendMode: 0,
        effects: {},
        masks: [],
        inFrame: layerInfo.inFrame,
        outFrame: layerInfo.outFrame,
      }
      const maskLayer = createLayer({...maskLayerInfo} as any, this.store, this)
      if (!maskLayer) {
        return false
      }
      await maskLayer.init(this.gl)
      // this._rootLayers.push(maskLayer)
      newLayer.trackLayer = maskLayer
    }
    await newLayer.init(this.gl)
    this.childLayers?.push(newLayer)
    return true
  }

  // 修改动态元素
  transformItem(tranformInfo: TransformProps, itemId: number) {
    const nowFrame = this.store.frameId
    // 修改inFrame
    const keys = ['anchorPoint', 'position', 'scale', 'opacity', 'rotationX', 'rotationY', 'rotationZ', 'orientation']
    keys.forEach((key: string) => {
      const arr = (tranformInfo as any)[key]
      if (Array.isArray(arr)) {
        arr.forEach((item: any) => {
          item.inFrame = (item.inFrame || 0) + nowFrame
        })
      }
    })
    const getVectorSubLayer = (subLayers: Layer[], id: number) => {
      // 先按id搜索
      for (let i = 0, i_max = subLayers.length; i < i_max; i++) {
        const subLayer = subLayers[i]
        if (subLayer.id === id) {
          return subLayer
        }
      }
      return null
    }

    const childLayers = this.childLayers
    if (!childLayers) return
    for (let i = 0, i_max = childLayers.length; i < i_max; i++) {
      const layerItem = childLayers[i]
      // 兼容vector图层
      if (layerItem.type === 'vector') {
        const subLayers = (layerItem.drawer as VectorDrawer).childLayers
        if (subLayers) {
          const subItem = getVectorSubLayer(subLayers, itemId)
          if (subItem) {
            subItem.setTransform(tranformInfo)
          }
        }
      } else if (layerItem.id === itemId) {
        layerItem.setTransform(tranformInfo)
      }
    }
    return true
  }

  // 抓取图层
  grap(x: number, y: number) {
    const gl = this.gl
    if (!gl) return null

    const framebuffer = this.grapFramebuffer || (this.grapFramebuffer = new Framebuffer(gl))
    const frameId = this.store.frameId
    const width = this.store.width
    const height = this.store.height
    if (width <= 0 || height <= 0) return null

    const frames = this.store.frames
    const frameInfo = {
      frames,
      frameId,
      width,
      height,
      opacity: 1.0,
      framebuffer: framebuffer,
      inGrap: true,
    }

    // Alpha预乘、混合模式
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    framebuffer.bind()
    framebuffer.viewport(width, height)
    gl.uniform1i(gl.uniforms.grapMode, 1)

    let hasClickAble = false
    const cameraMatrix = this.cameraMatrix
    const childLayers = this.childLayers || []
    for (let i = 0, l = childLayers.length; i < l; i++) {
      const layer = childLayers[i]
      if (layer.clickAble) hasClickAble = true
      if (!layer.isFrameShow(frameInfo.frameId) || !hasClickAble) continue
      layer.renderID(gl, cameraMatrix, frameInfo)
    }

    // 绘制成屏幕大小
    const canvasWidth = gl.canvas.width
    const canvasHeight = gl.canvas.height
    if (canvasWidth <= 0 || canvasHeight <= 0) return null

    const texture = framebuffer.reset()
    framebuffer.bind()
    framebuffer.viewport(canvasWidth, canvasHeight)
    gl.activeTexture(gl.TEXTURE0)
    texture?.bind()

    gl.uniform1i(gl.uniforms.grapMode, 0)
    gl.uniform1f(gl.uniforms.opacity, 1.0)
    gl.uniformMatrix4fv(gl.uniforms.matrix, false, identMat4)

    const attribBuffer = this.attribBuffer || (this.attribBuffer = new AttribBuffer(gl))
    attribBuffer.setArribInfo(gl.attribs.position, {
      data: this.attrPosition,
    })
    attribBuffer.setArribInfo(gl.attribs.texcoord, {
      data: this.attrTexCoord,
    })
    const primitiveType = gl.TRIANGLES
    gl.drawArrays(primitiveType, 0, 6)

    const data = new Uint8Array(4)
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, data)
    const id = RGB2ID(data as unknown as [number, number, number])

    const store = this.store
    const layerProps = store.getLayerProps(id)
    if (!layerProps) return null

    store.debug && store.ctx.log('RenderYMat', 'grap: ', layerProps)

    return {
      id,
      name: layerProps.name || '',
      type: layerProps.type,
    }
  }

  checkReset() {
    this.childLayers?.forEach(el => el.checkReset())
  }

  private async initView(gl: WebGLRendererContext, store: RenderStore) {
    const width = store.width
    const height = store.height
    const frames = store.frames

    this.setViewSize(width, height)
    this.viewOffset.set(-width * 0.5, height * 0.5)

    await this.initLayers(store.rootLayers || [], gl, store, 0, frames)
  }

  private useProgram() {
    if (this.program) this.program.destroy()

    const gl = this.gl
    const store = this.store
    const program = (this.program = new Program(gl, {
      vertexShader: getVertex({webgl2: gl.isWebGL2}),
      fragmentShader: getFragment({
        webgl2: gl.isWebGL2,
        blendEnums: store.blendEnums,
        brightnessContrast: store.brightnessContrast,
        hueSat: store.hueSat,
      }),
    }))
    if (program.invalid()) {
      // Program创建失败
      console.error(`RenderYMat Program is invalid!`)
      throw 'RenderYMat Program is invalid!'
    }
    program.use(uniformNames, undefined, ['dstTexture'])
  }
}
