export const getVertex = (opts?: {webgl2?: boolean}) => {
  const webgl2 = opts?.webgl2

  const prefixVertex = webgl2
    ? ['#version 300 es', '#define attribute in', '#define varying out'].join('\n') + '\n'
    : ''

  return `${prefixVertex}
attribute vec4 a_position;  // 接受顶点坐标
attribute vec2 a_texcoord;  // 接受纹理坐标

uniform mat4 u_matrix;  // 顶点矩阵

varying vec2 v_texcoord;

void main() {
  gl_Position = u_matrix * a_position;

  v_texcoord = a_texcoord;
}
`
}

const header = `precision mediump float;
varying vec2 v_texcoord;

uniform sampler2D u_texture;
uniform sampler2D u_dstTexture;

uniform float u_opacity;
uniform int u_isAlpha;
// 遮罩模式
uniform int u_maskMode;
// 混合模式
uniform int u_blendMode;
// 亮度和对比度
uniform float u_brightness;
uniform float u_contrast;
// 色相和饱和度
uniform int u_colorize;
uniform float u_hue;
uniform float u_saturation;
uniform float u_lightness;
// 抓取模式
uniform int u_grapMode;

`

const maskFnGlsl = `
// 遮罩模式
vec4 mask_alpha(vec4 src) {
  vec4 dst = texture2D(u_dstTexture, v_texcoord);

  float alpha = dst.a;
  if (u_grapMode == 1) {
    alpha = step(0.2, alpha);
  }

  return src * alpha;
}

vec4 mask_alpha_inverted(vec4 src) {
  vec4 dst = texture2D(u_dstTexture, v_texcoord);
  
  float alpha = (1.0 - dst.a);
  if (u_grapMode == 1) {
    alpha = step(0.2, alpha);
  }

  return src;
}

float LUMA(vec3 RGB) {
  return clamp(dot(vec3(0.21260000000000001, 0.71519999999999995, 0.0722), RGB), 0.0, 1.0);
}

vec4 mask_luma(vec4 src) {
  vec4 dst = texture2D(u_dstTexture, v_texcoord);
  
  float luma = LUMA(dst.rgb);
  if (u_grapMode == 1) {
    luma = step(0.2, luma);
  }

  return src * luma;
}

vec4 mask_luma_inverted(vec4 src) {
  vec4 dst = texture2D(u_dstTexture, v_texcoord);
  
  float luma = (1.0 - LUMA(dst.rgb));
  if (u_grapMode == 1) {
    luma = step(0.2, luma);
  }

  return src * luma;
}

vec4 cvtMask(vec4 src, int mode) {
  if (mode == 1) return mask_alpha(src);
  if (mode == 2) return mask_alpha_inverted(src);
  if (mode == 3) return mask_luma(src);
  if (mode == 4) return mask_luma_inverted(src);

  return src;
}
`

const preHsBcFnGlsl = `
#define EPSILON 1e-10
vec3 saturate(vec3 v) { return clamp(v, vec3(0.0), vec3(1.0)); }

vec3 HUE2RGB(float H) {
  float R = abs(H * 6.0 - 3.0) - 1.0;
  float G = 2.0 - abs(H * 6.0 - 2.0);
  float B = 2.0 - abs(H * 6.0 - 4.0);
  return saturate(vec3(R,G,B));
}

vec3 RGB2HCV(vec3 RGB) {
  vec4 P = (RGB.g < RGB.b) ? vec4(RGB.bg, -1.0, 2.0/3.0) : vec4(RGB.gb, 0.0, -1.0/3.0);
  vec4 Q = (RGB.r < P.x) ? vec4(P.xyw, RGB.r) : vec4(RGB.r, P.yzx);
  float C = Q.x - min(Q.w, Q.y);
  float H = abs((Q.w - Q.y) / (6.0 * C + EPSILON) + Q.z);
  return vec3(H, C, Q.x);
}

vec3 RGB2HSV(vec3 RGB) {
  vec3 HCV = RGB2HCV(RGB);
  float S = HCV.y / (HCV.z + EPSILON);
  return vec3(HCV.x, S, HCV.z);
}

vec3 HSV2RGB(vec3 HSV) {
  vec3 RGB = HUE2RGB(HSV.x);
  return ((RGB - 1.0) * HSV.y + 1.0) * HSV.z;
}
`

