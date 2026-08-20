import {IOS16_PLUS, IPHONE} from '../../utils/ua'
import {getFrameStamp} from './utils'

const MIN_TOLERANCE = 30
const MAX_SYNC_DRIFT = 250
const SEEKED_TIMEOUT = 300
const IOS16_WARMUP_DELAY = 120
const IOS_INIT_TIMEOUT = 4000

// iOS 硬件解码器并发上限（约 4 路），所有 video 元素的 src 设置 + load 都串行化，避免 code=3
let initQueue = Promise.resolve()

export default class IPhoneVideoReader {
  constructor({
    uri,
    frameRate,
    frameTime,
    frames,
    name,
  }: {
    uri: string | Blob
    frameRate: number
    frameTime: number
    frames: number
    name?: string
  }) {
    this.uri = uri
    this.frameRate = frameRate
    this.frameTime = frameTime
    this.frames = frames
    this.name = name

    this.initProm = new Promise<void>(resolve => {
      this.initResolve = resolve
    })

    const initVideo = () => {
      const videoEl = (this.videoEl = document.createElement('video'))
      videoEl.addEventListener('canplay', this.onCanPlay, false)
      videoEl.addEventListener('ended', this.onEnded, false)
      videoEl.addEventListener('error', this.onError, false)
      videoEl.addEventListener('stalled', this.onStalled, false)
      videoEl.addEventListener('abort', this.onAbort, false)

      videoEl.muted = true
      videoEl.playsInline = true
      videoEl.setAttribute('playsinline', '')
      videoEl.setAttribute('webkit-playsinline', '')
      videoEl.setAttribute('muted', '')
      videoEl.setAttribute('autoplay', '')
      videoEl.preload = 'auto' // use load() will make a bug on Chrome.
      // blob URL 是同源资源，设置 crossOrigin 会让 iOS Safari 走 CORS 检查导致加载失败
      if (typeof uri === 'string') {
        videoEl.crossOrigin = 'anonymous'
      }
      videoEl.disablePictureInPicture = true

      if (IOS16_PLUS) {
        videoEl.style.cssText =
          'position:absolute;left:-1px;top:-1px;width:1px;height:1px;opacity:0;pointer-events:none;'
        document.body.appendChild(videoEl)
      }

      const setupSrc = () => {
        if (this.videoEl !== videoEl) return
        if (typeof uri !== 'string') {
          const srcURL = URL.createObjectURL(uri)
          this.cacheSrcURL = srcURL
          videoEl.src = srcURL
        } else {
          videoEl.src = uri
        }

        videoEl.load()
      }

      initQueue = initQueue.then(
        () =>
          new Promise<void>(resolve => {
            if (this.videoEl !== videoEl) {
              resolve()
              return
            }

            let done = false
            const finish = () => {
              if (done) return
              done = true
              clearTimeout(timer)
              videoEl.removeEventListener('loadeddata', onReady, false)
              videoEl.removeEventListener('canplay', onReady, false)
              videoEl.removeEventListener('error', onReady, false)
              resolve()
            }
            const onReady = () => finish()
            videoEl.addEventListener('loadeddata', onReady, false)
            videoEl.addEventListener('canplay', onReady, false)
            videoEl.addEventListener('error', onReady, false)
            const timer = setTimeout(finish, IOS_INIT_TIMEOUT)

            this.waitCanplayTimer = setTimeout(() => {
              this.onCanPlay()
            }, IOS_INIT_TIMEOUT)
            setupSrc()
          }),
      )
    }

    if (document.body) {
      initVideo()
    } else {
      window.addEventListener(
        'DOMContentLoaded',
        () => {
          initVideo()
        },
        {once: true},
      )
    }
  }

  readonly uri: string | Blob
  readonly frameRate: number
  readonly frameTime: number
  readonly frames: number
  readonly name?: string

  private cacheSrcURL: string | null = null
  private videoEl: HTMLVideoElement | null = null
  private canplay = false
  private waitCanplayTimer: any = null
  private seekedTimer: any = null
  private seekPollId: number | null = null
  private seekStartTime = 0
  private initProm: Promise<void>
  private initResolve: (() => void) | null = null
  private _seeking = false
  private _playing = false
  private pendingSeekFrame: number | null = null
  private lastPreparedFrame: number | null = null
  private forceSyncFrame: number | null = null
  private warmupProm: Promise<void> | null = null

