/** 混合模式辅助函数（saturation / luminance / hardlight） */
export default /* glsl */ `
#ifdef USE_BLEND
uniform int blendMode;

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

vec4 blend_add(vec4 src) {
  vec4 dst = texture2D(dstTexture, v_texcoord);
  vec3 rgb = dst.rgb + src.rgb;
  float a = src.a + dst.a * (1.0 - src.a);
  return vec4(rgb, a);
}

vec4 blend_screen(vec4 src) {
  vec4 dst = texture2D(dstTexture, v_texcoord);
  vec3 rgb = 1.0 - (1.0 - dst.rgb) * (1.0 - src.rgb);
  float a = src.a + dst.a * (1.0 - src.a);
  return vec4(rgb, a);
}

vec4 blend_overlay(vec4 src) {
  vec4 dst = texture2D(dstTexture, v_texcoord);
  vec3 rgb = set_hardlight(src, dst);
  float a = src.a + dst.a * (1.0 - src.a);
  return vec4(rgb, a);
}

vec4 blend_soft_light(vec4 src) {
  vec4 dst = texture2D(dstTexture, v_texcoord);

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

vec4 blend_lighten(vec4 src) {
  vec4 dst = texture2D(dstTexture, v_texcoord);
  vec3 rgb = max((1.0 - src.a) * dst.rgb + src.rgb, (1.0 - dst.a) * src.rgb + dst.rgb);
  float a = src.a + dst.a * (1.0 - src.a);
  return vec4(rgb, a);
}

vec4 blend_darken(vec4 src) {
  vec4 dst = texture2D(dstTexture, v_texcoord);
  vec3 rgb = min((1.0 - src.a) * dst.rgb + src.rgb, (1.0 - dst.a) * src.rgb + dst.rgb);
  float a = src.a + dst.a * (1.0 - src.a);
  return vec4(rgb, a);
}

vec4 blend_multiply(vec4 src) {
  vec4 dst = texture2D(dstTexture, v_texcoord);
  vec3 rgb = (1.0 - src.a) * dst.rgb + (1.0 - dst.a) * src.rgb + src.rgb * dst.rgb;
  float a = src.a + dst.a * (1.0 - src.a);
  return vec4(rgb, a);
}

vec4 blend_color_burn(vec4 src) {
  vec4 dst = texture2D(dstTexture, v_texcoord);
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

vec4 blend_color_dodge(vec4 src) {
  vec4 dst = texture2D(dstTexture, v_texcoord);
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

vec4 blend_hard_light(vec4 src) {
  vec4 dst = texture2D(dstTexture, v_texcoord);
  vec3 rgb = set_hardlight(dst, src);
  float a = src.a + dst.a * (1.0 - src.a);
  return vec4(rgb, a);
}

vec4 blend_difference(vec4 src) {
  vec4 dst = texture2D(dstTexture, v_texcoord);
  vec3 rgb = src.rgb + dst.rgb - 2.0 * min(src.rgb * dst.a, dst.rgb * src.a);
  float a = src.a + dst.a * (1.0 - src.a);
  return vec4(rgb, a);
}

vec4 blend_exclusion(vec4 src) {
  vec4 dst = texture2D(dstTexture, v_texcoord);
  vec3 rgb = dst.rgb + src.rgb - 2.0 * dst.rgb * src.rgb;
  float a = src.a + dst.a * (1.0 - src.a);
  return vec4(rgb, a);
}

vec4 blend_hue(vec4 src) {
  vec4 dst = texture2D(dstTexture, v_texcoord);
  vec4 dstSrcAlpha = dst * src.a;
  vec3 rgb = set_luminance(set_saturation(src.rgb * dst.a, dstSrcAlpha.rgb), dstSrcAlpha.a, dstSrcAlpha.rgb);
  rgb += (1.0 - src.a) * dst.rgb + (1.0 - dst.a) * src.rgb;
  float a = src.a + dst.a * (1.0 - src.a);
  return vec4(rgb, a);
}

vec4 blend_saturation(vec4 src) {
  vec4 dst = texture2D(dstTexture, v_texcoord);
  vec4 dstSrcAlpha = dst * src.a;
  vec3 rgb = set_luminance(set_saturation(dstSrcAlpha.rgb, src.rgb * dst.a), dstSrcAlpha.a, dstSrcAlpha.rgb);
  rgb += (1.0 - src.a) * dst.rgb + (1.0 - dst.a) * src.rgb;
  float a = src.a + dst.a * (1.0 - src.a);
  return vec4(rgb, a);
}

vec4 blend_color(vec4 src) {
  vec4 dst = texture2D(dstTexture, v_texcoord);
  vec4 srcDstAlpha = src * dst.a;
  vec3 rgb = set_luminance(srcDstAlpha.rgb, srcDstAlpha.a, dst.rgb * src.a);
  rgb += (1.0 - src.a) * dst.rgb + (1.0 - dst.a) * src.rgb;
  float a = src.a + dst.a * (1.0 - src.a);
  return vec4(rgb, a);
}

vec4 blend_luminosity(vec4 src) {
  vec4 dst = texture2D(dstTexture, v_texcoord);
  vec4 srcDstAlpha = src * dst.a;
  vec3 rgb = set_luminance(dst.rgb * src.a, srcDstAlpha.a, srcDstAlpha.rgb);
  rgb += (1.0 - src.a) * dst.rgb + (1.0 - dst.a) * src.rgb;
  float a = src.a + dst.a * (1.0 - src.a);
  return vec4(rgb, a);
}

vec4 blendRGBA(vec4 src) {
  int mode = blendMode;

  if(mode == 1) return blend_add(src);
  if(mode == 2) return blend_screen(src);
  if(mode == 3) return blend_overlay(src);
  if(mode == 4) return blend_soft_light(src);
  if(mode == 5) return blend_lighten(src);
  if(mode == 6) return blend_darken(src);
  if(mode == 7) return blend_multiply(src);
  if(mode == 8) return blend_color_burn(src);
  if(mode == 9) return blend_color_dodge(src);
  if(mode == 10) return blend_hard_light(src);
  if(mode == 11) return blend_difference(src);
  if(mode == 12) return blend_exclusion(src);
  if(mode == 13) return blend_hue(src);
  if(mode == 14) return blend_saturation(src);
  if(mode == 15) return blend_color(src);
  if(mode == 16) return blend_luminosity(src);

  return src;
}
#endif
`
