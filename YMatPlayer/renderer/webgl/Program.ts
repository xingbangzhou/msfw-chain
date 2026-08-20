import {WebGLRendererContext} from '../../utils/shims'

function createShader(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type) as WebGLShader
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(`An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`)
  }

  return shader
}

type ProgramUniforms = {[key: string]: WebGLUniformLocation | null}

export default class Program {
  constructor(gl: WebGLRendererContext, parameters: {vertexShader: string; fragmentShader: string}) {
    this.gl = gl
    const program = (this.program = gl.createProgram() as WebGLProgram)

    this.vertexShader = createShader(gl, gl.VERTEX_SHADER, parameters.vertexShader)
    this.fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, parameters.fragmentShader)

    gl.attachShader(program, this.vertexShader)
    gl.attachShader(program, this.fragmentShader)

    gl.linkProgram(program)

    const status = gl.getProgramParameter(this.program, gl.LINK_STATUS)
    if (!status) {
      console.error(`An error occurred linkProgram: ${gl.getProgramInfoLog(this.program)}`, status)
      this.destroy()
    }
  }

  gl: WebGLRendererContext | null
  program: WebGLProgram | null
  vertexShader: WebGLShader | null
  fragmentShader: WebGLShader | null

  invalid() {
    return !this.program
  }

  use(uniforms?: string[], attribs?: string[], textures?: string[]) {
    const gl = this.gl
    const program = this.program
    if (!gl || !program) return

    gl.useProgram(program)

    gl.attribs = {
      position: gl.getAttribLocation(program, 'a_position'),
      texcoord: gl.getAttribLocation(program, 'a_texcoord'),
    }
    attribs?.forEach(el => {
      gl.attribs[el] = gl.getAttribLocation(program, `a_${el}`)
    })

    const programUniforms: ProgramUniforms = {}
    uniforms?.forEach(el => {
      programUniforms[el] = gl.getUniformLocation(program, `u_${el}`)
    })
    gl.uniforms = programUniforms as any

    const uTextureLocation = gl.getUniformLocation(program, 'u_texture')
    if (uTextureLocation) {
      gl.uniform1i(uTextureLocation, 0)
    }
    textures?.forEach((el, index) => {
      const textureLocation = gl.getUniformLocation(program, `u_${el}`)
      if (textureLocation) {
        gl.uniform1i(textureLocation, index + 1)
      }
    })
  }

  destroy() {
    if (this.gl === null) return
    const gl = this.gl
    this.gl = null

    gl.attribs = null as any
    gl.uniforms = null as any

    gl.deleteShader(this.vertexShader)
    this.vertexShader = null
    gl.deleteShader(this.fragmentShader)
    this.fragmentShader = null
    gl.deleteProgram(this.program)
    this.program = null
  }
}
