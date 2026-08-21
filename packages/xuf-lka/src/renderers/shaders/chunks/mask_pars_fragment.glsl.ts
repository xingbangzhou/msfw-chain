/** 遮罩模式函数（alpha / luma / inverted 变体 + cvtMask 分发） */
export default /* glsl */ `
// 遮罩模式
uniform int maskMode;

vec4 mask_alpha(vec4 src) {
  vec4 dst = texture2D(dstTexture, v_texcoord);

  float alpha = dst.a;
  if (grapMode == 1) {
    alpha = step(0.2, alpha);
  }

  return src * alpha;
}

vec4 mask_alpha_inverted(vec4 src) {
  vec4 dst = texture2D(dstTexture, v_texcoord);

  float alpha = (1.0 - dst.a);
  if (grapMode == 1) {
    alpha = step(0.2, alpha);
  }

  return src;
}

float LUMA(vec3 RGB) {
  return clamp(dot(vec3(0.21260000000000001, 0.71519999999999995, 0.0722), RGB), 0.0, 1.0);
}

vec4 mask_luma(vec4 src) {
  vec4 dst = texture2D(dstTexture, v_texcoord);

  float luma = LUMA(dst.rgb);
  if (grapMode == 1) {
    luma = step(0.2, luma);
  }

  return src * luma;
}

vec4 mask_luma_inverted(vec4 src) {
  vec4 dst = texture2D(dstTexture, v_texcoord);

  float luma = (1.0 - LUMA(dst.rgb));
  if (grapMode == 1) {
    luma = step(0.2, luma);
  }

  return src * luma;
}

vec4 maskRGBA(vec4 src) {
  int mode = maskMode;

  if (mode == 1) return mask_alpha(src);
  if (mode == 2) return mask_alpha_inverted(src);
  if (mode == 3) return mask_luma(src);
  if (mode == 4) return mask_luma_inverted(src);

  return src;
}
`
