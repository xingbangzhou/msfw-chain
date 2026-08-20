export const getEvaVertex = (opts?: {webgl2?: boolean}) => {
  const webgl2 = opts?.webgl2

  const prefixVertex = webgl2
    ? ['#version 300 es', '#define attribute in', '#define varying out'].join('\n') + '\n'
    : ''

  return `${prefixVertex}
attribute vec4 a_position;  // 接受顶点坐标
attribute vec2 a_texcoord;  // 接受纹理坐标
attribute vec2 a_alpha_texCoord; // 接受透明纹理坐标

varying vec2 v_texcoord;
varying vec2 v_alpha_texCoord;

void main() {
  gl_Position = a_position;

  v_texcoord = a_texcoord;
  v_alpha_texCoord = a_alpha_texCoord;
}
`
}

export const getEvaFragment = (opts?: {webgl2?: boolean; effectSize: number}) => {
  const webgl2 = opts?.webgl2
  const effectSize = opts?.effectSize || 0

  const prefixFragment = webgl2
    ? [
        '#version 300 es',
        '#define varying in',
        'layout(location = 0) out mediump vec4 fragColor;',
        '#define gl_FragColor fragColor',
        '#define texture2D texture',
      ].join('\n') + '\n'
    : ''

  let strUniform = ''
  let strTexture = ''

  if (effectSize > 0) {
    strUniform = strUniform.concat(`uniform float u_image_pos[${effectSize * 8}];\n`)
    strTexture = strTexture.concat(`
        float lx,ly,rx,ry,mlx,mly,mrx,mry;
        `)
    for (let i = 0; i < effectSize; i++) {
      strUniform = strUniform.concat(`uniform sampler2D u_image${i + 1};\n`)
      strTexture = strTexture.concat(`
          lx = u_image_pos[${i * 8}];
          ly = u_image_pos[${i * 8 + 1}];
          rx = u_image_pos[${i * 8 + 2}];
          ry = u_image_pos[${i * 8 + 3}];
          mlx = u_image_pos[${i * 8 + 4}];
          mly = u_image_pos[${i * 8 + 5}];
          mrx = u_image_pos[${i * 8 + 6}];
          mry = u_image_pos[${i * 8 + 7}];
          if (v_texcoord.x > lx && v_texcoord.x < rx && v_texcoord.y > ly && v_texcoord.y < ry) {
            vec2 imgTexcoord = vec2((v_texcoord.x - lx)/(rx - lx), (v_texcoord.y - ly)/(ry - ly));
            vec4 imgColor = texture2D(u_image${i + 1}, imgTexcoord);
            vec2 maskTexcoord = vec2(mlx + imgTexcoord.x*(mrx - mlx), mly + imgTexcoord.y*(mry - mly));
            vec4 maskColor = texture2D(u_texture, maskTexcoord);
            imgColor.a = imgColor.a*(maskColor.r);
            outColor = vec4(imgColor.rgb*imgColor.a,imgColor.a) + (1.0-imgColor.a)*outColor;
          }
        `)
    }
  }

  return `${prefixFragment}
  precision mediump float;
  varying vec2 v_texcoord;
  varying vec2 v_alpha_texCoord;
  
  uniform int u_isTexScreen;
  ${strUniform}
  uniform sampler2D u_texture;
  
  void main(void) {
    vec4 outColor = texture2D(u_texture, v_texcoord);
    if (u_isTexScreen == 1) {
      gl_FragColor = outColor;
      return;
    }

    outColor.a = outColor.a * texture2D(u_texture, v_alpha_texCoord).r;
    ${strTexture}
    gl_FragColor = outColor;
  }
`
}
