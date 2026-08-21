/** 顶点着色器 */
export default /* glsl */ `
attribute vec4 a_position;
attribute vec2 a_texcoord;

uniform mat4 matrix;

varying vec2 v_texcoord;

void main() {
  gl_Position = matrix * a_position;
  v_texcoord = a_texcoord;
}
`
