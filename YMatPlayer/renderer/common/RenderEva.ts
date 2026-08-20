import VideoReader from '../../core/video/VideoReader'
import {MP4Demuxer} from '../../core/video/demuxer'
import {getFillCoord} from '../../math/mathUtils'
import {PlayInfo, PlayProps, YMatKeyProps} from '../../types'
import {CanvasContext2D, CanvasType, createCanvas, getContext2D} from '../../utils/canvas'
import {loadImage} from '../../utils/common'
import {WebGLRendererContext} from '../../utils/shims'
import {getAlphaFragment, getAlphaVertex} from '../shaders/alpha.glsl'
import {getEvaFragment, getEvaVertex} from '../shaders/eva.glsl'
import AttribBuffer from '../webgl/AttribBuffer'
import Framebuffer from '../webgl/Framebuffer'
import Program from '../webgl/Program'
import Texture from '../webgl/Texture'
import RenderImpl from './RenderImpl'
import RenderStore from './RenderStore'
import {inflate as zlib_inflat} from 'zlib.es'

/**
 * Eva相关类型定义
 */
enum EvaScaleType {
  aspectFill = 'aspectFill',
  aspectFit = 'aspectFit',
  scaleFill = 'scaleFill',
}

interface EvaEffectType {
  effectWidth: number //动态元素宽
  effectHeight: number //动态元素高
  effectId: number | string //动态元素索引id
  effectTag: string //动态元素的tag
  effectType: 'txt' | 'img' ////动态元素类型
  scaleMode: EvaScaleType
}

interface EvaFrameItemType {
  renderFrame: number[] //在画布上的位置
  effectId: number | string //标志是哪个动态元素
  outputFrame: number[] //在视频区域的位置
  [key: string]: any
}

interface EvaFrameDataType {
  frameIndex: number
  data: EvaFrameItemType[]
  [key: string]: any
}

interface EvaDescriptType {
  width: number //输出视频的宽
  height: number //输出视频的高
  isEffect: number //是否为动态元素视频
  version: number //插件的版本号
  rgbFrame: number[] //rgb位置信息
  alphaFrame: number[] //alpha位置信息
  fps: number
  hasAudio?: boolean
}

interface EvaMetaInfo {
  /**
   * 每一帧的动态元素位置信息
   */
  datas: EvaFrameDataType[]
  /**
   * 视频的描述信息
   */
  descript: EvaDescriptType
  /**
   * 动态元素的遮罩描述信息
   */
  effect: EvaEffectType[]
}

type EffectItemType = EvaEffectType & {
  texture?: Texture
  text?: string
  fontColor?: string
  fontSize?: number
  [key: string]: any
}

export default class RenderEva implements RenderImpl {
  constructor(store: RenderStore, canvas: CanvasType, gl?: WebGLRendererContext) {
    this.store = store
    this.canvas = canvas
    this.gl = gl
  }

  readonly store: RenderStore
  readonly canvas: CanvasType

  private gl?: WebGLRendererContext
  private ctx2D: CanvasContext2D | null = null
  private drawCtx2D: CanvasContext2D | null = null

  private videoReader?: VideoReader
  private metaInfo?: EvaMetaInfo

  private handleDraw?: (videoFrame: any) => void
  private program?: Program
  private texture?: Texture
  private attribBuffer?: AttribBuffer
  private framebuffer?: Framebuffer
  // 顶点和纹理坐标
  private attrPosition: number[] = []
  private attrTexCoord: number[] = []

  private evaEffectList?: EffectItemType[]
  private evaTexcoord: number[] = []
  private evaAlphaTexcoord: number[] = []

  // 播放音频
  private audioPlayerId = ''

  isReady() {
    return !!this.handleDraw
  }

