import {loadImage} from '../../../../utils/common'
import {Movie, RawImages} from '../types'
import {getSvgaInfo} from '../utils'
import './zip'

const Uint8ToString = function (u8a: any) {
  const CHUNK_SZ = 0x8000
  const c = []
  for (let i = 0; i < u8a.length; i += CHUNK_SZ) {
    c.push(String.fromCharCode.apply(null, u8a.subarray(i, i + CHUNK_SZ)))
  }
  return c.join('')
}

const parseInfo = async (data: ArrayBuffer) => {
  const files = (self as any).Zip.inflate(new Uint8Array(data)).files
  const movie = JSON.parse(Uint8ToString(files['movie.spec'].inflate())) as unknown as Movie

  const images: RawImages = {}
  for (let key in movie.images) {
    if (key.startsWith('audio')) continue
    try {
      key = key.replace('.matte', '')
      const image = files[key + '.png'].inflate()
      const rawImage = await loadImage(new Blob([image as any]))
      if (!rawImage) throw new Error('load image failed')
      images[key] = rawImage
    } catch (err) {
      console.error(key, err)
    }
  }
  const params = (movie as any).movie
  movie.version = '1.0'
  movie.params = {
    fps: parseInt(params.fps) || 20,
    frames: parseInt(params.frames) || 0,
    viewBoxWidth: parseFloat(params.viewBox.width) || 0.0,
    viewBoxHeight: parseFloat(params.viewBox.height) || 0.0,
  }
  return getSvgaInfo(movie, images)
}

export default parseInfo
