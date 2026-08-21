import MP4Box from './mp4box.all.min'

// mp4box.all.min.js 为无类型的 vendor 模块，ISOFile 无类型声明，统一以 any 承接
type ISOFile = any

export interface DemuxerConfig {
  info: any
  codec: string
  codedWidth: number
  codedHeight: number
  description: any
  frames: number
  duration: number // 微秒
  metaData?: Uint8Array
}

export interface DemuxerOptions {
  onChunk?: MP4Demuxer['onChunk']
  onError?: MP4Demuxer['onError']
}

function readBlobAsArrayBuffer(blob: Blob) {
  if (blob.arrayBuffer) return blob.arrayBuffer()

  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

class MP4FileSink {
  constructor(file: ISOFile, onDone: () => void) {
    this.file = file
    this.onDone = onDone
  }

  private file: ISOFile
  private _offset = 0
  private chunks: ArrayBufferLike[] = []
  private onDone: () => void

  write(chunk: ArrayBufferLike) {
    this.chunks.push(chunk)

    const mp4BoxBuffer = new ArrayBuffer(chunk.byteLength) as ArrayBuffer & {fileStart: number}
    const view = new Uint8Array(mp4BoxBuffer)
    view.set(new Uint8Array(chunk))
    mp4BoxBuffer.fileStart = this._offset

    this._offset += chunk.byteLength

    // console.log('fetch', (this._offset / 1024 ** 2).toFixed(1) + ' MiB')

    this.file.appendBuffer(mp4BoxBuffer)
  }

  close() {
    // console.log('fetch', 'Done')
    this.file.flush()
    this.onDone?.()
  }
  // 耗时操作慎用，目前仅有音频的时候用到

  dispose() {
    this.onDone = null as any
  }
}

export class MP4Demuxer {
  constructor(url: string | Blob, opts?: DemuxerOptions) {
    this.url = url
    if (opts?.onChunk) this.onChunk = opts.onChunk
    if (opts?.onError) this.onError = opts.onError

    const file: ISOFile = (this.file = MP4Box.createFile())
    file.onReady = (info: ReturnType<ISOFile['getInfo']>) => {
      const videoTrack = info.videoTracks[0]
      const frames = videoTrack.nb_samples
      const duration = (1e6 * videoTrack.duration) / videoTrack.timescale
      const metaData = (this.file as any).moov?.udta?.meta?.data

      this.config = {
        info,
        // Browser doesn't support parsing full vp8 codec (eg: `vp08.00.41.08`),
        // they only support `vp8`.
        codec: videoTrack.codec.startsWith('vp08') ? 'vp8' : videoTrack.codec,
        codedHeight: videoTrack.track_height,
        codedWidth: videoTrack.track_width,
        description: this.description(videoTrack),
        frames: frames,
        duration: duration,
        metaData,
      }

      this.loadResolve?.(info)
      this.loadResolve = undefined
    }
    file.onSamples = this.onSamples
    file.onError = (error: any) => {
      this.onError?.(error)
    }

    this.loadProm = new Promise<any>(resolve => {
      this.loadResolve = resolve

      const fileSink = (this.fileSink = new MP4FileSink(file, () => {
        this.isDone = true
        this.onDoneCb?.()
      }))
      if (typeof url === 'string') {
        fetch(url)
          .then(response => {
            if (this.file === null) return
            if (response.body?.pipeTo && typeof WritableStream !== 'undefined') {
              const stream = new WritableStream(fileSink, {highWaterMark: 2})
              this.stream = stream
              response.body.pipeTo(stream as any)
              return
            }

            return response.arrayBuffer().then(buffer => {
              if (this.file === null) return
              fileSink.write(buffer)
              fileSink.close()
            })
          })
          .catch(err => {
            this.onError?.(err)
          })
      } else {
        if (url.stream && typeof WritableStream !== 'undefined') {
          const stream = new WritableStream(fileSink, {highWaterMark: 2})
          this.stream = stream
          url.stream().pipeTo(stream as any)
        } else {
          readBlobAsArrayBuffer(url)
            .then(buffer => {
              if (this.file === null) return
              fileSink.write(buffer)
              fileSink.close()
            })
            .catch(err => {
              this.onError?.(err)
            })
        }
      }
    }).catch(err => {
      console.warn(err)
    })
  }

  readonly url: string | Blob

  private loadProm: Promise<any>
  private loadResolve?: (value: any) => void

  file: ISOFile | null = null
  private fileSink: MP4FileSink | null = null
  private stream: WritableStream | null = null

  private config: DemuxerConfig | null = null

  chunkList: any[] = []
  isDone = false

  // 处理视频解封装后的编码帧
  onChunk: ((chunk: EncodedVideoChunk) => void) | null = null
  // 发生错误
  onError: ((error: any) => void) | null = null
  private onDoneCb: (() => void) | null = null

  async ensure() {
    await this.loadProm

    return this.config as DemuxerConfig
  }

  description(track: any) {
    if (this.file === null) return null

    const trak = this.file.getTrackById(track.id)
    for (const entry of trak.mdia.minf.stbl.stsd.entries) {
      const ventry = entry
      const box = ventry.avcC || ventry.hvcC || ventry.vpcC || ventry.av1C
      if (box) {
        const stream = new MP4Box.DataStream(new ArrayBuffer(0), 0, MP4Box.DataStream.BIG_ENDIAN)
        box.write(stream)

        return new Uint8Array(stream.buffer as ArrayBuffer, 8) // Remove the box header.
      }
    }
    console.error('MP4Demuxer', 'avcC, hvcC, vpcC, or av1C box not found')

    return null
  }

  async start() {
    if (this.file === null) return

    const started = this.file.sampleProcessingStarted
    if (started) {
      console.warn('MP4Demuxer', `sampleProcessingStarted: ${started}`)
      return
    }

    // Start Demux
    const track = this.file.getInfo().videoTracks[0]
    this.file.setExtractionOptions(track.id, 'video')
    this.file.start()
  }

  onDone(cb: () => void) {
    if (this.isDone) {
      cb()
      return
    }
    this.onDoneCb = cb
  }

  dispose() {
    this.onChunk = null
    this.onError = null
    this.onDoneCb = null

    this.stream?.close().catch(err => {})
    this.stream?.abort().catch(err => {})
    this.stream = null

    this.fileSink?.dispose()
    this.fileSink = null

    const file = this.file
    this.file = null
    if (file) {
      file.stop()
      file.onReady = null
      file.onError = null
      file.onSamples = null
    }
  }

  private onSamples = (track_id: number, ref: any, samples: any[]) => {
    for (const sample of samples) {
      const chunk = new EncodedVideoChunk({
        type: sample.is_sync ? 'key' : 'delta',
        timestamp: (1e6 * sample.cts) / sample.timescale,
        duration: (1e6 * sample.duration) / sample.timescale,
        data: sample.data,
      })
      this.chunkList.push(chunk)

      this.onChunk?.(chunk)
    }
  }
}