  async load(props: {
    file: string | Blob
    effects?: {
      [k: string]: any
      fontColor?: string
      fontSize?: number
      fontStyle?: string
    }
  }) {
    const store = this.store
    store.clear()

    const url = props.file
    const demuxer = new MP4Demuxer(url)
    const config = await demuxer.ensure()

    try {
      const gl = this.gl
      const {frames, duration, metaData} = config
      let playProps: PlayProps | undefined = undefined
      let metaInfo: EvaMetaInfo | undefined = undefined
      this.metaInfo = undefined
      if (metaData) {
        metaInfo = this.metaInfo = parseMeta(metaData)
      }
      if (metaInfo) {
        this.metaInfo = metaInfo
        const descript = metaInfo.descript
        const fps = descript.fps
        const width = descript.rgbFrame[2]
        const height = descript.rgbFrame[3]
        playProps = {
          width,
          height,
          frameRate: fps,
          duration: frames / fps,
        }
        if (!gl) {
          throw 'playEva, error: no valid webgl!'
        }

        this.handleDraw = this.drawEva.bind(this, gl)
      }

      if (!playProps) {
        const width = config.codedWidth * 0.5
        const height = config.codedHeight
        playProps = {
          width,
          height,
          frameRate: frames / (duration * 0.000001),
          duration: duration * 0.000001,
        }
        if (gl) {
          this.handleDraw = this.drawAlpha.bind(this, gl)
        } else {
          this.ctx2D = getContext2D(this.canvas)
          this.handleDraw = this.drawAlpha2D.bind(this, this.ctx2D as CanvasContext2D)
        }
      }
      store.setPlayProps(playProps)
      this.videoReader = new VideoReader({
        uri: url,
        frameRate: store.frameRate,
        frameTime: store.frameTime,
        frames: store.frames,
        disableDecoder: store.disableDecoder,
        demuxer,
      })

      if (gl) {
        // 初始化WebGL资源
        this.useProgram(gl)

        if (!this.texture) {
          this.texture = new Texture(gl)
        }
        if (metaInfo) {
          const descript = metaInfo.descript
          const {width: vW, height: vH} = descript
          const [rgbX, rgbY, rgbW, rgbH] = descript.rgbFrame
          const [aX, aY, aW, aH] = descript.alphaFrame

          const rgbCoord = computeCoord(rgbX, rgbY, rgbW, rgbH, vW, vH)
          const rgbaCoord = computeCoord(aX, aY, aW, aH, vW, vH)
          let tx1 = rgbCoord.lx
          let ty1 = rgbCoord.ly
          let tx2 = rgbCoord.rx
          let ty2 = rgbCoord.ry
          this.evaTexcoord = [tx1, ty1, tx2, ty1, tx1, ty2, tx1, ty2, tx2, ty1, tx2, ty2]
          tx1 = rgbaCoord.lx
          ty1 = rgbaCoord.ly
          tx2 = rgbaCoord.rx
          ty2 = rgbaCoord.ry
          this.evaAlphaTexcoord = [tx1, ty1, tx2, ty1, tx1, ty2, tx1, ty2, tx2, ty1, tx2, ty2]

          await this.initEffects(gl, metaInfo, props.effects)
        }
      }

      const canvas = this.canvas
      const canvasWidth = canvas.width
      const canvasHeight = canvas.height
      this.onResize(canvasWidth, canvasHeight)

      // 处理音频
      if (store.disableAudio) {
        demuxer.onDone(() => {
          const audioInfo = demuxer.getAudioInfo()
          if (!audioInfo) return

          this.audioPlayerId = url.toString()
          store.ctx.playAudio({id: this.audioPlayerId, buffer: audioInfo.buffer})
        })
      }

      await this.videoReader.init()

      return {
        keys: undefined,
        info: {
          width: store.width,
          height: store.height,
          frames: Math.round(store.duration * store.frameRate),
          duration: store.duration,
          frameRate: store.frameRate,
        } as PlayInfo,
      }
    } catch (error) {
      console.error(error)
    }

    return undefined
  }

  async setKeys(keys: YMatKeyProps | YMatKeyProps[]) {}

