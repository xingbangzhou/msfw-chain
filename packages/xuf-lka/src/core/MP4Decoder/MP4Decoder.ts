import {MP4Demuxer} from './MP4Demuxer'

/**
 * @brief 时间戳判断
 * @param lhs 微秒
 * @param rhs 微秒
 * @returns 1: 大于 -1：小于 0：等于
 */
function compareStamp(lhs: number, rhs: number) {
  const diff = lhs - rhs
  if (diff > 999) return 1
  if (diff < -999) return -1
  return 0
}

function TIMESTAMP({timestamp, duration}: {timestamp: number; duration?: number | null}) {
  return timestamp - (duration ?? 0)
}

export class MP4Decoder {
  constructor(url: string | Blob) {
    this.url = url

    // 原生解码器
    this.decoder = new VideoDecoder({
      output: this.onOutput,
      error: this.onError,
    })
    // 视频解封装器
    const demuxer = (this.demuxer = new MP4Demuxer(url, {
      onChunk: this.onChunk,
      onError: this.onError,
    }))

    demuxer
      .ensure()
      .then(demuxer_config => {
        if (!this.decoder) return

        const config: VideoDecoderConfig = {
          codec: demuxer_config.codec,
          codedWidth: demuxer_config.codedWidth,
          codedHeight: demuxer_config.codedHeight,
          description: demuxer_config.description,
          optimizeForLatency: true,
        }

        try {
          this.decoder.configure(config)
        } catch (err) {}
        this.config = config

        // 开始解封装
        demuxer.start()
      })
      .catch(err => {
        this.onError(err)
      })
  }

  readonly url: string | Blob
  private demuxer: MP4Demuxer | null = null
  private decoder: VideoDecoder | null = null
  private config: VideoDecoderConfig | null = null
  private chunksList: EncodedVideoChunk[][] = []
  private videoFrameList: VideoFrame[] = []
  private seekTimeUs = 0 // 微秒

  /**
   * 定位到指定时间点
   * @param ms 毫秒
   * @returns 当前列表首帧
   */
  seek(ms: number): VideoFrame | null {
    const timeUs = Math.max(0, ms * 1000)

    const frame0 = this.videoFrameList[0]
    if (frame0 !== undefined && compareStamp(TIMESTAMP(frame0), timeUs) === 1) {
      this.reset(timeUs)
    }

    this.seekTimeUs = timeUs
    this.dropExpiredFrames(timeUs)

    return this.videoFrameList[0] ?? null
  }

  dispose() {
    this.demuxer?.dispose()
    this.demuxer = null

    this.closeFrames()
    this.chunksList = []
    this.config = null
    this.seekTimeUs = 0

    try {
      this.decoder?.close()
    } catch (err) {
      console.warn('[LKA]MP4Decoder close error:', err)
    }
    this.decoder = null
  }

  reset(us = 0): void {
    const decoder = this.decoder
    if (decoder === null) return

    try {
      decoder.reset()
    } catch (err) {
      console.warn('[LKA]MP4Decoder reset error:', err)
    }

    this.closeFrames()
    this.seekTimeUs = us

    if (this.config === null) return

    try {
      decoder.configure(this.config)
    } catch (err) {
      this.onError(err)
      return
    }

    for (let index = 0; index < this.chunksList.length; index++) {
      const chunks = this.chunksList[index]
      const nextGroup = this.chunksList[index + 1]
      if (nextGroup !== undefined && TIMESTAMP(nextGroup[0]) < us) continue

      for (const chunk of chunks) {
        this.decodeChunk(chunk)
      }
    }
  }

  private onOutput = (frame: VideoFrame) => {
    if (this.decoder === null) {
      frame.close()
      return
    }

    if (this.decoder.decodeQueueSize !== 0 && compareStamp(TIMESTAMP(frame), this.seekTimeUs) < 0) {
      frame.close()
      return
    }

    this.videoFrameList.push(frame)
    this.videoFrameList = this.videoFrameList.sort((a, b) => TIMESTAMP(a) - TIMESTAMP(b))
  }

  private onChunk = (chunk: EncodedVideoChunk) => {
    const chunks = this.pushChunk(chunk)
    if (chunks === null) return

    this.decodeChunk(chunk)
  }

  private pushChunk(chunk: EncodedVideoChunk): EncodedVideoChunk[] | null {
    let chunks: EncodedVideoChunk[] | undefined

    if (chunk.type === 'key') {
      chunks = [chunk]
      this.chunksList.push(chunks)
    } else {
      chunks = this.chunksList[this.chunksList.length - 1]
      chunks?.push(chunk)
    }

    return chunks ?? null
  }

  private decodeChunk(chunk: EncodedVideoChunk): void {
    const decoder = this.decoder
    if (decoder === null || decoder.state !== 'configured') return

    try {
      decoder.decode(chunk)
    } catch (err) {
      this.onError(err)
    }
  }

  private dropExpiredFrames(time: number): void {
    while (this.videoFrameList.length > 1) {
      const frame = this.videoFrameList[0]
      if (compareStamp(TIMESTAMP(frame), time) === 1) break

      this.videoFrameList.shift()?.close()
    }
  }

  private closeFrames(): void {
    for (const frame of this.videoFrameList) {
      frame.close()
    }

    this.videoFrameList = []
  }

  private onError = (error: any) => {
    console.error('[LKA]MP4Decoder error:', error)
  }
}
