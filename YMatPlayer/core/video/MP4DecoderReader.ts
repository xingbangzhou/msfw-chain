import {MP4Decoder, DecoderStatus} from './decoder'
import {MP4Demuxer} from './demuxer'
import {compareStamp} from './utils'

export default class MP4DecoderReader extends MP4Decoder {
  constructor(url: string | Blob, frameTime: number, frames: number, demuxer?: MP4Demuxer) {
    super(demuxer || url, frameTime, frames)
  }

  init() {}

  getVideoWidth() {
    return this.config?.codedWidth || 0
  }

  getVideoHeight() {
    return this.config?.codedHeight || 0
  }

  getCurrentTimestamp() {
    return this.currentStamp()
  }

  prepare(targetFrame: number) {
    return this.seek(targetFrame)
  }

  prepareNext(nextFrame: number) {
    this.next(nextFrame)
  }

  checkFrame(frame: number) {
    if (this.finished || this.status === DecoderStatus.Error) return true
    if (this.status !== DecoderStatus.Ready) return false

    const frameStamp = frame * this.frameTimeUs
    const videoStamp = this.currentStamp()

    return compareStamp(videoStamp, frameStamp) >= 0
  }
}