  onResize(canvasWidth: number, canvasHeight: number) {
    const store = this.store
    const width = store.width
    const height = store.height
    if (!width || !height) return

    // 适配尺寸
    const {lx, ly, rx, ry, sw, sh} = getFillCoord(
      width,
      height,
      canvasWidth,
      canvasHeight,
      store.fillMode,
      this.metaInfo ? false : true,
    )
    const x1 = -sw
    const y1 = sh
    const x2 = sw
    const y2 = -sh
    this.attrPosition = [x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2]
    const tx1 = lx
    const ty1 = ly
    const tx2 = rx
    const ty2 = ry
    this.attrTexCoord = [tx1, ty1, tx2, ty1, tx1, ty2, tx1, ty2, tx2, ty1, tx2, ty2]
  }

  render() {
    const videoReader = this.videoReader
    if (!videoReader) return

    const store = this.store
    const targetFrame = store.frameId
    const isNativeTimeline = videoReader.isNativeTimeline()
    const videoFrame = videoReader.prepare(targetFrame)
    if (isNativeTimeline) {
      const currentFrame = getFrameIdByTimestamp(
        videoReader.getCurrentTimestamp(),
        store.frameTimestamp,
        targetFrame,
        store.frames,
      )
      store.frameId = currentFrame
    }
    this.handleDraw?.(videoFrame)

    if (isNativeTimeline) {
      // 命中videoElement：跟随视频自身时间线自然播放，frameId依赖currentTime
      if (videoFrame) videoReader.play()
    } else {
      videoReader.prepareNext(targetFrame + 1)
    }
  }

  destroy() {
    this.handleDraw = undefined

    this.videoReader?.destroy()
    this.videoReader = undefined

    this.program?.destroy()
    this.program = undefined
    this.texture?.destroy()
    this.texture = undefined
    this.attribBuffer?.destroy()
    this.attribBuffer = undefined
    this.framebuffer?.destory()
    this.framebuffer = undefined

    this.evaEffectList?.forEach(el => {
      el.texture?.destroy()
    })
    this.evaEffectList = undefined

    this.ctx2D = null
    this.drawCtx2D = null

    if (this.audioPlayerId) {
      this.store.ctx.stopAudio(this.audioPlayerId)
      this.audioPlayerId = ''
    }
  }

  checkReset() {}

  private useProgram(gl: WebGLRendererContext) {
    const metaInfo = this.metaInfo

    if (this.program) this.program.destroy()
    const program = (this.program = new Program(gl, {
      vertexShader: metaInfo ? getEvaVertex({webgl2: gl.isWebGL2}) : getAlphaVertex({webgl2: gl.isWebGL2}),
      fragmentShader: metaInfo
        ? getEvaFragment({webgl2: gl.isWebGL2, effectSize: metaInfo.effect.length})
        : getAlphaFragment({webgl2: gl.isWebGL2}),
    }))
    if (program.invalid()) {
      throw 'RenderEva Program is invalid!'
    }
    if (metaInfo) {
      program.use(
        ['image_pos', 'isTexScreen'],
        ['alpha_texCoord'],
        Array(metaInfo.effect.length)
          .fill(0)
          .map((_, index) => `image${index + 1}`),
      )
    } else {
      program.use()
    }
  }

