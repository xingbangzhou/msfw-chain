/** 片元着色器公共 uniform 声明 */
export default /* glsl */ `
precision mediump float;
varying vec2 v_texcoord;

// 纹理采样（GLSL300 下 texture 为内建函数名，主纹理改名 srcTexture 避免冲突）
uniform sampler2D srcTexture;
uniform sampler2D dstTexture;

// 全局透明度
uniform float opacity;

// 视频等预乘 alpha 标记（左右分屏取 alpha 通道）
uniform int isAlpha;

// 抓取模式（点击拾取时以纯色 ID 渲染）
uniform int grapMode;
`
