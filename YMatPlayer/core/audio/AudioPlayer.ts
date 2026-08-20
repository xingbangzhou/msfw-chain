export default class AudioPlayer {
  constructor() {
    this.context = new window.AudioContext()
    this.gain = this.context.createGain()
    this.gain.connect(this.context.destination)

    this.source = null
    this.buffer = null

    this.isPlaying = false
  }

  context: AudioContext
  gain: GainNode
  source: AudioBufferSourceNode | null
  buffer: AudioBuffer | null
  isPlaying: boolean

  private _startedAt = 0
  private _progress = 0

  async load(data: ArrayBuffer) {
    try {
      const audioCtx = this.context
      this.buffer = await audioCtx.decodeAudioData(data)

      return !!this.buffer
    } catch (err) {
      console.error(`Unable to fetch the audio file. Error: `, err)
    }

    return false
  }

  play() {
    if (this.isPlaying) {
      console.warn('YMAT.Audio: Audio is already playing.')
      return
    }
    if (!this.buffer) {
      console.warn('YMAT.Audio: Audio no buffer.')
      return
    }

    const audioCtx = this.context
    const source = audioCtx.createBufferSource()
    if (!source) {
      console.warn('YMAT.Audio: createBufferSource is null.')
      return
    }
    navigator.mediaDevices?.getUserMedia({audio: true})
    source.connect(this.gain)
    source.buffer = this.buffer
    source.loop = false
    source.onended = this.onEnded
    source.start(this._startedAt, this._progress)
    this.setVolume(0.3)

    this.source = source
    this.isPlaying = true
  }

  // 0 ~ 1
  setVolume(value: number) {
    this.gain.gain.setTargetAtTime(value, this.context.currentTime, 0.01)
  }

  stop() {
    this._progress = 0

    if (this.source !== null) {
      this.source.stop()
      this.source.onended = null
    }

    this.isPlaying = false

    return this
  }

  destory() {
    this.stop()
    this.context.close()

    this.buffer = null
    this.source = null
  }

  private onEnded = () => {
    this.isPlaying = false
  }
}