  private drawAlpha(gl: WebGLRendererContext, videoFrame: any) {
    const attribBuffer = this.attribBuffer || (this.attribBuffer = new AttribBuffer(gl))

    const canvasWidth = gl.canvas.width
    const canvasHeight = gl.canvas.height
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (videoFrame) {
      this.texture?.texImage2D(videoFrame)
    }
    gl.activeTexture(gl.TEXTURE0)
    this.texture?.bind()

    attribBuffer.setArribInfo(gl.attribs.position, {
      data: this.attrPosition,
    })

    attribBuffer.setArribInfo(gl.attribs.texcoord, {
      data: this.attrTexCoord,
    })

    const primitiveType = gl.TRIANGLES
    gl.drawArrays(primitiveType, 0, 6)

    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  private drawAlpha2D(ctx2D: CanvasContext2D, videoFrame: any) {
    const store = this.store
    const canvas = this.canvas

    const canvasWidth = canvas.width
    const canvasHeight = canvas.height
    const width = store.width
    const height = store.height

    if (videoFrame) {
      const drawCtx2D =
        this.drawCtx2D ||
        (getContext2D(createCanvas(width * 2, height), {
          willReadFrequently: true,
        }) as CanvasContext2D)
      drawCtx2D.clearRect(0, 0, width * 2, height)
      drawCtx2D.drawImage(videoFrame, 0, 0, width * 2, height, 0, 0, width * 2, height)
      let colorImageData = drawCtx2D.getImageData(0, 0, width, height)
      const alphaImageData = drawCtx2D.getImageData(width, 0, width, height)
      colorImageData = this.transformImageData2D(colorImageData, alphaImageData)
      drawCtx2D.putImageData(colorImageData, 0, 0, 0, 0, width, height)

      ctx2D.clearRect(0, 0, canvasWidth, canvasHeight)
      const sx = this.attrTexCoord[0]
      const sy = this.attrTexCoord[1]
      const sw = (this.attrTexCoord[10] - sx) * width * 2
      const sh = (this.attrTexCoord[11] - sy) * height
      const dx = (this.attrPosition[0] + 1.0) * canvasWidth
      const dy = (1.0 - this.attrPosition[1]) * 0.5 * canvasHeight
      const dw = this.attrPosition[10] * canvasWidth
      const dh = this.attrPosition[1] * canvasHeight

      ctx2D.drawImage(drawCtx2D.canvas, sx, sy, sw, sh, dx, dy, dw, dh)
    }
  }

  private transformImageData2D(colorImageData: ImageData, alphaImageData: ImageData) {
    const len = Math.min(colorImageData.data.length, alphaImageData.data.length)

    for (let i = 3; i < len; i += 4) {
      const opacity = alphaImageData.data[i - 1] || 0
      colorImageData.data[i] = opacity
    }
    return colorImageData
  }

  private drawEva(gl: WebGLRendererContext, videoFrame: any) {
    const store = this.store
    const metaInfo = this.metaInfo as EvaMetaInfo

    const framebuffer = this.framebuffer || (this.framebuffer = new Framebuffer(gl))
    const width = store.width
    const height = store.height
    if (width <= 0 || height <= 0) return

    const frameId = store.frameId

    framebuffer.bind()
    framebuffer.viewport(width, height)

    if (videoFrame) {
      this.texture?.texImage2D(videoFrame)
    }
    gl.activeTexture(gl.TEXTURE0)
    this.texture?.bind()

    // 组织Effect节点
    const descript = metaInfo.descript
    if (descript) {
      const effectList = this.evaEffectList || []
      const frameItemList = metaInfo.datas?.[frameId]?.data
      // const frameItemList = metaInfo.datas?.find(el => el.frameIndex === frameId)?.data
      let posList: number[] = []
      if (frameItemList) {
        const {width: vW, height: vH} = descript
        const l = effectList.length
        for (let i = 0; i < l; i++) {
          const effectItem = effectList[i]
          // 未传入effects时没有纹理，跳过该区域避免采样空纹理产生黑块
          if (!effectItem.texture) {
            posList = posList.concat(Array(8).fill(0))
            continue
          }
          // 绑定纹理
          gl.activeTexture(gl.TEXTURE0 + i + 1)
          effectItem.texture.bind()
          // image_pos
          const frameItem = frameItemList.find(el => el.effectId === effectItem.effectId)
          if (!frameItem) {
            posList = posList.concat(Array(8).fill(0))
            continue
          }
          const [rgbX, rgbY] = descript.rgbFrame
          const [x, y, w, h] = frameItem.renderFrame
          const [mX, mY, mW, mH] = frameItem.outputFrame
          const {lx, ly, rx, ry} = computeCoord(x + rgbX, y + rgbY, w, h, vW, vH)
          const {lx: mlx, ly: mly, rx: mrx, ry: mry} = computeCoord(mX, mY, mW, mH, vW, vH)

          posList = posList.concat([lx, ly, rx, ry, mlx, mly, mrx, mry])
        }
      }
      gl.uniform1fv(gl.uniforms.image_pos, new Float32Array(posList))
    }

    const attribBuffer = this.attribBuffer || (this.attribBuffer = new AttribBuffer(gl))

    attribBuffer.setArribInfo(gl.attribs.position, {
      data: VERTEXTPOINT,
    })
    // 纹理坐标
    attribBuffer.setArribInfo(gl.attribs.texcoord, {
      data: this.evaTexcoord,
    })
    // Alpha坐标
    attribBuffer.setArribInfo(gl.attribs.alpha_texCoord, {
      data: this.evaAlphaTexcoord,
    })

    gl.drawArrays(gl.TRIANGLES, 0, 6)

    // 上屏
    const canvasWidth = gl.canvas.width
    const canvasHeight = gl.canvas.height
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.activeTexture(gl.TEXTURE0)
    framebuffer.texture?.bind()

    gl.uniform1i(gl.uniforms.isTexScreen, 1)

    attribBuffer.setArribInfo(gl.attribs.position, {
      data: this.attrPosition,
    })
    attribBuffer.setArribInfo(gl.attribs.texcoord, {
      data: this.attrTexCoord,
    })

    gl.drawArrays(gl.TRIANGLES, 0, 6)

    gl.uniform1i(gl.uniforms.isTexScreen, 0)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  private async initEffects(
    gl: WebGLRendererContext,
    metaInfo: EvaMetaInfo,
    effects?: {
      [k: string]: any
      fontColor?: string
      fontSize?: number
      fontStyle?: string
    },
  ) {
    this.evaEffectList = metaInfo.effect
    if (!effects) return
    return Promise.all(
      this.evaEffectList.map(async effectItem => {
        const type = effectItem.effectType
        const tag = effectItem.effectTag
        // Text
        if (type === 'txt') {
          if (effects[tag]) {
            const styleOpts = {
              fontStyle: effects.fontStyle,
              fontColor: effects.fontColor,
              fontSize: effects.fontSize,
            }
            if (typeof effects[tag] === 'string') {
              effectItem.text = effects[tag]
            } else {
              effectItem.text = effects[tag].text

              const style = effects[tag]
              if (style.fontStyle) styleOpts.fontStyle = style.fontStyle
              if (style.fontColor) styleOpts.fontColor = style.fontColor
              if (style.fontSize) styleOpts.fontSize = style.fontSize
            }
            await makeTextTexture(gl, effectItem, styleOpts)
          }
        } else if (type === 'img') {
          await makeImageTexture(gl, effectItem, effects[tag])
        }
      }),
    )
  }
}

function getTextByMaxWidth(text: string, ctx: CanvasContext2D, maxWidth: number) {
  let str = text
  let width = ctx.measureText(str).width
  if (width > maxWidth) {
    let len = text.length
    while (true) {
      str = text.substring(0, len - 1) + '...'
      width = ctx.measureText(str).width
      if (width <= maxWidth) {
        break
      }
      len = len - 1
    }
  }

  return str
}

async function makeImageTexture(gl: WebGLRendererContext, effectItem: EffectItemType, url: string | Blob) {
  const image = await loadImage(url).catch(err => {})
  if (!image) return
  const w = Math.ceil(effectItem.effectWidth)
  const h = Math.ceil(effectItem.effectHeight)
  const canvas = createCanvas(w, h)
  const ctx = getContext2D(canvas)
  if (!ctx) return
  switch (effectItem.scaleMode) {
    case EvaScaleType.aspectFill: {
      const imageWidth = image.width
      const imageHeight = image.height
      const isLead = w / h < imageWidth / imageHeight
      const drawWidth = isLead ? w : h * (imageWidth / imageHeight)
      const drawHeight = !isLead ? h : w / (imageWidth / imageHeight)
      const drawX = (w - drawWidth) / 2
      const drawY = (h - drawHeight) / 2
      ctx?.drawImage(image, drawX, drawY, drawWidth, drawHeight)
      break
    }
    case EvaScaleType.aspectFit: {
      const imageWidth = image.width
      const imageHeight = image.height
      const isLead = w / h < imageWidth / imageHeight
      const drawWidth = !isLead ? w : h * (imageWidth / imageHeight)
      const drawHeight = isLead ? h : w / (imageWidth / imageHeight)
      const drawX = -(drawWidth - w) / 2
      const drawY = -(drawHeight - h) / 2
      ctx?.drawImage(image, drawX, drawY, drawWidth, drawHeight)
      break
    }
    case EvaScaleType.scaleFill: // 变形适配
    default:
      ctx.drawImage(image, 0, 0, w, h)
      break
  }

  effectItem.texture = new Texture(gl)
  effectItem.texture.texImage2D(canvas as any)
  ;(image as ImageBitmap)?.close?.()
}

async function makeTextTexture(
  gl: WebGLRendererContext,
  effectItem: EffectItemType,
  styleOpts: Record<string, any> = {},
) {
  if (styleOpts.fontStyle) effectItem.fontStyle = styleOpts.fontStyle
  if (styleOpts.fontColor) effectItem.fontColor = styleOpts.fontColor
  if (styleOpts.fontSize) effectItem.fontSize = styleOpts.fontSize
  const {fontStyle: fontStyleProp, fontColor, fontSize: fontSizeProp} = effectItem

  const w = Math.ceil(effectItem.effectWidth)
  const h = Math.ceil(effectItem.effectHeight)

  const canvas = createCanvas(w, h)
  const ctx = getContext2D(canvas)
  if (ctx) {
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    const txt = effectItem.text || ''
    const defaultFontSize = h - 2

    const fontSize = fontSizeProp || defaultFontSize

    if (!fontStyleProp) {
      const fontStyle = `${fontStyleProp === 'b' ? 'bold ' : ''}600 ${Math.round(fontSize)}px Microsoft YaHei`
      ctx.font = fontStyle
      if (fontColor) ctx.fillStyle = fontColor
    } else if (typeof fontStyleProp == 'string') {
      ctx.font = fontStyleProp
      if (fontColor) ctx.fillStyle = fontColor
    } else if (typeof fontStyleProp == 'object') {
      ctx.font = fontStyleProp['font'] || `600 ${Math.round(fontSize)}px Microsoft YaHei`
      ctx.fillStyle = fontStyleProp['color'] || fontColor
    } else if (typeof fontStyleProp == 'function') {
      ctx.font = `600 ${Math.round(fontSize)}px Microsoft YaHei`
      if (fontColor) ctx.fillStyle = fontColor
      fontStyleProp(null, ctx, effectItem)
    }

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    const posx = Math.floor(w * 0.5)
    const posy = Math.floor(h * 0.5)
    ctx.fillText(getTextByMaxWidth(txt, ctx, w), posx, posy)

    effectItem.texture = new Texture(gl)
    effectItem.texture.texImage2D(canvas as any)
  }
}

function computeCoord(x: number, y: number, w: number, h: number, vw: number, vh: number) {
  return {
    lx: x / vw,
    ly: y / vh,
    rx: (x + w) / vw,
    ry: (y + h) / vh,
  }
}

function getFrameIdByTimestamp(
  timestamp: number | undefined,
  frameTimestamp: number,
  fallbackFrameId: number,
  frames: number,
) {
  if (timestamp === undefined || frameTimestamp <= 0 || frames <= 0) return fallbackFrameId

  const frameId = Math.floor(timestamp / frameTimestamp)
  return Math.max(0, Math.min(frames - 1, frameId))
}

const VERTEXTPOINT = [-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]

const yyExp = /yyeffectmp4json\[\[(.*?)\]\]yyeffectmp4json/

function base64ToArrayBuffer(base64: string) {
  const binary_string = atob(base64)
  const len = binary_string.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i)
  }
  return bytes.buffer
}

function unit8Tostring(u8data: Uint8Array) {
  return new TextDecoder().decode(u8data)
}

function inflate(str: string): Uint8Array {
  const u8data = zlib_inflat(new Uint8Array(base64ToArrayBuffer(str)))
  return u8data
}

function parseMeta(meta_data: Uint8Array): EvaMetaInfo | undefined {
  const raw = unit8Tostring(meta_data)

  try {
    const mc = raw.match(yyExp)
    if (!mc) return undefined
    const zlibBase64String = mc[1]
    const u8 = inflate(zlibBase64String)
    const info = JSON.parse(unit8Tostring(u8))

    if (!info?.effect?.length) return undefined

    return info
  } catch (error) {
    return undefined
  }
}
