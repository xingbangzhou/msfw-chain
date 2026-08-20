import {isInstanceOf} from '../../../utils/shims'
import {DemuxHandles, demuxHelper, MP4Demuxer, MP4Config} from '../demuxer'
import {TIMESTAMP, VideoFrameArray, compareStamp, getFrameStamp} from '../utils'

export enum DecoderStatus {
  None = 0,
  Ready = 1,
  Error = 2,
}

export default class MP4Decoder {
  constructor(src: string | Blob | MP4Demuxer, frameTime: number, frames: number) {
    this.frameTimeUs = frameTime * 1000
    this.endTimeUs = frames * this.frameTimeUs
    this.seekTimeUs = 0

    this.frameArray = new VideoFrameArray()
    this.decoder = new (self as any).VideoDecoder({
      output: this.onDecodedFrame,
      error: this.onError,
    })

    let demuxer: MP4Demuxer
    if (isInstanceOf(src, MP4Demuxer)) {
      demuxer = this.demuxer = src as MP4Demuxer
      demuxer.onChunk = this.onChunk
      demuxer.onError = this.onError
      demuxer.ensure().then(config => {
        this.onConfig(config)
        demuxer.start()
      })
    } else {
      this.url = src as string | Blob
      this.demuxHandles = {
        onConfig: this.onConfig,
        onChunk: this.onChunk,
        onError: this.onError,
      }
      demuxHelper.demux(this.url, this.demuxHandles)
    }
  }

  readonly url: string | Blob | null = null
  protected frameTimeUs: number // 单位: 微秒
  protected endTimeUs: number // 单位: 微秒
  protected seekTimeUs: number // 单位: 微秒

  protected decoder: any | null = null
  protected demuxer: MP4Demuxer | null = null
  protected demuxHandles: DemuxHandles | null = null
  protected frameArray: VideoFrameArray
  protected status = DecoderStatus.None
  protected finished = false
  protected config: any | null = null
  protected chunksList?: any[][]

  currentStamp() {
    const videoFrame = this.frameArray.get(0)
    if (!videoFrame) return 0

    return TIMESTAMP(videoFrame)
  }

  seek(targetFrame: number) {
    const targetTimeUs = getFrameStamp(targetFrame, this.frameTimeUs)
    if (targetTimeUs < this.seekTimeUs) {
      this.reset(targetTimeUs)
    }
    this.seekTimeUs = targetTimeUs

    const l = this.frameArray.length()
    let rail = l - 1
    while (rail >= 1) {
      // 取第0个
      const videoFrame = this.frameArray.get(0) as any
      // 向后取最近一帧
      if (compareStamp(TIMESTAMP(videoFrame), targetTimeUs) === 1) break
      // 去掉第0个，内部会close
      this.frameArray.shift()
      rail -= 1
    }

    // 取第0个
    return this.frameArray.get(0)
  }

  // 下一帧需要的帧,微秒
  next(nextFrame: number) {
    const timeUs = (this.seekTimeUs = getFrameStamp(nextFrame, this.frameTimeUs))

    if (this.finished && this.frameArray.length() === 1) return

    const videoframe = this.frameArray.get(0)
    if (videoframe && compareStamp(TIMESTAMP(videoframe), timeUs) < 0) {
      this.frameArray.shift()
    }
  }

  reset(startTimeUs = 0) {
    if (this.decoder === null) return

    try {
      this.decoder.reset()
    } catch (err) {
      console.warn('VideoDecoder.reset, eroor: ', err)
    }

    this.seekTimeUs = 0
    this.status = DecoderStatus.None
    this.finished = false
    // 清楚之前的帧
    this.frameArray.clear()
    if (!this.config || !this.chunksList) return
    this.decoder.configure(this.config)

    const chunksList = this.chunksList
    for (let i = 0, l = chunksList.length; i < l; i++) {
      if (i < l - 1) {
        const timestamp = chunksList[i + 1][0].timestamp
        if (timestamp < startTimeUs) continue
      }
      // 超出EndTime的关键帧列表不需要解码
      const chunks = chunksList[i]
      const timestamp = TIMESTAMP(chunks[0])
      if (this.endTimeUs && compareStamp(timestamp, this.endTimeUs) === 1) break
      for (const el of chunks) {
        this.decoder.decode(el)
      }
    }
  }

  destroy() {
    if (this.demuxHandles) {
      demuxHelper.remove(this.url as string | Blob, this.demuxHandles)
      this.demuxHandles = null
    }
    this.demuxer?.destroy()
    this.demuxer = null

    this.frameArray.clear()
    this.config = null
    this.chunksList = undefined
    this.seekTimeUs = 0
    this.status = DecoderStatus.None
    this.finished = false

    try {
      this.decoder?.close()
    } catch (err) {
      console.warn('VideoDecoder.close, eroor: ', err)
    }
    this.decoder = null
  }

  private onDecodedFrame = (videoFrame: any) => {
    if (this.decoder === null) {
      videoFrame.close()
      return
    }
    this.status = DecoderStatus.Ready
    this.finished = this.decoder.decodeQueueSize === 0

    // 如果比当前找的帧要小就丢弃
    if (!this.finished) {
      const timestamp = TIMESTAMP(videoFrame)
      if (compareStamp(timestamp, this.seekTimeUs) < 0) {
        videoFrame.close()
        return
      }
    }
    this.frameArray.push(videoFrame)
  }

  private onConfig = (config: MP4Config) => {
    if (this.decoder === null) return

    this.config = {
      codec: config.codec,
      codedWidth: config.codedWidth,
      codedHeight: config.codedHeight,
      description: config.description,
      optimizeforlatency: true,
    }
    try {
      this.decoder.configure(this.config)
      console.log(`MP4Decoder configure: `, this.config, this.decoder.state, this.url)
    } catch (err) {
      console.warn('MP4Decoder configure, error: ', err)
    }
  }

  private onChunk = (chunk: any) => {
    if (this.decoder === null) return

    this.chunksList = this.chunksList || []

    let chunks: any[] | undefined = undefined
    if (chunk.type === 'key') {
      // 关键帧
      chunks = [chunk]
      this.chunksList.push(chunks)
    } else {
      // 延迟帧
      chunks = this.chunksList[this.chunksList.length - 1]
      if (chunks) {
        chunks.push(chunk)
      }
    }
    const key = chunks?.[0]
    if (key) {
      const timestamp = TIMESTAMP(key)
      // 超出EndTime部分不需要解码
      if (!this.endTimeUs || compareStamp(timestamp, this.endTimeUs) <= 0) {
        try {
          this.decoder.decode(chunk)
        } catch (err) {
          // console.warn('MP4Decoder decode, error: ', err, timestamp, this.url)
        }
      }
    }
  }

  private onError = (error: any) => {
    console.error(error)

    this.status = DecoderStatus.Error
  }
}
