import {LayerBaseProps, LayerTextProps} from '../types'
import {DrawContext} from './Drawer'
import {ElementDrawer, toRGBA} from './ElementDrawer'

type TextLayerProps = LayerBaseProps & LayerTextProps

const ALIGN: CanvasTextAlign[] = ['left', 'right', 'center']

export class TextDrawer extends ElementDrawer {
  protected paint(ctx: CanvasRenderingContext2D, width: number, height: number, context: DrawContext): boolean {
    const props = context.layer.props as TextLayerProps
    const attr = props.textDocAttr
    if (!attr) return false

    const text = attr.text ?? props.content ?? ''
    if (!text) return false

    const fontSize = attr.fontSize || 24
    const family = attr.fontFamily || attr.font || 'sans-serif'
    const style = attr.fontStyle && /italic/i.test(attr.fontStyle) ? 'italic' : 'normal'
    const weight = attr.fauxBold ? 'bold' : 'normal'
    ctx.font = `${style} ${weight} ${fontSize}px ${family}`
    ctx.fillStyle = toRGBA(attr.textColor, 1)
    ctx.textBaseline = 'top'
    ctx.textAlign = ALIGN[attr.textAligment ?? 0] || 'left'

    const lineHeight = fontSize * (attr.lineSpacing ? attr.lineSpacing / fontSize : 1.2)
    const originX = ctx.textAlign === 'center' ? width / 2 : ctx.textAlign === 'right' ? width : 0

    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], originX, i * lineHeight)
    }
    return true
  }
}
