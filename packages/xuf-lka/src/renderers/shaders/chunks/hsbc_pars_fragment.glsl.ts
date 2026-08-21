/** 亮度和对比度 / HSV / RGB 互转工具函数 */
export default /* glsl */ `
#ifdef USE_HSBC
uniform int colorize;
uniform vec3 hsl;               // x=hue, y=saturation, z=lightness 
uniform vec2 brtCnt;           // x=brightness, y=contrast

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

vec4 hsvRGB(vec4 src) {
  if (colorize == 0) {
    return src;
  }

  vec3 rgbColor = src.rgb;
  vec3 hsvColor = RGB2HSV(rgbColor);
  if (colorize == 1) {
      hsvColor.x = fract(hsvColor.x + hsl.x);
      hsvColor.y *= (hsl.y + 1.0);
      rgbColor = HSV2RGB(hsvColor);
      rgbColor += hsl.z;
    } else {
      hsvColor.x = fract(hsl.x);
      hsvColor.y = hsl.y;
      rgbColor = HSV2RGB(hsvColor);
      rgbColor += hsl.z;
    }

  return vec4(rgbColor * src.a, src.a);
}

vec4 brtcntRGB(vec4 src) {
  vec3 rgb = src.rgb * brtCnt.y + 0.5 - brtCnt.y * 0.5;
  if (brtCnt.x == 0.0) {
    return src;
  }

  vec3 hsv = RGB2HSV(rgb);
  hsv.z *= (brtCnt.x + 1.0);
  rgb = HSV2RGB(hsv);
  rgb += (brtCnt.x / 2.0);

  return vec4(rgb * src.a, src.a);
}

#endif
`