const hueSaturationGlsl = `
// 色相和饱和度
vec4 hue_saturation(vec4 src) {
  if (u_colorize == 0) {
    return src;
  }
  
  vec3 rgbColor = src.rgb;
  vec3 hsvColor = RGB2HSV(rgbColor);
  if (u_colorize == 1) {
      hsvColor.x = fract(hsvColor.x + u_hue);
      hsvColor.y *= (u_saturation + 1.0);
      rgbColor = HSV2RGB(hsvColor);
      rgbColor += u_lightness;
    } else {
      hsvColor.x = fract(u_hue);
      hsvColor.y = u_saturation;
      rgbColor = HSV2RGB(hsvColor);
      rgbColor += u_lightness;
    }
  
  return vec4(rgbColor * src.a, src.a);
}
`

const brightnessContrastGlsl = `
// 亮度和对比度
vec4 brightness_contrast(vec4 src) {
  vec3 rgb = src.rgb * u_contrast + 0.5 - u_contrast * 0.5;
  if (u_brightness == 0.0) {
    return src;
  }

  vec3 hsv = RGB2HSV(rgb);
  hsv.z *= (u_brightness + 1.0);
  rgb = HSV2RGB(hsv);
  rgb += (u_brightness / 2.0);

  return vec4(rgb * src.a, src.a);
}
`

const preBlendGlsl = `
float saturation(vec3 color) {
  return max(max(color.r, color.g), color.b) - min(min(color.r, color.g), color.b);
}

vec3 set_saturation_helper(float minComp, float midComp, float maxComp, float sat) {
  if (minComp < maxComp) {
    vec3 result;
    result.r = 0.0;
    result.g = sat * (midComp - minComp) / (maxComp - minComp);
    result.b = sat;
    return result;
  } else {
    return vec3(0, 0, 0);
  }
}

vec3 set_saturation(vec3 hueLumColor, vec3 satColor) {
  float sat = saturation(satColor);
  if (hueLumColor.r <= hueLumColor.g) {
    if (hueLumColor.g <= hueLumColor.b) {
      hueLumColor.rgb = set_saturation_helper(hueLumColor.r, hueLumColor.g, hueLumColor.b, sat);
    } else if (hueLumColor.r <= hueLumColor.b) {
      hueLumColor.rbg = set_saturation_helper(hueLumColor.r, hueLumColor.b, hueLumColor.g, sat);
    } else {
      hueLumColor.brg = set_saturation_helper(hueLumColor.b, hueLumColor.r, hueLumColor.g, sat);
    }
  } else if (hueLumColor.r <= hueLumColor.b) {
    hueLumColor.grb = set_saturation_helper(hueLumColor.g, hueLumColor.r, hueLumColor.b, sat);
  } else if (hueLumColor.g <= hueLumColor.b) {
    hueLumColor.gbr = set_saturation_helper(hueLumColor.g, hueLumColor.b, hueLumColor.r, sat);
  } else {
    hueLumColor.bgr = set_saturation_helper(hueLumColor.b, hueLumColor.g, hueLumColor.r, sat);
  }
  return hueLumColor;
}

float luminance(vec3 color) {
  return dot(vec3(0.3, 0.59, 0.11), color);
}

vec3 set_luminance(vec3 hueSat, float alpha, vec3 lumColor) {
  float diff = luminance(lumColor - hueSat);
  vec3 outColor = hueSat + diff;
  float outLum = luminance(outColor);
  float minComp = min(min(outColor.r, outColor.g), outColor.b);
  float maxComp = max(max(outColor.r, outColor.g), outColor.b);
  if (minComp < 0.0 && outLum != minComp) {
    outColor = outLum + ((outColor - vec3(outLum, outLum, outLum)) * outLum) / (outLum - minComp);
  }
  if (maxComp > alpha && maxComp != outLum) {
    outColor = outLum + ((outColor - vec3(outLum, outLum, outLum)) * (alpha - outLum)) / (maxComp - outLum);
  }
  return outColor;
}

vec3 set_hardlight(vec4 dst, vec4 src) {
  vec3 rgb = vec3(0.0, 0.0, 0.0);
  if (2.0 * src.r < src.a) {
    rgb.r = 2.0 * src.r * dst.r;
  } else {
    rgb.r = src.a * dst.a - 2.0 * (dst.a - dst.r) * (src.a - src.r); 
  }
  if (2.0 * src.g < src.a) {
    rgb.g = 2.0 * src.g * dst.g;
  } else {
    rgb.g = src.a * dst.a - 2.0 * (dst.a - dst.g) * (src.a - src.g); 
  }
  if (2.0 * src.b < src.a) {
    rgb.b = 2.0 * src.b * dst.b;
  } else {
    rgb.b = src.a * dst.a - 2.0 * (dst.a - dst.b) * (src.a - src.b); 
  }

  rgb += src.rgb * (1.0 - dst.a) + dst.rgb * (1.0 - src.a);

  return rgb;
}
`

