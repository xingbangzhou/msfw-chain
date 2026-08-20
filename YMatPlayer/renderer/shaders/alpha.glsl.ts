export const getAlphaVertex = (opts?: {webgl2?: boolean}) => {
  const webgl2 = opts?.webgl2

  const prefixVertex = webgl2
    ? ['#version 300 es', '#define attribute in', '#define varying out'].join('\n') + '\n'
    : ''

  return `${prefixVertex}
  attribute vec4 a_position;  // 接受顶点坐标
  attribute vec2 a_texcoord;  // 接受纹理坐标
  
  varying vec2 v_texcoord;
  
  void main() {
    gl_Position = a_position;
  
    v_texcoord = a_texcoord;
  }
`
}

export const getAlphaFragment = (opts?: {webgl2?: boolean}) => {
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

uniform sampler2D u_texture;

void main(void) {
  vec4 outColor = texture2D(u_texture, v_texcoord);
  float alpha = texture2D(u_texture, v_texcoord + vec2(0.5, 0.0)).r;
  outColor.a = outColor.a * alpha;

  gl_FragColor = outColor;
}
`
}
