export default /* glsl */ `
#if defined( USE_BLEND )

  gl_FragColor = blendRGBA(gl_FragColor);

#endif
`
