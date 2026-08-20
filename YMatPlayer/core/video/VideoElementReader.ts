import {IS_ANDROID_LOW_VERSION, IS_CHROME_83} from '../../utils/ua'
import {getFrameStamp} from './utils'

const MIN_TOLERANCE = 80
const MAX_SYNC_DRIFT = 180
const SPEED_SYNC_DRIFT = 40
const MAX_PLAYBACK_RATE = 1.25
const MIN_PLAYBACK_RATE = 0.75
const SAFE_TAIL_FRAMES = 4

export default class VideoElementReader {
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

    if (document.body) {
      this.initVideo()
    } else {
      window.addEventListener(
        'DOMContentLoaded',
        () => {
          this.initVideo()
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
  private initProm: Promise<void>
  private initResolve: (() => void) | null = null
  private _seeking = false
  private pendingSeekFrame: number | null = null
  private _playing = false
  private lastPreparedFrame: number | null = null
  private loopResetting = false

  async init() {
    return this.initProm
  }

  private initVideo() {
    this.waitCanplayTimer = setTimeout(
      () => {
        this.onCanPlay()
      },
      IS_ANDROID_LOW_VERSION ? 3000 : 2000,
    )
    const videoEl = (this.videoEl = document.createElement('video'))
    if (IS_CHROME_83) {
      videoEl.setAttribute('playsInline', 'true')
      videoEl.setAttribute('muted', 'true')
      videoEl.srcObject = null
    }

    videoEl.addEventListener('canplay', this.onCanPlay, false)
    videoEl.addEventListener('seeked', this.onSeeked, false)
    videoEl.addEventListener('error', this.onError, false)

    videoEl.muted = true
    videoEl.playsInline = true
    videoEl.preload = IS_ANDROID_LOW_VERSION ? 'metadata' : 'auto'
    if (typeof this.uri === 'string') {
      videoEl.crossOrigin = 'anonymous'
    }

    if (IS_ANDROID_LOW_VERSION || IS_CHROME_83) {
      videoEl.style.cssText = 'position:absolute;left:-1px;top:-1px;width:1px;height:1px;opacity:0;pointer-events:none;'
      document.body.appendChild(videoEl)
    }

    if (typeof this.uri !== 'string') {
      const srcURL = URL.createObjectURL(this.uri)
      this.cacheSrcURL = srcURL
      videoEl.src = srcURL
    } else {
      videoEl.src = this.uri
    }
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

    if (isLoopBackFrame || (targetFrame === 0 && this.videoEl.currentTime * 1000 > this.getTolerance())) {
      this.loopResetting = true
      if (IS_CHROME_83) {
        this.rebuildVideo()
      } else {
        this.seek(0, true)
      }
      return null
    }

    if (this.loopResetting) {
      if (!this.checkFrame(0)) return null
      this.loopResetting = false
    }

    return this.videoEl
  }

  prepareNext(nextFrame: number) {
    this.syncToFrame(nextFrame)
  }

  // 跟随视频自身时间线：自然播放，不做逐帧seek/变速纠偏
  play() {
    if (this.videoEl === null) return

    this.videoEl.playbackRate = 1
    if (this._playing && !this.videoEl.paused) return

    this._playing = true
    this.videoEl.play().catch(() => {
      this._playing = false
    })
  }

  checkFrame(frameId: number) {
    if (this.videoEl === null) return true
    if (!this.canplay) return false

    const videoTime = getFrameStamp(frameId, this.frameTime)
    const currentTime = this.videoEl.currentTime * 1000
    const endTime = this.getEndTime()

    if (videoTime >= endTime) return true

    return Math.abs(videoTime - currentTime) <= MAX_SYNC_DRIFT
  }

  destroy() {
    const cacheSrcURL = this.cacheSrcURL
    this.cacheSrcURL = null
    if (cacheSrcURL) URL.revokeObjectURL(cacheSrcURL)

    this.videoEl?.removeEventListener('canplay', this.onCanPlay, false)
    this.videoEl?.removeEventListener('seeked', this.onSeeked, false)
    this.videoEl?.removeEventListener('error', this.onError, false)
    this.pauseVideo()
    this.videoEl?.parentNode?.removeChild(this.videoEl)
    this.videoEl = null

    clearTimeout(this.waitCanplayTimer)
    this.waitCanplayTimer = null
  }

  private rebuildVideo() {
    const oldVideoEl = this.videoEl
    if (oldVideoEl) {
      oldVideoEl.removeEventListener('canplay', this.onCanPlay, false)
      oldVideoEl.removeEventListener('seeked', this.onSeeked, false)
      oldVideoEl.removeEventListener('error', this.onError, false)
      oldVideoEl.pause()
      oldVideoEl.removeAttribute('src')
      oldVideoEl.load()
      oldVideoEl.parentNode?.removeChild(oldVideoEl)
    }

    const cacheSrcURL = this.cacheSrcURL
    this.cacheSrcURL = null
    if (cacheSrcURL) URL.revokeObjectURL(cacheSrcURL)

    this.videoEl = null
    this.canplay = false
    this._seeking = false
    this._playing = false
    this.pendingSeekFrame = null
    clearTimeout(this.waitCanplayTimer)
    this.waitCanplayTimer = null

    this.initProm = new Promise<void>(resolve => {
      this.initResolve = () => {
        this.loopResetting = false
        resolve()
      }
    })
    this.initVideo()
  }

  private syncToFrame(targetFrame: number) {
    if (this.videoEl === null) return

    const desiredTime = this.getDesiredTime(targetFrame)
    const currentTime = this.videoEl.currentTime * 1000
    const drift = desiredTime - currentTime

    if (drift < -this.getTolerance() || drift > MAX_SYNC_DRIFT) {
      this.seek(targetFrame)
      return
    }

    this.playVideo(drift)
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
    this.videoEl.currentTime = desiredTime * 0.001
  }

  private playVideo(drift: number) {
    if (this.videoEl === null) return

    if (Math.abs(drift) > SPEED_SYNC_DRIFT) {
      const rate = 1 + drift / MAX_SYNC_DRIFT
      this.videoEl.playbackRate = Math.min(MAX_PLAYBACK_RATE, Math.max(MIN_PLAYBACK_RATE, rate))
    } else {
      this.videoEl.playbackRate = 1
    }

    if (this._playing && !this.videoEl.paused) return

    this._playing = true
    this.videoEl.play().catch(() => {
      this._playing = false
    })
  }

  private pauseVideo() {
    if (this.videoEl === null || !this._playing) return

    this.videoEl.pause()
    this.videoEl.playbackRate = 1
    this._playing = false
  }

  private getDesiredTime(targetFrame: number) {
    return Math.min(getFrameStamp(targetFrame, this.frameTime), this.getEndTime())
  }

  private getEndTime() {
    const frameEndTime = Math.max(0, this.frames - 1 - SAFE_TAIL_FRAMES) * this.frameTime
    const duration = (this.videoEl?.duration || 0) * 1000
    if (!Number.isFinite(duration) || duration <= 0) return frameEndTime

    return Math.min(frameEndTime, Math.max(0, duration - this.frameTime * (SAFE_TAIL_FRAMES + 1)))
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

  private onSeeked = () => {
    this._seeking = false

    const pendingSeekFrame = this.pendingSeekFrame
    this.pendingSeekFrame = null
    if (pendingSeekFrame !== null) {
      this.seek(pendingSeekFrame, this.loopResetting && pendingSeekFrame === 0)
      return
    }

    this.videoEl && (this.videoEl.playbackRate = 1)

    if (this.videoEl) {
      const endTime = this.getEndTime()
      const currentTime = this.videoEl.currentTime * 1000

      if (currentTime >= endTime) {
        this.pauseVideo()
      }
    }
  }

  private onError = () => {
    const err = this.videoEl?.error
    const src = this.videoEl?.currentSrc || this.videoEl?.src
    console.error('[VideoElementReader] error', this.name, {
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
}
