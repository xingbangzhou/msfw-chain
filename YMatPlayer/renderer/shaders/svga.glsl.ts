export const getSvgaVertex = (opts?: {webgl2?: boolean}) => {
  const webgl2 = opts?.webgl2

  const prefixVertex = webgl2
    ? ['#version 300 es', '#define attribute in', '#define varying out'].join('\n') + '\n'
    : ''

  return `${prefixVertex}
attribute vec2 a_position;  // 接受顶点坐标
attribute vec2 a_texcoord;  // 接受纹理坐标

uniform mat3 u_matrix;  // 顶点矩阵
uniform int u_isResolution;
uniform vec2 u_resolution;

varying vec2 v_texcoord;
varying vec2 v_maskTexcoord;

void main() {
  vec2 position = (u_matrix * vec3(a_position.xy, 1.0)).xy;
  if (u_isResolution == 1) {
    position = vec2(position.x - u_resolution.x, u_resolution.y - position.y)  / u_resolution;
  }
 
  gl_Position = vec4(position.xy, 0, 1);
  v_texcoord = a_texcoord;
  v_maskTexcoord = vec2((position.x + 1.0)*0.5, (1.0 - position.y)*0.5);
}
`
}

export const getSvgaFragment = (opts?: {webgl2?: boolean}) => {
  const webgl2 = opts?.webgl2

  const prefixFragment = webgl2
    ? [
        '#version 300 es',
        '#define varying in',
        'layout(location = 0) out mediump vec4 fragColor;',
        '#define gl_FragColor fragColor',
        '#define texture2D texture',
      ].join('\n') + '\n'
    : ''

  return `${prefixFragment}
precision mediump float;

varying vec2 v_texcoord;
varying vec2 v_maskTexcoord;

uniform sampler2D u_texture;
uniform sampler2D u_maskTexture;

uniform float u_opacity;
uniform int u_maskMode;

void main(void) {
  vec4 outColor = texture2D(u_texture, v_texcoord);
  float opacity = u_opacity;
  if (u_maskMode == 1) {
    outColor = outColor * texture2D(u_maskTexture, v_maskTexcoord).r;
  }
  outColor.a = outColor.a * opacity;

  gl_FragColor = outColor;
}
`
}
