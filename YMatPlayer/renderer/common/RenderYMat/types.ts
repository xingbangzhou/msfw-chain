export interface HueStaturation {
  colorize: number // 1: 无彩色化 2： 彩色化
  hue?: number
  saturation?: number
  lightness?: number
}

export enum EndMode {
  Normal = 0, // 按inframe、outframe渲染
  Frozen, // 冻结在某一帧
  Loop, // 从头开始重复
  Continuous, // 按关键帧重复，持续播放
}