  async init() {
    await this.initProm
    return this.warmupIOS16Video()
  }

  getVideoWidth() {
    return this.videoEl?.videoWidth || 0
  }

  getVideoHeight() {
    return this.videoEl?.videoHeight || 0
  }

  getCurrentTimestamp() {
    return this.videoEl ? this.videoEl.currentTime * 1000000 : undefined
  }

  prepare(targetFrame: number) {
    if (this.videoEl === null) return null

    const isLoopBackFrame = targetFrame === 0 && this.lastPreparedFrame !== null && this.lastPreparedFrame > targetFrame
    this.lastPreparedFrame = targetFrame

    if (targetFrame === 0 && (isLoopBackFrame || this.videoEl.currentTime * 1000 > this.getTolerance())) {
      this.forceSyncFrame = 0
      this.seek(0, true)
      if (!this.checkFrame(0)) return null
    }

    if (this.forceSyncFrame === targetFrame && !this.checkFrame(targetFrame)) return null

    return this.videoEl
  }

  prepareNext(nextFrame: number) {
    if (IPHONE) {
      this.seek(nextFrame)
      return
    }

    this.seekWhenDrift(nextFrame)
  }

  checkFrame(frameId: number) {
    if (this.videoEl === null) return true
    if (!this.canplay) return false

    const videoTime = getFrameStamp(frameId, this.frameTime)
    const currentTime = this.videoEl.currentTime * 1000
    const endTime = this.getEndTime()

    if (videoTime >= endTime) return true

    const drift = Math.abs(videoTime - currentTime)
    if (!this._seeking && drift <= this.getTolerance()) {
      if (this.forceSyncFrame === frameId) this.forceSyncFrame = null
      return true
    }
    if (this.forceSyncFrame === frameId) return false

    return this._playing && drift <= MAX_SYNC_DRIFT
  }

  pause() {
    this.pauseVideo()
  }

  destroy() {
    const cacheSrcURL = this.cacheSrcURL
    this.cacheSrcURL = null
    if (cacheSrcURL) URL.revokeObjectURL(cacheSrcURL)

    this.videoEl?.removeEventListener('canplay', this.onCanPlay, false)
    this.videoEl?.removeEventListener('ended', this.onEnded, false)
    this.videoEl?.removeEventListener('error', this.onError, false)
    this.videoEl?.removeEventListener('stalled', this.onStalled, false)
    this.videoEl?.removeEventListener('abort', this.onAbort, false)
    this.videoEl?.removeEventListener('seeking', this.onSeeking, false)
    this.videoEl?.removeEventListener('timeupdate', this.onTimeUpdate, false)
    this.pauseVideo()
    this.videoEl?.parentNode?.removeChild(this.videoEl)
    this.videoEl = null

    clearTimeout(this.waitCanplayTimer)
    this.waitCanplayTimer = null
    clearTimeout(this.seekedTimer)
    this.seekedTimer = null
    this.clearSeekPoll()
  }

  private seek(targetFrame: number, force = false) {
    if (this.videoEl === null) return

    if (this._seeking) {
      this.pendingSeekFrame = targetFrame
      return
    }

    const desiredTime = this.getDesiredTime(targetFrame)
    const currentTime = this.videoEl.currentTime * 1000

    if (!force && Math.abs(desiredTime - currentTime) <= this.getTolerance()) {
      return
    }

    this.pauseVideo()
    this.pendingSeekFrame = null
    this._seeking = true
    this.seekStartTime = Date.now()
    clearTimeout(this.seekedTimer)
    this.clearSeekPoll()
    this.videoEl.addEventListener('seeking', this.onSeeking, false)
    this.videoEl.addEventListener('timeupdate', this.onTimeUpdate, false)
    this.videoEl.currentTime = desiredTime * 0.001
    this.seekPollId = requestAnimationFrame(this.pollSeekDone)
    this.seekedTimer = setTimeout(this.onSeekDone, SEEKED_TIMEOUT)
  }

  private seekWhenDrift(targetFrame: number) {
    if (this.videoEl === null) return

    const desiredTime = this.getDesiredTime(targetFrame)
    const currentTime = this.videoEl.currentTime * 1000
    const drift = desiredTime - currentTime

    if (drift < -this.getTolerance() || drift > MAX_SYNC_DRIFT) {
      this.seek(targetFrame)
      return
    }

    this.playVideo()
  }

