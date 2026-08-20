import MP4Demuxer, {MP4Config} from './MP4Demuxer'

export interface DemuxHandles {
  onConfig: (config: MP4Config) => void
  onChunk: (chunk: any) => void
  onError: (error: any) => void
}

class DemuxHelper {
  private demuxerList: MP4Demuxer[] = []
  private mapDemuxHandles: WeakMap<MP4Demuxer, DemuxHandles[]> = new WeakMap()

  demux(url: string | Blob, handles: DemuxHandles) {
    const demuxer = this.demuxerList.find(el => el.url === url)
    if (demuxer) {
      const list = this.mapDemuxHandles.get(demuxer) as DemuxHandles[]
      if (!list.includes(handles)) {
        list.push(handles)

        demuxer.ensure().then(config => {
          handles.onConfig(config)

          const chunkList = demuxer.chunkList
          chunkList.forEach(el => handles.onChunk(el))
        })
      }
      return
    }

    const newDemuxer = new MP4Demuxer(url, {
      onChunk: chunk => {
        this.onChunk(newDemuxer, chunk)
      },
      onError: error => {
        this.onError(newDemuxer, error)
      },
    })

    this.demuxerList.push(newDemuxer)
    this.mapDemuxHandles.set(newDemuxer, [handles])

    newDemuxer.ensure().then(config => {
      handles.onConfig(config)
      newDemuxer.start()
    })
  }

  remove(uri: string | Blob, handles: DemuxHandles) {
    const demuxer = this.demuxerList.find(el => el.url === uri)
    if (demuxer) {
      const mapDemuxHandles = this.mapDemuxHandles
      const list = mapDemuxHandles.get(demuxer)?.filter(el => el !== handles)
      if (list?.length) {
        mapDemuxHandles.set(demuxer, list)
      } else {
        demuxer.destroy()
        this.demuxerList = this.demuxerList.filter(el => el !== demuxer)
        mapDemuxHandles.delete(demuxer)
      }
    }
  }

  private onChunk(demuxer: MP4Demuxer, chunk: any) {
    const list = this.mapDemuxHandles.get(demuxer)

    list?.forEach(el => el.onChunk(chunk))
  }

  private onError(demuxer: MP4Demuxer, error: any) {
    const list = this.mapDemuxHandles.get(demuxer)

    list?.forEach(el => el.onError(error))
  }
}

export const demuxHelper = new DemuxHelper()
