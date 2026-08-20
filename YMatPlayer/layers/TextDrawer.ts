import {rgba} from '../math/mathUtils'
import Texture from '../renderer/webgl/Texture'
import {WebGLRendererContext} from '../utils/shims'
import {LayerTextProps, YMatKeyProps} from '../types'
import Drawer from './BaseDrawer'
import {FrameInfo} from '../renderer/common/RenderStore'
import {drawTexture} from '../renderer/common/primitives'
import {Matrix4} from '../math/Matrix4'
import {CanvasContext2D, createCanvas, getContext2D, resizeCanvas} from '../utils/canvas'
import {WEB_SAFE_FONT} from '../constant'

function metricsfontHeight(metrics: TextMetrics, fontSize: number) {
  return metrics.fontBoundingBoxAscent ? metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent : fontSize
}

function cvtTextValue(valueProp: YMatKeyProps['value'], textDocAttr: LayerTextProps['textDocAttr']) {
  let textList: {
    value: string
    color: string
    fontSize: number
    fontStyle: string
  }[] = []
  if (typeof valueProp === 'string') {
    textList.push({
      value: valueProp,
      color: rgba(textDocAttr.textColor),
      fontSize: textDocAttr.fontSize || 24,
      fontStyle: `${textDocAttr.fauxBold ? 'bold ' : ''}${textDocAttr.fauxItalic ? 'italic ' : ''}${
        textDocAttr.fontSize
      }px ${WEB_SAFE_FONT}`,
    })
  } else if (Array.isArray(valueProp)) {
    textList = valueProp.map(item => ({
      value: item.value,
      color: item.color || rgba(textDocAttr.textColor),
      fontSize: item.fontSize || textDocAttr.fontSize || 24,
      fontStyle: `${item.bold || textDocAttr.fauxBold ? 'bold ' : ''}${textDocAttr.fauxItalic ? 'italic ' : ''}${
        item.fontSize || textDocAttr.fontSize
      }px ${item.fontFamily || WEB_SAFE_FONT}`,
    }))
  } else {
    textList.push({
      value: valueProp.value,
      color: valueProp.color || rgba(textDocAttr.textColor),
      fontSize: valueProp.fontSize || textDocAttr.fontSize || 24,
      fontStyle: `${valueProp.bold || textDocAttr.fauxBold ? 'bold ' : ''}${textDocAttr.fauxItalic ? 'italic ' : ''}${
        valueProp.fontSize || textDocAttr.fontSize
      }px ${valueProp.fontFamily || WEB_SAFE_FONT}`,
    })
  }

  return textList
}

const alignMap: CanvasTextAlign[] = ['left', 'center', 'right', 'left', 'left', 'left', 'left', 'left']
// 横向文字
function drawHorizText(
  ctx: CanvasContext2D,
  textValue: YMatKeyProps['value'],
  textDocAttr: LayerTextProps['textDocAttr'],
) {
  let wholeFontHeight = 0
  let wholeWidth = 0
  let wholeHeight = 0

  const textList = cvtTextValue(textValue, textDocAttr)
  const metricsArrList = textList.map(({fontSize, value, color, fontStyle}) => {
    const textArr = value.replace(/\r/g, '\n').split('\n')
    let width = 0
    let height = 0

    ctx.font = fontStyle
    const textMetrics = ctx.measureText('国')
    const fontWidth = textMetrics.width
    let fontHeight = metricsfontHeight(textMetrics, fontSize)

    textArr.forEach((t: string) => {
      const metrics = ctx.measureText(t)
      width = Math.max(metrics.width, width)
      fontHeight = metricsfontHeight(metrics, fontSize)
      height += fontHeight
      wholeFontHeight = Math.max(wholeFontHeight, fontHeight)
    })
    const exHeight = textDocAttr.lineSpacing !== undefined ? textDocAttr.lineSpacing - fontHeight : 10
    if (textArr.length > 1) {
      height += exHeight * (textArr.length - 1)
    }
    // 顶部预留位置
    height += fontHeight * 0.1
    width += textDocAttr.fauxItalic ? fontWidth * 0.2 : 0
    wholeWidth += width
    wholeHeight = Math.max(wholeHeight, height)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // 设置字体
    ctx.fillStyle = color
    ctx.font = fontStyle

    return {
      textArr,
      width,
      height,
      color,
      fontStyle,
      fontHeight,
      exHeight,
    }
  })

  resizeCanvas(ctx.canvas, wholeWidth, wholeHeight)

  let offX = 0
  metricsArrList.forEach(({textArr, width, height, color, fontStyle, fontHeight, exHeight}) => {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // 设置字体
    ctx.fillStyle = color
    ctx.font = fontStyle

    textArr.forEach((t, idx) => {
      // 居中就不用改
      let left = 0
      if (textDocAttr.textAligment === 0) {
        // 居左
        const metrics = ctx.measureText(t)
        left = (width - metrics.width) / -2
      } else if (textDocAttr.textAligment === 2) {
        // 居右
        const metrics = ctx.measureText(t)
        left = (width - metrics.width) / 2
      }
      ctx.fillText(t, offX + width * 0.5 + left, fontHeight * 0.5 + (exHeight + fontHeight) * idx + fontHeight * 0.1)
    })
    offX += width
  })

  return {fontHeight: wholeFontHeight, width: wholeWidth, height: wholeHeight}
}
// 竖向文字
function drawVertiText(
  ctx: CanvasContext2D,
  textValue: YMatKeyProps['value'],
  textDocAttr: LayerTextProps['textDocAttr'],
) {
  let wholeWidth = 0
  let wholeHeight = 0
  let wholeFontWidth = 0

  const textList = cvtTextValue(textValue, textDocAttr)
  const metricsArrList = textList.map(({fontSize, value, color, fontStyle}) => {
    const textArr = value.replace(/\r/g, '\n').split('\n')
    let width = 0
    let height = 0

    ctx.font = fontStyle
    const metrics = ctx.measureText('国')
    const fontWidth = metrics.width
    const fontHeight = metricsfontHeight(metrics, fontSize)

    textArr.forEach((text: string) => {
      const maxHeight = text.length * fontHeight
      if (height < maxHeight) {
        height = maxHeight
      }
    })
    width += textArr.length * (textDocAttr.fauxItalic ? fontWidth * 1.1 : fontWidth)
    const exWidth = textDocAttr.lineSpacing !== undefined ? textDocAttr.lineSpacing - fontSize : 10
    if (textArr.length > 1) {
      width += exWidth * (textArr.length - 1)
    }

    wholeWidth = Math.max(wholeWidth, width)
    wholeHeight += height
    wholeFontWidth = Math.max(wholeFontWidth, fontWidth)

    return {
      textArr,
      width,
      height,
      color,
      fontStyle,
      fontWidth,
      fontHeight,
      exWidth,
    }
  })

  resizeCanvas(ctx.canvas, wholeWidth, wholeHeight)

  let offY = 0
  metricsArrList.forEach(({textArr, width, height, color, fontStyle, fontWidth, fontHeight, exWidth}) => {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // 设置字体
    ctx.fillStyle = color
    ctx.font = fontStyle

    textArr.forEach((t, idx) => {
      const x = fontWidth * 0.5 + (textArr.length - idx - 1) * (fontWidth + exWidth)
      let y = -fontHeight * 0.5
      for (let i = 0; i < t.length; i++) {
        y += fontHeight
        ctx.fillText(t[i], x, offY + y)
      }
    })

    offY += height
  })

  return {fontWidth: wholeFontWidth, width: wholeWidth, height: wholeHeight}
}