  private playVideo() {
    if (this.videoEl === null || this._playing) return

    this._playing = true
    this.videoEl.playbackRate = 1
    if (this.videoEl.paused) {
      this.videoEl.play().catch(() => {
        this._playing = false
      })
    }
  }

  private pauseVideo() {
    if (this.videoEl === null || !this._playing) return

    this.videoEl.playbackRate = 0
    this._playing = false
  }

  private warmupIOS16Video() {
    if (!IOS16_PLUS || this.videoEl === null) return Promise.resolve()
    if (this.warmupProm) return this.warmupProm

    const videoEl = this.videoEl
    this.warmupProm = Promise.resolve()
      .then(() => {
        if (videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          return undefined
        }

        return new Promise<void>(resolve => {
          videoEl.addEventListener('loadeddata', () => resolve(), {once: true})
        })
      })
      .then(() => videoEl.play().catch(() => undefined))
      .then(() => {
        videoEl.pause()
        videoEl.playbackRate = 0
        this._playing = false
        return new Promise<void>(resolve => setTimeout(resolve, IOS16_WARMUP_DELAY))
      })

    return this.warmupProm
  }

  private getDesiredTime(targetFrame: number) {
    return Math.min(getFrameStamp(targetFrame, this.frameTime), this.getEndTime())
  }

  private getEndTime() {
    const duration = (this.videoEl?.duration || 0) * 1000
    if (!Number.isFinite(duration) || duration <= 0) return (this.frames - 1) * this.frameTime

    return Math.min((this.frames - 1) * this.frameTime, duration - this.frameTime)
  }

  private getTolerance() {
    return Math.max(MIN_TOLERANCE, this.frameTime * 0.5)
  }

  private onCanPlay = () => {
    clearTimeout(this.waitCanplayTimer)
    this.waitCanplayTimer = null

    if (this.canplay) return
    this.canplay = true

    const resolve = this.initResolve
    this.initResolve = null
    resolve?.()
  }

  private onSeeking = () => {
    this._seeking = true
  }

  private onTimeUpdate = () => {
    if (this.videoEl && !this.videoEl.seeking) this.onSeekDone()
  }

  private pollSeekDone = () => {
    if (!this.videoEl || !this._seeking) return
    if (Date.now() > this.seekStartTime && !this.videoEl.seeking) {
      this.onSeekDone()
      return
    }

    this.seekPollId = requestAnimationFrame(this.pollSeekDone)
  }

  private onSeekDone = () => {
    clearTimeout(this.seekedTimer)
    this.seekedTimer = null
    this.clearSeekPoll()
    this.videoEl?.removeEventListener('seeking', this.onSeeking, false)
    this.videoEl?.removeEventListener('timeupdate', this.onTimeUpdate, false)
    this._seeking = false

    const pendingSeekFrame = this.pendingSeekFrame
    this.pendingSeekFrame = null
    if (pendingSeekFrame !== null) {
      this.seek(pendingSeekFrame, this.forceSyncFrame === pendingSeekFrame)
      return
    }

    if (this.videoEl) {
      const endTime = this.getEndTime()
      const currentTime = this.videoEl.currentTime * 1000

      if (currentTime >= endTime) {
        this.pauseVideo()
      }
    }
  }

  private clearSeekPoll() {
    if (this.seekPollId !== null) cancelAnimationFrame(this.seekPollId)
    this.seekPollId = null
  }

  private onEnded = () => {
    this._playing = false
  }

  private onError = () => {
    const err = this.videoEl?.error
    const src = this.videoEl?.currentSrc || this.videoEl?.src
    console.error('[IPhoneVideoReader] error', this.name, {
      code: err?.code,
      message: err?.message,
      networkState: this.videoEl?.networkState,
      readyState: this.videoEl?.readyState,
      src,
      uriType: typeof this.uri === 'string' ? 'url' : 'blob',
      blobType: typeof this.uri === 'string' ? undefined : this.uri.type,
      blobSize: typeof this.uri === 'string' ? undefined : this.uri.size,
      ua: navigator.userAgent,
    })
  }

  private onStalled = () => {
    console.warn('[IPhoneVideoReader] stalled', this.name, this.videoEl?.networkState, this.videoEl?.readyState)
  }

  private onAbort = () => {
    console.warn('[IPhoneVideoReader] abort', this.name, this.videoEl?.networkState, this.videoEl?.readyState)
  }
}
