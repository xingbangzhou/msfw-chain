// 帧id转单位时间戳
export const getFrameStamp = (frameId: number, frameTime: number) => {
  return (frameId + 1) * frameTime
}

/**
 * @brief 时间戳判断
 * @param lhs 微秒
 * @param rhs 微秒
 * @returns 1: 大于 -1：小于 0：等于
 */
export function compareStamp(lhs: number, rhs: number) {
  const diff = lhs - rhs
  if (diff > 999) return 1
  if (diff < -999) return -1
  return 0
}

export function TIMESTAMP({timestamp, duration}: {timestamp: number; duration: number}) {
  return timestamp - duration
}

export class VideoFrameArray {
  constructor() {}

  private data: any[] = []

  length() {
    return this.data.length
  }

  get(index: number) {
    return this.data[index]
  }

  push(frame: {timestamp: number; duration: number; close: () => void}) {
    this.data.push(frame)

    this.data = this.data.sort((a, b) => TIMESTAMP(a) - TIMESTAMP(b))
  }

  shift() {
    const videoFrame = this.data.shift()
    videoFrame?.close()

    return videoFrame
  }

  clear() {
    this.data.forEach(videoFrame => {
      videoFrame.close()
    })
    this.data = []
  }
}
