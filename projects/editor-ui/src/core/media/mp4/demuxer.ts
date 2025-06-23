import MP4Box, {ISOFile} from './mp4box.all.min'

class MP4Demuxer {
  constructor() {
    const file: ISOFile = (this.file = MP4Box.createFile())
    file.onReady = (info: any) => {
      console.log(info)
      this.info = info
      this._info_resolve?.(info)
    }
    file.onError = () => {}
  }

  file: ISOFile
  info: any
  private _info_resolve?: (info: any) => void

  async loadUrl(url: string) {
    return new Promise<any>(async (resolve, reject) => {
      this._info_resolve = resolve
      try {
        const response = await fetch(url)
        const reader = response.body!.getReader()

        let offset = 0
        let done, value
        while (!done) {
          ;({done, value} = await reader.read())
          if (done) {
            this.file.flush()
            break
          }

          const buf: ArrayBufferLike & {fileStart?: number} = value!.buffer
          buf.fileStart = offset
          offset = this.file.appendBuffer(buf)
        }
      } catch (error) {
        reject(error)
      }
    })
  }
}

export {MP4Demuxer}
