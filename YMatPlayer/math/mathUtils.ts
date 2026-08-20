function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

function BRIGHTNESS(value: number) {
  return value > 0 ? value / 250.0 : value / 650.0
}

function CONTRAST(value: number) {
  return 1.0 + value / 300.0
}

// color：0~1， opacity: 0~100 默认100
function rgba(color: number[], opacity?: number) {
  opacity = opacity ?? 100
  color[0] = color[0] || 0
  color[1] = color[1] || 0
  color[2] = color[2] || 0
  color[3] = color[3] ?? 1
  return `rgba(${color[0] * 255}, ${color[1] * 255}, ${color[2] * 255}, ${color[3] * opacity * 0.01})`
}

export interface FillCoord {
  lx: number
  ly: number
  rx: number
  ry: number
  sw: number
  sh: number
}

function getFillCoord(
  srcw: number,
  srch: number,
  dstw: number,
  dsth: number,
  fillMode?: number,
  isAlpha?: boolean,
): FillCoord {
  let lx = 0
  let ly = 0
  let rx = 1.0
  let ry = 1.0
  let sw = 1.0
  let sh = 1.0

  if (fillMode === 1) {
    const srcWhr = srcw / srch
    const dstWhr = dstw / dsth
    const isLead = dstWhr < srcWhr
    const tw = isLead ? dsth * srcWhr : dstw
    const th = isLead ? dsth : dstw / srcWhr
    lx = (dstw - tw) * 0.5
    ly = (dsth - th) * 0.5
    lx = -lx / srcw
    ly = -ly / th
    rx = rx - lx
    ry = ry - ly
  } else if (fillMode === 2) {
    // 默认拉伸
  } else {
    const srcWhr = srcw / srch
    const dstWhr = dstw / dsth
    const isLead = dstWhr < srcWhr
    const tw = isLead ? dstw : dsth * srcWhr
    const th = isLead ? dstw / srcWhr : dsth
    sw = tw / dstw
    sh = th / dsth
  }
  if (isAlpha) {
    lx *= 0.5
    rx *= 0.5
  }

  return {lx, ly, rx, ry, sw, sh}
}

const ID2RGB = (id: number): [number, number, number] => {
  return [(id >> 0) & 0xff, (id >> 8) & 0xff, (id >> 16) & 0xff]
}

const RGB2ID = (data: [number, number, number]) => {
  return data[0] + (data[1] << 8) + (data[2] << 16)
}

export {clamp, DEG2RAD, RAD2DEG, BRIGHTNESS, CONTRAST, rgba, getFillCoord, ID2RGB, RGB2ID}
