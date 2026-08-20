import {WebGLRendererContext} from 'src/components/YMatPlayer/utils/shims'
import AttribBuffer from '../../webgl/AttribBuffer'
import {FrameShape, SHAPE_TYPE, ShapeStyles, SpriteFrame, SpriteInfo, Transform} from './types'
import {SvgaSwapItemInfo} from '../../../types'
import Texture from '../../webgl/Texture'
import {autoUrlHttp, loadImage} from '../../../utils/common'
import {FrameInfo} from '../RenderStore'
import {CanvasContext2D, CanvasType, createCanvas, getContext2D} from '../../../utils/canvas'

function setRectangle(attribBuffer: AttribBuffer, x: number, y: number, w: number, h: number) {
  const x1 = x
  const y1 = y
  const x2 = x + w
  const y2 = y + h

  const gl = attribBuffer.gl as WebGLRendererContext
  attribBuffer.setArribInfo(gl.attribs.position, {
    size: 2,
    data: [x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2],
  })
}

function drawTexture(attribBuffer: AttribBuffer, w: number, h: number) {
  setRectangle(attribBuffer, 0, 0, w, h)

  const gl = attribBuffer.gl as WebGLRendererContext

  const tx1 = 0
  const ty1 = 0
  const tx2 = 1
  const ty2 = 1
  attribBuffer.setArribInfo(gl.attribs.texcoord, {
    data: [tx1, ty1, tx2, ty1, tx1, ty2, tx1, ty2, tx2, ty1, tx2, ty2],
  })

  const primitiveType = gl.TRIANGLES
  const count = 6
  gl.drawArrays(primitiveType, 0, count)
}

const validMethods = 'MLHVCSQAZmlhvcsqaz'

export default class SpriteLayer {
  constructor(info: SpriteInfo, bitmap: ImageBitmap | HTMLImageElement, swapItems?: SvgaSwapItemInfo[]) {
    this.info = info
    this.bitmap = bitmap
    this.swapItems = swapItems
  }

  protected info: SpriteInfo
  protected bitmap: ImageBitmap | HTMLImageElement
  protected swapItems?: SvgaSwapItemInfo[]
  private swapCanvas?: CanvasType

  private texture?: Texture
  private attribBuffer?: AttribBuffer
  // 裁剪
  private maskClipPath?: string
  private maskPath2D?: Path2D
  private maskTransform?: SpriteFrame['transform']
  private maskTexture?: Texture

  async init(gl?: WebGLRendererContext) {
    const bitmap = this.bitmap
    const swapItems = this.swapItems
    if (swapItems?.length) {
      const width = bitmap.width
      const height = bitmap.height

      const canvas = createCanvas(width, height)
      const ctx = getContext2D(canvas)
      if (ctx) {
        let contentLength = 0
        const drawElInfos: {
          width: number
          srcWidth: number
          srcHeight: number
          textInfo?: {
            content: string
            fontStyle: string
            color?: string
          }
          imageInfo?: {
            bitMap: ImageBitmap | HTMLImageElement
          }
        }[] = []

        for (let i = 0, l = swapItems.length; i < l; i++) {
          const item = swapItems[i]
          const itemType = item.type || 0
          const itemWidth = item.width || 0
          if (itemType === 0) {
            // 文本
            const fontSize = item.fontSize || 24
            const fontStyle = `${item.bold ? 'bold' : ''} ${fontSize}px ${item.family || 'Arial'}`
            ctx.font = fontStyle
            const metrics = ctx.measureText(item.content)
            drawElInfos.push({
              width: itemWidth,
              srcWidth: metrics.width,
              srcHeight: metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent,
              textInfo: {
                content: item.content,
                fontStyle,
                color: item.color,
              },
            })
            contentLength += itemWidth || metrics.width
          } else if (itemType === 1) {
            // 图片
            const url = autoUrlHttp(item.content)
            try {
              const image = await loadImage(url)
              if (image) {
                const imgWidth = image.width
                const imgHeight = image.height
                drawElInfos.push({
                  width: itemWidth,
                  srcWidth: imgWidth,
                  srcHeight: imgHeight,
                  imageInfo: {
                    bitMap: image,
                  },
                })
                contentLength += itemWidth || imgWidth
              }
            } catch (err) {
              console.error(`[SVGA]loadImgData, error: `, String(err), url)
            }
          }
        }
        let x = (width - contentLength) * 0.5
        for (let i = 0, l = drawElInfos.length; i < l; i++) {
          const info = drawElInfos[i]
          const textInfo = info.textInfo
          if (textInfo) {
            const dw = info.width || info.srcWidth
            ctx.font = textInfo.fontStyle
            ctx.fillStyle = textInfo.color || '#000000'
            ctx.textAlign = 'left'
            ctx.textBaseline = 'middle'
            ctx.fillText(textInfo.content, x, height * 0.5, info.width ? info.width : undefined)
            x += dw
            continue
          }
          const imageInfo = info.imageInfo
          if (imageInfo) {
            const dw = info.width || info.srcWidth
            let dh = info.srcHeight
            if (info.width && info.srcWidth) {
              dh = (info.srcHeight * info.width) / info.srcWidth
            }
            ctx.drawImage(imageInfo.bitMap, x, (height - dh) * 0.5, dw, dh)
            ;(imageInfo.bitMap as ImageBitmap)?.close?.()
            x += dw
          }
        }
      }
      this.swapCanvas = canvas
      if (gl) {
        try {
          this.texture = new Texture(gl)
          this.texture.texImage2D(canvas as TexImageSource)
        } catch (err) {
          // 当使用Image去加载跨域的资源会导致canvas是被污染的，导致报错
          console.error('RenderSvga', err)
          this.texture?.destroy()
          this.texture = undefined
        }
      }
    } else if (bitmap && gl) {
      this.texture = new Texture(gl)
      this.texture.texImage2D(bitmap)
    }
  }

