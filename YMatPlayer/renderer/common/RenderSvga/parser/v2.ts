import {Root} from 'protobufjs'
import SVGA_PROTO from './svga-proto'
import {Movie, RawImages} from '../types'
import {getSvgaInfo} from '../utils'
import {inflate} from 'zlib.es'
import {loadImage} from '../../../../utils/common'

const proto = Root.fromJSON(SVGA_PROTO)
const message = proto.lookupType('com.opensource.svga.MovieEntity')

const parseInfo = async (data: ArrayBuffer) => {
  const inflateData: Uint8Array = inflate(new Uint8Array(data))
  const movie = message.decode(inflateData) as unknown as Movie
  const images: RawImages = {}
  const movieImages = movie.images
  for (const key in movieImages) {
    if (key.startsWith('audio')) continue
    try {
      const image = movieImages[key]
      const rawImage = await loadImage(new Blob([image as any]))
      if (!rawImage) throw new Error('load image failed')
      images[key] = rawImage
    } catch (err) {
      console.error(key, err)
    }
  }

  movie.version = '2.0'
  const params = movie.params
  params.viewBoxWidth = params.viewBoxWidth || 0.0
  params.viewBoxHeight = params.viewBoxHeight || 0.0
  params.fps = params.fps || 20
  params.frames = params.frames || 0

  return getSvgaInfo(movie, images)
}

export default parseInfo
