/** 片元着色器（通过 #include 引入各 chunk，通过 #ifdef 控制条件编译） */
export default /* glsl */ `
#include <common>

#include <hsbc_pars_fragment>
#include <mask_pars_fragment>
#include <blend_pars_fragment>

void main(void) {
  gl_FragColor = texture2D(srcTexture, v_texcoord);
  float alpha = opacity;
  if (isAlpha == 1) {
    if (grapMode == 1) {
      alpha = alpha * texture2D(dstTexture, v_texcoord + vec2(0.5, 0.0)).r;
    } else {
      gl_FragColor.a = gl_FragColor.a * texture2D(srcTexture, v_texcoord + vec2(0.5, 0.0)).r;
    }
  }
  if (grapMode == 1) {
    alpha = step(0.2, alpha);
  }
  gl_FragColor = gl_FragColor * alpha;

  #include <hsbc_fragment>
  #include <mask_fragment>
  #include <blend_fragment>
}
`
