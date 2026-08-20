import {IPHONE} from './ua'

export type WebGLRendererContext = WebGLRenderingContext &
  WebGL2RenderingContext & {
    isWebGL2?: boolean

    attribs: {
      position: number
      texcoord: number
      [key: string]: number
    }
    uniforms: {
      // matrix: WebGLUniformLocation
      // opacity: WebGLUniformLocation
      // isAlpha: WebGLUniformLocation
      // blendMode: WebGLUniformLocation
      // maskMode: WebGLUniformLocation
      // // 亮度和对比度
      // brightness: WebGLUniformLocation
      // contrast: WebGLUniformLocation
      // // 色相和饱和度
      // colorize: WebGLUniformLocation
      // hue: WebGLUniformLocation
      // saturation: WebGLUniformLocation
      // lightness: WebGLUniformLocation

      [key: string]: WebGLUniformLocation
    }
  }

export const isInstanceOf = (value: any, type: any) => typeof type !== 'undefined' && value instanceof type
