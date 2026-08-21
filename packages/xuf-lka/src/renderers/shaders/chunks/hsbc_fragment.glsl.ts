export default /* glsl */ `
#if defined( USE_HSBC )

  gl_FragColor = brtcntRGB(gl_FragColor);
  gl_FragColor = hsvRGB(gl_FragColor);

#endif
`
