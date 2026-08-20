export function createCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof document === 'undefined' && self.OffscreenCanvas) {
    return new OffscreenCanvas(width, height)
  }
  const canvas = document.createElement('canvas')
  canvas.style.display = 'block'
  if (width && height) {
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    canvas.width = width
    canvas.height = height
  }

  return canvas
}

export type CanvasType = ReturnType<typeof createCanvas>

export type CanvasContext2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D

export function getContext2D(canvas: OffscreenCanvas | HTMLCanvasElement, options?: any) {
  return canvas.getContext('2d', options) as CanvasContext2D | null
}

export function resizeCanvas(canvas: CanvasType, width: number, height: number) {
  const style = (canvas as HTMLCanvasElement).style
  if (style) {
    style.width = `${width}px`
    style.height = `${height}px`
  }
  canvas.width = width
  canvas.height = height

  return canvas
}