  drawGL(gl: WebGLRendererContext, frameInfo: FrameInfo) {
    if (!this.texture) return
    const spriteFrame = this.info.frames[frameInfo.frameId]
    const alpha = spriteFrame.alpha

    if (alpha < 0.05) return

    const {a = 1, b = 0, c = 0, d = 1, tx = 0, ty = 0} = spriteFrame.transform || {}
    const matrix = new Float32Array([a, b, 0, c, d, 0, tx, ty, 0])

    const maskTexture = this.getMaskTexture(gl, spriteFrame, frameInfo)

    gl.activeTexture(gl.TEXTURE0)
    this.texture.bind()

    if (maskTexture) {
      gl.activeTexture(gl.TEXTURE1)
      maskTexture.bind()
    }
    gl.uniformMatrix3fv(gl.uniforms.matrix, false, matrix)
    gl.uniform1f(gl.uniforms.opacity, alpha)
    gl.uniform1i(gl.uniforms.maskMode, maskTexture ? 1 : 0)

    const {width, height} = spriteFrame.layout
    drawTexture(this.getAttribBuffer(gl), width, height)

    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  draw2D(ctx: CanvasContext2D, frameId: number) {
    const spriteFrame = this.info.frames[frameId]
    const alpha = spriteFrame.alpha
    if (alpha < 0.05) return

    ctx.save()
    ctx.globalAlpha = spriteFrame.alpha
    ctx.transform(
      spriteFrame.transform?.a || 1,
      spriteFrame.transform?.b || 0,
      spriteFrame.transform?.c || 0,
      spriteFrame.transform?.d || 1,
      spriteFrame.transform?.tx || 0,
      spriteFrame.transform?.ty || 0,
    )
    const bitmap = this.bitmap
    if (bitmap) {
      const maskPath2D = this.getMaskPath2D(spriteFrame)
      if (maskPath2D) {
        ctx.clip(maskPath2D)
      }

      ctx.drawImage(bitmap, 0, 0)
    }
    const swapCanvas = this.swapCanvas
    if (swapCanvas) {
      ctx.drawImage(swapCanvas, 0, 0)
    }

    spriteFrame.shapes.forEach(shape => drawShape(ctx, shape))

    ctx.restore()
  }

  destroy() {
    this.texture?.destroy()
    this.texture = undefined

    this.attribBuffer?.destroy()
    this.attribBuffer = undefined
    ;(this.bitmap as ImageBitmap)?.close?.()
  }

  getAttribBuffer(gl: WebGLRendererContext) {
    if (!this.attribBuffer) {
      this.attribBuffer = new AttribBuffer(gl)
    }
    return this.attribBuffer
  }

  private getMaskTexture(gl: WebGLRendererContext, spriteFrame: SpriteFrame, {width, height}: FrameInfo) {
    const lastMaskPath2D = this.maskPath2D
    const maskPath2D = this.getMaskPath2D(spriteFrame)
    if (!maskPath2D) return undefined
    const lastMaskTransform = this.maskTransform
    const transform = spriteFrame.transform
    this.maskTransform = transform
    if (lastMaskPath2D === maskPath2D && lastMaskTransform === transform) return this.maskTexture

    const maskCanvas = createCanvas(width, height)
    const ctx = getContext2D(maskCanvas)
    if (ctx) {
      const {a = 1, b = 0, c = 0, d = 1, tx = 0, ty = 0} = transform || {}
      ctx.transform(a || 1, b || 0, c || 0, d || 1, tx || 0, ty || 0)
      ctx.fillStyle = 'rgb(255, 0, 0)'
      ctx.fill(maskPath2D)
      ctx.restore()
    }

    const maskTexture = this.maskTexture || (this.maskTexture = new Texture(gl))
    maskTexture.texImage2D(maskCanvas as any)

    return maskTexture
  }

  private getMaskPath2D(spriteFrame: SpriteFrame) {
    const clipPath = spriteFrame.clipPath
    if (clipPath === this.maskClipPath) return this.maskPath2D
    this.maskClipPath = clipPath
    this.maskPath2D = undefined
    if (!clipPath) return undefined

    const path = new Path2D()
    const currentPoint = {x: 0, y: 0, x1: 0, y1: 0, x2: 0, y2: 0}
    const d = clipPath.replace(/([a-zA-Z])/g, '|||$1 ').replace(/,/g, ' ')
    d.split('|||').forEach(segment => {
      if (segment.length == 0) return
      const method = segment.substr(0, 1)
      if (validMethods.indexOf(method) === -1) return
      const args = segment.substr(1).trim().split(' ')
      switch (method) {
        case 'M':
          currentPoint.x = Number(args[0])
          currentPoint.y = Number(args[1])
          path.moveTo(currentPoint.x, currentPoint.y)
          break
        case 'm':
          currentPoint.x += Number(args[0])
          currentPoint.y += Number(args[1])
          path.moveTo(currentPoint.x, currentPoint.y)
          break
        case 'L':
          currentPoint.x = Number(args[0])
          currentPoint.y = Number(args[1])
          path.lineTo(currentPoint.x, currentPoint.y)
          break
        case 'l':
          currentPoint.x += Number(args[0])
          currentPoint.y += Number(args[1])
          path.lineTo(currentPoint.x, currentPoint.y)
          break
        case 'H':
          currentPoint.x = Number(args[0])
          path.lineTo(currentPoint.x, currentPoint.y)
          break
        case 'h':
          currentPoint.x += Number(args[0])
          path.lineTo(currentPoint.x, currentPoint.y)
          break
        case 'V':
          currentPoint.y = Number(args[0])
          path.lineTo(currentPoint.x, currentPoint.y)
          break
        case 'v':
          currentPoint.y += Number(args[0])
          path.lineTo(currentPoint.x, currentPoint.y)
          break
        case 'C':
          currentPoint.x1 = Number(args[0])
          currentPoint.y1 = Number(args[1])
          currentPoint.x2 = Number(args[2])
          currentPoint.y2 = Number(args[3])
          currentPoint.x = Number(args[4])
          currentPoint.y = Number(args[5])
          path.bezierCurveTo(
            currentPoint.x1,
            currentPoint.y1,
            currentPoint.x2,
            currentPoint.y2,
            currentPoint.x,
            currentPoint.y,
          )
          break
        case 'c':
          currentPoint.x1 = currentPoint.x + Number(args[0])
          currentPoint.y1 = currentPoint.y + Number(args[1])
          currentPoint.x2 = currentPoint.x + Number(args[2])
          currentPoint.y2 = currentPoint.y + Number(args[3])
          currentPoint.x += Number(args[4])
          currentPoint.y += Number(args[5])
          path.bezierCurveTo(
            currentPoint.x1,
            currentPoint.y1,
            currentPoint.x2,
            currentPoint.y2,
            currentPoint.x,
            currentPoint.y,
          )
          break
        case 'S':
          if (currentPoint.x1 && currentPoint.y1 && currentPoint.x2 && currentPoint.y2) {
            currentPoint.x1 = currentPoint.x - currentPoint.x2 + currentPoint.x
            currentPoint.y1 = currentPoint.y - currentPoint.y2 + currentPoint.y
            currentPoint.x2 = Number(args[0])
            currentPoint.y2 = Number(args[1])
            currentPoint.x = Number(args[2])
            currentPoint.y = Number(args[3])
            path.bezierCurveTo(
              currentPoint.x1,
              currentPoint.y1,
              currentPoint.x2,
              currentPoint.y2,
              currentPoint.x,
              currentPoint.y,
            )
          } else {
            currentPoint.x1 = Number(args[0])
            currentPoint.y1 = Number(args[1])
            currentPoint.x = Number(args[2])
            currentPoint.y = Number(args[3])
            path.quadraticCurveTo(currentPoint.x1, currentPoint.y1, currentPoint.x, currentPoint.y)
          }
          break
        case 's':
          if (currentPoint.x1 && currentPoint.y1 && currentPoint.x2 && currentPoint.y2) {
            currentPoint.x1 = currentPoint.x - currentPoint.x2 + currentPoint.x
            currentPoint.y1 = currentPoint.y - currentPoint.y2 + currentPoint.y
            currentPoint.x2 = currentPoint.x + Number(args[0])
            currentPoint.y2 = currentPoint.y + Number(args[1])
            currentPoint.x += Number(args[2])
            currentPoint.y += Number(args[3])
            path.bezierCurveTo(
              currentPoint.x1,
              currentPoint.y1,
              currentPoint.x2,
              currentPoint.y2,
              currentPoint.x,
              currentPoint.y,
            )
          } else {
            currentPoint.x1 = currentPoint.x + Number(args[0])
            currentPoint.y1 = currentPoint.y + Number(args[1])
            currentPoint.x += Number(args[2])
            currentPoint.y += Number(args[3])
            path.quadraticCurveTo(currentPoint.x1, currentPoint.y1, currentPoint.x, currentPoint.y)
          }
          break
        case 'Q':
          currentPoint.x1 = Number(args[0])
          currentPoint.y1 = Number(args[1])
          currentPoint.x = Number(args[2])
          currentPoint.y = Number(args[3])
          path.quadraticCurveTo(currentPoint.x1, currentPoint.y1, currentPoint.x, currentPoint.y)
          break
        case 'q':
          currentPoint.x1 = currentPoint.x + Number(args[0])
          currentPoint.y1 = currentPoint.y + Number(args[1])
          currentPoint.x += Number(args[2])
          currentPoint.y += Number(args[3])
          path.quadraticCurveTo(currentPoint.x1, currentPoint.y1, currentPoint.x, currentPoint.y)
          break
        case 'A':
          break
        case 'a':
          break
        case 'Z':
        case 'z':
          path.closePath()
          break
        default:
          break
      }
    })

    this.maskPath2D = path

    return path
  }
}

interface CurrentPoint {
  x: number
  y: number
  x1: number
  y1: number
  x2: number
  y2: number
}

function drawShape(ctx: CanvasContext2D, shape: FrameShape) {
  switch (shape.type) {
    case SHAPE_TYPE.SHAPE:
      drawBezier(ctx, shape.path.d, shape.transform, shape.styles)
      break
    case SHAPE_TYPE.ELLIPSE:
      drawEllipse(
        ctx,
        shape.path.x ?? 0.0,
        shape.path.y ?? 0.0,
        shape.path.radiusX ?? 0.0,
        shape.path.radiusY ?? 0.0,
        shape.transform,
        shape.styles,
      )
      break
    case SHAPE_TYPE.RECT:
      drawRect(
        ctx,
        shape.path.x ?? 0.0,
        shape.path.y ?? 0.0,
        shape.path.width ?? 0.0,
        shape.path.height ?? 0.0,
        shape.path.cornerRadius ?? 0.0,
        shape.transform,
        shape.styles,
      )
      break
  }
}

function resetShapeStyles(context: CanvasRenderingContext2D | CanvasContext2D, styles: ShapeStyles | undefined): void {
  if (styles === undefined) return

  if (styles.stroke !== null) {
    context.strokeStyle = styles.stroke
  } else {
    context.strokeStyle = 'transparent'
  }

  if (styles.strokeWidth !== null && styles.strokeWidth > 0) context.lineWidth = styles.strokeWidth
  if (styles.miterLimit !== null && styles.miterLimit > 0) context.miterLimit = styles.miterLimit
  if (styles.lineCap !== null) context.lineCap = styles.lineCap
  if (styles.lineJoin !== null) context.lineJoin = styles.lineJoin

  if (styles.fill !== null) {
    context.fillStyle = styles.fill
  } else {
    context.fillStyle = 'transparent'
  }

  if (styles.lineDash !== null) context.setLineDash(styles.lineDash)
}

function drawBezier(
  context: CanvasRenderingContext2D | CanvasContext2D,
  d: string | undefined,
  transform: Transform | undefined,
  styles: ShapeStyles,
): void {
  context.save()
  resetShapeStyles(context, styles)
  if (transform !== undefined) {
    context.transform(transform.a, transform.b, transform.c, transform.d, transform.tx, transform.ty)
  }
  const currentPoint: CurrentPoint = {x: 0, y: 0, x1: 0, y1: 0, x2: 0, y2: 0}
  context.beginPath()
  if (d !== undefined) {
    d = d.replace(/([a-zA-Z])/g, '|||$1 ').replace(/,/g, ' ')
    d.split('|||').forEach(segment => {
      if (segment.length === 0) return
      const firstLetter = segment.substr(0, 1)
      if (validMethods.includes(firstLetter)) {
        const args = segment.substr(1).trim().split(' ')
        drawBezierElement(context, currentPoint, firstLetter, args)
      }
    })
  }
  if (styles.fill !== null) {
    context.fill()
  }
  if (styles.stroke !== null) {
    context.stroke()
  }
  context.restore()
}

function drawBezierElement(
  context: CanvasRenderingContext2D | CanvasContext2D,
  currentPoint: CurrentPoint,
  method: string,
  args: string[],
): void {
  switch (method) {
    case 'M':
      currentPoint.x = Number(args[0])
      currentPoint.y = Number(args[1])
      context.moveTo(currentPoint.x, currentPoint.y)
      break
    case 'm':
      currentPoint.x += Number(args[0])
      currentPoint.y += Number(args[1])
      context.moveTo(currentPoint.x, currentPoint.y)
      break
    case 'L':
      currentPoint.x = Number(args[0])
      currentPoint.y = Number(args[1])
      context.lineTo(currentPoint.x, currentPoint.y)
      break
    case 'l':
      currentPoint.x += Number(args[0])
      currentPoint.y += Number(args[1])
      context.lineTo(currentPoint.x, currentPoint.y)
      break
    case 'H':
      currentPoint.x = Number(args[0])
      context.lineTo(currentPoint.x, currentPoint.y)
      break
    case 'h':
      currentPoint.x += Number(args[0])
      context.lineTo(currentPoint.x, currentPoint.y)
      break
    case 'V':
      currentPoint.y = Number(args[0])
      context.lineTo(currentPoint.x, currentPoint.y)
      break
    case 'v':
      currentPoint.y += Number(args[0])
      context.lineTo(currentPoint.x, currentPoint.y)
      break
    case 'C':
      currentPoint.x1 = Number(args[0])
      currentPoint.y1 = Number(args[1])
      currentPoint.x2 = Number(args[2])
      currentPoint.y2 = Number(args[3])
      currentPoint.x = Number(args[4])
      currentPoint.y = Number(args[5])
      context.bezierCurveTo(
        currentPoint.x1,
        currentPoint.y1,
        currentPoint.x2,
        currentPoint.y2,
        currentPoint.x,
        currentPoint.y,
      )
      break
    case 'c':
      currentPoint.x1 = currentPoint.x + Number(args[0])
      currentPoint.y1 = currentPoint.y + Number(args[1])
      currentPoint.x2 = currentPoint.x + Number(args[2])
      currentPoint.y2 = currentPoint.y + Number(args[3])
      currentPoint.x += Number(args[4])
      currentPoint.y += Number(args[5])
      context.bezierCurveTo(
        currentPoint.x1,
        currentPoint.y1,
        currentPoint.x2,
        currentPoint.y2,
        currentPoint.x,
        currentPoint.y,
      )
      break
    case 'S':
      if (
        currentPoint.x1 !== undefined &&
        currentPoint.y1 !== undefined &&
        currentPoint.x2 !== undefined &&
        currentPoint.y2 !== undefined
      ) {
        currentPoint.x1 = currentPoint.x - currentPoint.x2 + currentPoint.x
        currentPoint.y1 = currentPoint.y - currentPoint.y2 + currentPoint.y
        currentPoint.x2 = Number(args[0])
        currentPoint.y2 = Number(args[1])
        currentPoint.x = Number(args[2])
        currentPoint.y = Number(args[3])
        context.bezierCurveTo(
          currentPoint.x1,
          currentPoint.y1,
          currentPoint.x2,
          currentPoint.y2,
          currentPoint.x,
          currentPoint.y,
        )
      } else {
        currentPoint.x1 = Number(args[0])
        currentPoint.y1 = Number(args[1])
        currentPoint.x = Number(args[2])
        currentPoint.y = Number(args[3])
        context.quadraticCurveTo(currentPoint.x1, currentPoint.y1, currentPoint.x, currentPoint.y)
      }
      break
    case 's':
      if (
        currentPoint.x1 !== undefined &&
        currentPoint.y1 !== undefined &&
        currentPoint.x2 !== undefined &&
        currentPoint.y2 !== undefined
      ) {
        currentPoint.x1 = currentPoint.x - currentPoint.x2 + currentPoint.x
        currentPoint.y1 = currentPoint.y - currentPoint.y2 + currentPoint.y
        currentPoint.x2 = currentPoint.x + Number(args[0])
        currentPoint.y2 = currentPoint.y + Number(args[1])
        currentPoint.x += Number(args[2])
        currentPoint.y += Number(args[3])
        context.bezierCurveTo(
          currentPoint.x1,
          currentPoint.y1,
          currentPoint.x2,
          currentPoint.y2,
          currentPoint.x,
          currentPoint.y,
        )
      } else {
        currentPoint.x1 = currentPoint.x + Number(args[0])
        currentPoint.y1 = currentPoint.y + Number(args[1])
        currentPoint.x += Number(args[2])
        currentPoint.y += Number(args[3])
        context.quadraticCurveTo(currentPoint.x1, currentPoint.y1, currentPoint.x, currentPoint.y)
      }
      break
    case 'Q':
      currentPoint.x1 = Number(args[0])
      currentPoint.y1 = Number(args[1])
      currentPoint.x = Number(args[2])
      currentPoint.y = Number(args[3])
      context.quadraticCurveTo(currentPoint.x1, currentPoint.y1, currentPoint.x, currentPoint.y)
      break
    case 'q':
      currentPoint.x1 = currentPoint.x + Number(args[0])
      currentPoint.y1 = currentPoint.y + Number(args[1])
      currentPoint.x += Number(args[2])
      currentPoint.y += Number(args[3])
      context.quadraticCurveTo(currentPoint.x1, currentPoint.y1, currentPoint.x, currentPoint.y)
      break
    case 'A':
      break
    case 'a':
      break
    case 'Z':
    case 'z':
      context.closePath()
      break
    default:
      break
  }
}

function drawEllipse(
  context: CanvasRenderingContext2D | CanvasContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  transform: Transform | undefined,
  styles: ShapeStyles,
): void {
  context.save()
  resetShapeStyles(context, styles)
  if (transform !== undefined) {
    context.transform(transform.a, transform.b, transform.c, transform.d, transform.tx, transform.ty)
  }
  x = x - radiusX
  y = y - radiusY
  const w = radiusX * 2
  const h = radiusY * 2
  const kappa = 0.5522848
  const ox = (w / 2) * kappa
  const oy = (h / 2) * kappa
  const xe = x + w
  const ye = y + h
  const xm = x + w / 2
  const ym = y + h / 2
  context.beginPath()
  context.moveTo(x, ym)
  context.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y)
  context.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym)
  context.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye)
  context.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym)
  if (styles.fill !== null) {
    context.fill()
  }
  if (styles.stroke !== null) {
    context.stroke()
  }
  context.restore()
}

function drawRect(
  context: CanvasRenderingContext2D | CanvasContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  cornerRadius: number,
  transform: Transform | undefined,
  styles: ShapeStyles,
): void {
  context.save()
  resetShapeStyles(context, styles)
  if (transform !== undefined) {
    context.transform(transform.a, transform.b, transform.c, transform.d, transform.tx, transform.ty)
  }
  let radius = cornerRadius
  if (width < 2 * radius) {
    radius = width / 2
  }
  if (height < 2 * radius) {
    radius = height / 2
  }
  context.beginPath()
  context.moveTo(x + radius, y)
  context.arcTo(x + width, y, x + width, y + height, radius)
  context.arcTo(x + width, y + height, x, y + height, radius)
  context.arcTo(x, y + height, x, y, radius)
  context.arcTo(x, y, x + width, y, radius)
  context.closePath()
  if (styles.fill !== null) {
    context.fill()
  }
  if (styles.stroke !== null) {
    context.stroke()
  }
  context.restore()
}