export default class TextDrawer extends Drawer<LayerTextProps> {
  get text() {
    const ref = this.ref
    return ref.store.getKeyInfo(ref.props.name || '')?.value || ref.props.textDocAttr.text || ''
  }
  cacheText = ''

  async init(gl: WebGLRendererContext) {
    const ref = this.ref

    const text = this.text
    let canvas = createCanvas(0, 0)
    let ctx = getContext2D(canvas, {willReadFrequently: true})
    if (ctx && ref.props.textDocAttr) {
      ctx.imageSmoothingEnabled = true
      ;(<any>ctx).webkitImageSmoothingEnabled = true
      ;(<any>ctx).mozImageSmoothingEnabled = true
      const textDocAttr = ref.props.textDocAttr
      // 竖向画字
      if (textDocAttr.orientation) {
        const {fontWidth} = drawVertiText(ctx, text, textDocAttr)
        // 此处记住锚点偏移
        let align = 'left'
        if (textDocAttr.textAligment !== undefined) {
          align = alignMap[textDocAttr.textAligment]
        }
        // 这玩意有点恶心，AE就是这样算出来的
        ref.anchorOffset.setX(canvas.width - fontWidth * 0.5)
        if (align === 'left') {
          ref.anchorOffset.setY(0)
        } else if (align === 'center') {
          ref.anchorOffset.setY(canvas.height * 0.5)
        } else {
          ref.anchorOffset.setY(canvas.height)
        }
      } else {
        // 水平画字
        const {fontHeight} = drawHorizText(ctx, text, textDocAttr)
        let align = 'left'
        if (textDocAttr.textAligment !== undefined) {
          align = alignMap[textDocAttr.textAligment]
        }
        // 这玩意有点恶心，AE就是这样算出来的
        ref.anchorOffset.setY(fontHeight)
        if (align === 'left') {
          ref.anchorOffset.setX(0)
        } else if (align === 'center') {
          ref.anchorOffset.setX(canvas.width * 0.5)
        } else {
          ref.anchorOffset.setX(canvas.width)
        }
      }

      ref.childOffset.set(ref.anchorOffset.x, -ref.anchorOffset.y)

      // 指定宽高
      ref.props.width = canvas.width
      ref.props.height = canvas.height
      // 生成纹理
      if (!this.texture) {
        this.texture = new Texture(gl)
      }

      this.texture.texImage2D(<TexImageSource>canvas)
    }
    // 清理
    ctx = null
    canvas = null as any
    if (typeof text === 'string') {
      this.cacheText = text
    }
  }

  draw(gl: WebGLRendererContext, matrix: Matrix4, frameInfo: FrameInfo) {
    if (!this.texture) return

    gl.activeTexture(gl.TEXTURE0)
    this.texture.bind()
    gl.uniformMatrix4fv(gl.uniforms.matrix, false, matrix.elements)

    const ref = this.ref
    const width = ref.props.width
    const height = ref.props.height
    drawTexture(this.getAttribBuffer(gl), width, height)

    gl.bindTexture(gl.TEXTURE_2D, null)
  }
}