const blendFnNames = [
  'blend_add',
  'blend_screen',
  'blend_overlay',
  'blend_soft_light',
  'blend_lighten',
  'blend_darken',
  'blend_multiply',
  'blend_color_burn',
  'blend_color_dodge',
  'blend_hard_light',
  'blend_difference',
  'blend_exclusion',
  'blend_hue',
  'blend_saturation',
  'blend_color',
  'blend_luminosity',
]

const blendFnGlsls = [
  `
vec4 blend_add(vec4 src) {
  vec4 dst = texture2D(u_dstTexture, v_texcoord);

  vec3 rgb = dst.rgb + src.rgb;
  float a = src.a + dst.a * (1.0 - src.a);

  return vec4(rgb, a);
}
`,
  `
vec4 blend_screen(vec4 src) {
  vec4 dst = texture2D(u_dstTexture, v_texcoord);

  vec3 rgb = 1.0 - (1.0 - dst.rgb) * (1.0 - src.rgb);
  float a = src.a + dst.a * (1.0 - src.a);

  return vec4(rgb, a);
}
`,
  `
vec4 blend_overlay(vec4 src) {
  vec4 dst = texture2D(u_dstTexture, v_texcoord);

  vec3 rgb = set_hardlight(src, dst);
  float a = src.a + dst.a * (1.0 - src.a);

  return vec4(rgb, a);
}
`,
  `
vec4 blend_soft_light(vec4 src) {
  vec4 dst = texture2D(u_dstTexture, v_texcoord);

  if (0.0 == dst.a) {
    return src;
  }

  vec3 rgb = vec3(0.0, 0.0, 0.0);
  if (2.0 * src.r <= src.a) {
    rgb.r = (dst.r*dst.r*(src.a - 2.0*src.r)) / dst.a + (1.0 - dst.a) * src.r + dst.r*(-src.a + 2.0*src.r + 1.0);
  } else if (4.0 * dst.r <= dst.a) {
    float DSqd = dst.r * dst.r;
    float DCub = DSqd * dst.r;
    float DaSqd = dst.a * dst.a;
    float DaCub = DaSqd * dst.a;
    rgb.r = (DaSqd*(src.r - dst.r * (3.0*src.a - 6.0*src.r - 1.0)) + 12.0*dst.a*DSqd*(src.a - 2.0*src.r) - 16.0*DCub * (src.a - 2.0*src.r) - DaCub*src.r) / DaSqd;
  } else {
    rgb.r = dst.r*(src.a - 2.0*src.r + 1.0) + src.r - sqrt(dst.a*dst.r)*(src.a - 2.0*src.r) - dst.a*src.r;
  }
  if (2.0 * src.g <= src.a) {
    rgb.g = (dst.g*dst.g*(src.a - 2.0*src.g)) / dst.a + (1.0 - dst.a) * src.g + dst.g*(-src.a + 2.0*src.g + 1.0);
  } else if (4.0 * dst.g <= dst.a) {
    float DSqd = dst.g * dst.g;
    float DCub = DSqd * dst.g;
    float DaSqd = dst.a * dst.a;
    float DaCub = DaSqd * dst.a;
    rgb.g = (DaSqd*(src.g - dst.g * (3.0*src.a - 6.0*src.g - 1.0)) + 12.0*dst.a*DSqd*(src.a - 2.0*src.g) - 16.0*DCub * (src.a - 2.0*src.g) - DaCub*src.g) / DaSqd;
  } else {
    rgb.g = dst.g*(src.a - 2.0*src.g + 1.0) + src.g - sqrt(dst.a*dst.g)*(src.a - 2.0*src.g) - dst.a*src.g;
  }
  if (2.0 * src.b <= src.a) {
    rgb.b = (dst.b*dst.b*(src.a - 2.0*src.b)) / dst.a + (1.0 - dst.a) * src.b + dst.b*(-src.a + 2.0*src.b + 1.0);
  } else if (4.0 * dst.b <= dst.a) {
    float DSqd = dst.b * dst.b;
    float DCub = DSqd * dst.b;
    float DaSqd = dst.a * dst.a;
    float DaCub = DaSqd * dst.a;
    rgb.b = (DaSqd*(src.b - dst.b * (3.0*src.a - 6.0*src.b - 1.0)) + 12.0*dst.a*DSqd*(src.a - 2.0*src.b) - 16.0*DCub * (src.a - 2.0*src.b) - DaCub*src.b) / DaSqd;
  } else {
    rgb.b = dst.b*(src.a - 2.0*src.b + 1.0) + src.b - sqrt(dst.a*dst.b)*(src.a - 2.0*src.b) - dst.a*src.b;
  }

  float a = src.a + dst.a * (1.0 - src.a);

  return vec4(rgb, a);
}
`,
  `
vec4 blend_lighten(vec4 src) {
  vec4 dst = texture2D(u_dstTexture, v_texcoord);

  vec3 rgb = max((1.0 - src.a) * dst.rgb + src.rgb, (1.0 - dst.a) * src.rgb + dst.rgb);
  float a = src.a + dst.a * (1.0 - src.a);

  return vec4(rgb, a);
}
`,
  `
vec4 blend_darken(vec4 src) {
  vec4 dst = texture2D(u_dstTexture, v_texcoord);

  vec3 rgb = min((1.0 - src.a) * dst.rgb + src.rgb, (1.0 - dst.a) * src.rgb + dst.rgb);
  float a = src.a + dst.a * (1.0 - src.a);

  return vec4(rgb, a);
}
`,
  `
vec4 blend_multiply(vec4 src) {
  vec4 dst = texture2D(u_dstTexture, v_texcoord);

  vec3 rgb = (1.0 - src.a) * dst.rgb + (1.0 - dst.a) * src.rgb + src.rgb * dst.rgb;
  float a = src.a + dst.a * (1.0 - src.a);

  return vec4(rgb, a);
}
`,
  `
vec4 blend_color_burn(vec4 src) {
  vec4 dst = texture2D(u_dstTexture, v_texcoord);

  vec3 rgb = vec3(0.0, 0.0, 0.0);
  if (dst.a == dst.r) {
    rgb.r = src.a * dst.a + src.r * (1.0 - dst.a) + dst.r * (1.0 - src.a);
  } else if (0.0 == src.r) {
    rgb.r = dst.r * (1.0 - src.a);
  } else {
    float d = max(0.0, dst.a - (dst.a - dst.r) * src.a / src.r);
    rgb.r = src.a * d + src.r * (1.0 - dst.a) + dst.r * (1.0 - src.a);
  }
  if (dst.a == dst.g) {
    rgb.g = src.a * dst.a + src.g * (1.0 - dst.a) + dst.g * (1.0 - src.a);
  } else if (0.0 == src.g) {
    rgb.g = dst.g * (1.0 - src.a);
  } else {
    float d = max(0.0, dst.a - (dst.a - dst.g) * src.a / src.g);
    rgb.g = src.a * d + src.g * (1.0 - dst.a) + dst.g * (1.0 - src.a);
  }
  if (dst.a == dst.b) {
    rgb.b = src.a * dst.a + src.b * (1.0 - dst.a) + dst.b * (1.0 - src.a);
  } else if (0.0 == src.b) {
    rgb.b = dst.b * (1.0 - src.a);
  } else {
    float d = max(0.0, dst.a - (dst.a - dst.b) * src.a / src.b);
    rgb.b = src.a * d + src.b * (1.0 - dst.a) + dst.b * (1.0 - src.a);
  }
  float a = src.a + dst.a * (1.0 - src.a);

  return vec4(rgb, a);
}
`,
  `
vec4 blend_color_dodge(vec4 src) {
  vec4 dst = texture2D(u_dstTexture, v_texcoord);

  vec3 rgb = vec3(0.0, 0.0, 0.0);
  if (0.0 == dst.r) {
    rgb.r = src.r * (1.0 - dst.a);
  } else {
    float d = src.a - src.r;
    if (0.0 == d) {
      rgb.r = src.a * dst.a + src.r * (1.0 - dst.a) + dst.r * (1.0 - src.a);
    } else {
      d = min(dst.a, dst.r * src.a / d);
      rgb.r = d * src.a + src.r * (1.0 - dst.a) + dst.r * (1.0 - src.a);
    }
  }
  if (0.0 == dst.g) {
    rgb.g = src.g * (1.0 - dst.a);
  } else {
    float d = src.a - src.g;
    if (0.0 == d) {
      rgb.g = src.a * dst.a + src.g * (1.0 - dst.a) + dst.g * (1.0 - src.a);
    } else {
      d = min(dst.a, dst.g * src.a / d);
      rgb.g = d * src.a + src.g * (1.0 - dst.a) + dst.g * (1.0 - src.a);
    }
  }
  if (0.0 == dst.b) {
    rgb.b = src.b * (1.0 - dst.a);
  } else {
    float d = src.a - src.b;
    if (0.0 == d) {
      rgb.b = src.a * dst.a + src.b * (1.0 - dst.a) + dst.b * (1.0 - src.a);
    } else {
      d = min(dst.a, dst.b * src.a / d);
      rgb.b = d * src.a + src.b * (1.0 - dst.a) + dst.b * (1.0 - src.a);
    }
  }
  float a = src.a + dst.a * (1.0 - src.a);

  return vec4(rgb, a);
}
`,
  `
vec4 blend_hard_light(vec4 src) {
  vec4 dst = texture2D(u_dstTexture, v_texcoord);

  vec3 rgb = set_hardlight(dst, src);
  float a = src.a + dst.a * (1.0 - src.a);

  return vec4(rgb, a);
}
`,
  `
vec4 blend_difference(vec4 src) {
  vec4 dst = texture2D(u_dstTexture, v_texcoord);

  vec3 rgb = src.rgb + dst.rgb - 2.0 * min(src.rgb * dst.a, dst.rgb * src.a);
  float a = src.a + dst.a * (1.0 - src.a);

  return vec4(rgb, a);
}
`,

  `
vec4 blend_exclusion(vec4 src) {
  vec4 dst = texture2D(u_dstTexture, v_texcoord);

  vec3 rgb = dst.rgb + src.rgb - 2.0 * dst.rgb * src.rgb;
  float a = src.a + dst.a * (1.0 - src.a);

  return vec4(rgb, a);
}`,

  `
vec4 blend_hue(vec4 src) {
  vec4 dst = texture2D(u_dstTexture, v_texcoord);

  vec4 dstSrcAlpha = dst * src.a;
  vec3 rgb = set_luminance(set_saturation(src.rgb * dst.a, dstSrcAlpha.rgb), dstSrcAlpha.a, dstSrcAlpha.rgb);
  rgb += (1.0 - src.a) * dst.rgb + (1.0 - dst.a) * src.rgb;
  float a = src.a + dst.a * (1.0 - src.a);

  return vec4(rgb, a);
}`,

  `
vec4 blend_saturation(vec4 src) {
  vec4 dst = texture2D(u_dstTexture, v_texcoord);

  vec4 dstSrcAlpha = dst * src.a;
  vec3 rgb = set_luminance(set_saturation(dstSrcAlpha.rgb, src.rgb * dst.a), dstSrcAlpha.a, dstSrcAlpha.rgb);
  rgb += (1.0 - src.a) * dst.rgb + (1.0 - dst.a) * src.rgb;
  float a = src.a + dst.a * (1.0 - src.a);

  return vec4(rgb, a);
}`,

  `
vec4 blend_color(vec4 src) {
  vec4 dst = texture2D(u_dstTexture, v_texcoord);

  vec4 srcDstAlpha = src * dst.a;
  vec3 rgb = set_luminance(srcDstAlpha.rgb, srcDstAlpha.a, dst.rgb * src.a);;
  rgb += (1.0 - src.a) * dst.rgb + (1.0 - dst.a) * src.rgb;
  float a = src.a + dst.a * (1.0 - src.a);

  return vec4(rgb, a);
}`,

  `
vec4 blend_luminosity(vec4 src) {
  vec4 dst = texture2D(u_dstTexture, v_texcoord);

  vec4 srcDstAlpha = src * dst.a;
  vec3 rgb = set_luminance(dst.rgb * src.a, srcDstAlpha.a, srcDstAlpha.rgb);
  rgb += (1.0 - src.a) * dst.rgb + (1.0 - dst.a) * src.rgb;
  float a = src.a + dst.a * (1.0 - src.a);

  return vec4(rgb, a);
}`,
]

