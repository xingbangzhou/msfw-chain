import {IPHONE} from '../../utils/ua'
import {MP4Demuxer} from './demuxer'
import IPhoneVideoReader from './IPhoneVideoReader'
import MP4DecoderReader from './MP4DecoderReader'
import VideoElementReader from './VideoElementReader'

export interface VideoReaderParameters {
  uri: string | Blob
  frames: number
  frameRate: number
  frameTime: number
  disableDecoder?: boolean
  demuxer?: MP4Demuxer
  name?: string
}

export default class VideoReader {
  constructor({uri, frames, frameRate, frameTime, disableDecoder, demuxer, name}: VideoReaderParameters) {
    if (disableDecoder) {
      this.reader = IPHONE
        ? new IPhoneVideoReader({uri, frameRate, frameTime, frames, name})
        : new VideoElementReader({uri, frameRate, frameTime, frames, name})
    } else {
      this.reader = new MP4DecoderReader(uri, frameTime, frames, demuxer)
    }
  }

  private reader: IPhoneVideoReader | VideoElementReader | MP4DecoderReader

  async init() {
    await this.reader.init()
  }

  // 是否为videoElement自身时间线播放（自然播放，frameId跟随currentTime）
  isNativeTimeline() {
    return this.reader instanceof VideoElementReader
  }

  play() {
    if (this.reader instanceof VideoElementReader) {
      this.reader.play()
    }
  }

  getVideoWidth() {
    return this.reader.getVideoWidth()
  }

  getVideoHeight() {
    return this.reader.getVideoHeight()
  }

  getCurrentTimestamp() {
    return this.reader.getCurrentTimestamp()
  }

  prepare(targetFrame: number) {
    return this.reader.prepare(targetFrame)
  }

  prepareNext(nextFrame: number) {
    this.reader.prepareNext(nextFrame)
  }

  checkFrame(frame: number) {
    return this.reader.checkFrame(frame)
  }

  destroy() {
    this.reader.destroy()
  }
}
