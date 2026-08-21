export interface WebGLInfoMemory {
  geometries: number
  textures: number
  programs: number
}

export interface WebGLInfoRender {
  calls: number
  triangles: number
  points: number
  lines: number
}

/**
 * WebGLInfo — renderer 运行时统计。
 *
 * 对齐 three.js 的 info 入口，但只保留当前 2D/WebGL2 管线需要的资源与绘制计数。
 */
export class WebGLInfo {
  private gl: WebGL2RenderingContext

  memory: WebGLInfoMemory = {
    geometries: 0,
    textures: 0,
    programs: 0,
  }

  render: WebGLInfoRender = {
    calls: 0,
    triangles: 0,
    points: 0,
    lines: 0,
  }

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
  }

  reset(): void {
    this.render.calls = 0
    this.render.triangles = 0
    this.render.points = 0
    this.render.lines = 0
  }

  update(count: number, mode: number, instanceCount = 1): void {
    this.render.calls++

    const primitiveCount = count * instanceCount

    const gl = this.gl

    switch (mode) {
      case gl.TRIANGLES:
        this.render.triangles += primitiveCount / 3
        break
      case gl.TRIANGLE_STRIP:
      case gl.TRIANGLE_FAN:
        this.render.triangles += Math.max(0, primitiveCount - 2)
        break
      case gl.LINES:
        this.render.lines += primitiveCount / 2
        break
      case gl.LINE_STRIP:
        this.render.lines += Math.max(0, primitiveCount - 1)
        break
      case gl.LINE_LOOP:
        this.render.lines += primitiveCount
        break
      case gl.POINTS:
        this.render.points += primitiveCount
        break
    }
  }
}