const getBlendGlsl = (blends?: number[]) => {
  let preFnsGlsl = preBlendGlsl

  let cvtGlsl = ''

  blends?.forEach(el => {
    const fnName = blendFnNames[el - 1]
    if (!fnName) return

    const fnGlsl = blendFnGlsls[el - 1]
    preFnsGlsl += fnGlsl

    if (!cvtGlsl) {
      cvtGlsl += `vec4 cvtBlend(vec4 src, int mode) {
`
    }
    cvtGlsl += `    if(mode == ${el}) return ${fnName}(src);
`
  })
  if (cvtGlsl) {
    cvtGlsl += `
    return src;
  }
    `
  }

  return cvtGlsl
    ? `${preFnsGlsl}
  ${cvtGlsl}
  `
    : ''
}

export const getFragment = (opts: {
  webgl2?: boolean
  blendEnums?: number[]
  brightnessContrast?: boolean
  hueSat?: boolean
}) => {
  const webgl2 = opts.webgl2
  const blendEnums = opts.blendEnums
  const hasBrightnessContrast = opts.brightnessContrast
  const hasHueSat = opts.hueSat

  const blendGlsls = getBlendGlsl(blendEnums)

  const prefixFragment =
    (webgl2
      ? [
          '#version 300 es',
          '#define varying in',
          'layout(location = 0) out mediump vec4 fragColor;',
          '#define gl_FragColor fragColor',
          '#define texture2D texture',
        ].join('\n') + '\n'
      : '') + header

  return `${prefixFragment}
  ${hasBrightnessContrast || hasHueSat ? preHsBcFnGlsl : ''}
  ${hasBrightnessContrast ? brightnessContrastGlsl : ''}
  ${hasHueSat ? hueSaturationGlsl : ''}
  ${maskFnGlsl}
  ${blendGlsls}
  
  void main(void) {
    vec4 outColor = texture2D(u_texture, v_texcoord);
    float alpha = u_opacity;
    if (u_isAlpha == 1) {
      if (u_grapMode == 1) {
        alpha = alpha * texture2D(u_dstTexture, v_texcoord + vec2(0.5, 0.0)).r;
      } else {
        outColor.a = outColor.a * texture2D(u_texture, v_texcoord + vec2(0.5, 0.0)).r;
      }
    }
    if (u_grapMode == 1) {
      alpha = step(0.2, alpha);
    }
    outColor = outColor * alpha;
    // 亮度和对比度
    ${hasBrightnessContrast ? 'outColor = brightness_contrast(outColor);' : ''}
    // 色相和饱和度
    ${hasHueSat ? 'outColor = hue_saturation(outColor);' : ''}
    // 遮罩
    outColor = cvtMask(outColor, u_maskMode);
    // 混合
    ${blendGlsls ? 'outColor = cvtBlend(outColor, u_blendMode);' : ''}
    
    gl_FragColor = outColor;
  }
  `
}
