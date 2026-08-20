import {
  Movie,
  SvgaPlayInfo,
  RawImages,
  SpriteFrame,
  SHAPE_TYPE,
  SHAPE_TYPE_CODE,
  LINE_CAP_CODE,
  LINE_JOIN_CODE,
  RGBA,
  FrameShapes,
  SpriteInfo,
} from './types'

export function uint8ArrayToString(u8a: Uint8Array): string {
  let dataString = ''
  for (let i = 0; i < u8a.length; i++) {
    dataString += String.fromCharCode(u8a[i])
  }
  return dataString
}

export function getSvgaInfo(movie: Movie, images: RawImages = {}): SvgaPlayInfo {
  const {viewBoxWidth, viewBoxHeight, fps, frames} = movie.params

  const version = movie.version
  const size = {width: viewBoxWidth, height: viewBoxHeight}

  let withShape = false

  const sprites: SpriteInfo[] = []
  movie.sprites.forEach(spriteSpec => {
    const vFrames: SpriteFrame[] = []
    const vSprite: SpriteInfo = {
      matteKey: spriteSpec.matteKey,
      imageKey: spriteSpec.imageKey,
      frames: vFrames,
    }

    let lastShapes: FrameShapes | undefined

    spriteSpec.frames.forEach(frameSpec => {
      const layout = {
        x: frameSpec.layout?.x || 0.0,
        y: frameSpec.layout?.y || 0.0,
        width: frameSpec.layout?.width || 0.0,
        height: frameSpec.layout?.height || 0.0,
      }

      const transform = {
        a: frameSpec.transform?.a || 1.0,
        b: frameSpec.transform?.b || 0.0,
        c: frameSpec.transform?.c || 0.0,
        d: frameSpec.transform?.d || 1.0,
        tx: frameSpec.transform?.tx || 0.0,
        ty: frameSpec.transform?.ty || 0.0,
      }

      const clipPath = frameSpec.clipPath || ''

      let shapes: FrameShapes = []

      frameSpec.shapes?.forEach(shape => {
        const stylesSpec = shape.styles
        if (!stylesSpec) return

        const lineDash: number[] = []
        if (stylesSpec.lineDashI !== null && stylesSpec.lineDashI > 0) {
          lineDash.push(stylesSpec.lineDashI)
        }
        if (stylesSpec.lineDashII !== null && stylesSpec.lineDashII > 0) {
          if (lineDash.length < 1) {
            lineDash.push(0)
          }
          lineDash.push(stylesSpec.lineDashII)
        }
        if (stylesSpec.lineDashIII !== null && stylesSpec.lineDashIII > 0) {
          if (lineDash.length < 2) {
            lineDash.push(0)
            lineDash.push(0)
          }
          lineDash[2] = stylesSpec.lineDashIII
        }

        let lineCap: CanvasLineCap | null = null
        switch (stylesSpec.lineCap) {
          case LINE_CAP_CODE.BUTT:
            lineCap = 'butt'
            break
          case LINE_CAP_CODE.ROUND:
            lineCap = 'round'
            break
          case LINE_CAP_CODE.SQUARE:
            lineCap = 'square'
            break
        }

        let lineJoin: CanvasLineJoin | null = null
        switch (stylesSpec.lineJoin) {
          case LINE_JOIN_CODE.BEVEL:
            lineJoin = 'bevel'
            break
          case LINE_JOIN_CODE.ROUND:
            lineJoin = 'round'
            break
          case LINE_JOIN_CODE.MITER:
            lineJoin = 'miter'
            break
        }

        let fill: RGBA<number, number, number, number> | null = null
        const fillProp = stylesSpec.fill as any
        if (fillProp) {
          const r = fillProp.r || fillProp[0] || 0
          const g = fillProp.g || fillProp[1] || 0
          const b = fillProp.b || fillProp[2] || 0
          const a = (fillProp.a || fillProp[3]) ?? 1
          fill = `rgba(${parseInt((r * 255).toString())}, ${parseInt((g * 255).toString())}, ${parseInt(
            (b * 255).toString(),
          )}, ${parseInt((a * 1).toString())})`
        }

        let stroke: RGBA<number, number, number, number> | null = null
        const strokeProp = stylesSpec.stroke as any
        if (strokeProp) {
          const r = strokeProp.r || strokeProp[0] || 0
          const g = strokeProp.g || strokeProp[1] || 0
          const b = strokeProp.b || strokeProp[2] || 0
          const a = (strokeProp.a || strokeProp[3]) ?? 1
          stroke = `rgba(${parseInt(r.toString())}, ${parseInt((g * 255).toString())}, ${parseInt(
            (b * 255).toString(),
          )}, ${parseInt((a * 1).toString())})`
        }

        const {strokeWidth, miterLimit} = stylesSpec

        const styles = {
          lineDash,
          fill,
          stroke,
          lineCap,
          lineJoin,
          strokeWidth,
          miterLimit,
        }

        const transform = {
          a: shape.transform?.a ?? 1.0,
          b: shape.transform?.b ?? 0.0,
          c: shape.transform?.c ?? 0.0,
          d: shape.transform?.d ?? 1.0,
          tx: shape.transform?.tx ?? 0.0,
          ty: shape.transform?.ty ?? 0.0,
        }

        const pathArgs = (shape as any).args
        switch (shape.type) {
          case 0:
            shapes.push({
              type: SHAPE_TYPE.SHAPE,
              path: shape.shape || pathArgs,
              styles,
              transform,
            })
            break
          case 1:
            shapes.push({
              type: SHAPE_TYPE.RECT,
              path: shape.rect || pathArgs,
              styles,
              transform,
            })
            break
          case 2:
            shapes.push({
              type: SHAPE_TYPE.ELLIPSE,
              path: shape.ellipse || pathArgs,
              styles,
              transform,
            })
            break
        }
      })

      const type = (frameSpec.shapes?.[0] as any)?.type
      if ((type === 'keep' || type === SHAPE_TYPE_CODE.KEEP) && lastShapes) {
        shapes = lastShapes
      } else {
        lastShapes = shapes
      }
      if (shapes.length) {
        withShape = true
      }

      vSprite.frames.push({
        alpha: frameSpec.alpha ?? 0,
        layout,
        transform,
        shapes,
        clipPath,
      })
    })
    sprites.push(vSprite)
  })

  return {
    version,
    size,
    fps,
    frames,
    images,
    sprites,
    withShape,
  }
}
