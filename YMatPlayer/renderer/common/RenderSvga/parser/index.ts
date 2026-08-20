import {SvgaPlayInfo} from '../types'

async function download(url: string | Blob): Promise<ArrayBuffer> {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    if (typeof url === 'string') {
      fetch(url)
        .then(response => {
          return response.arrayBuffer()
        })
        .then(data => {
          resolve(data)
        })
        .catch(err => {
          reject(err)
        })
    } else {
      url
        .arrayBuffer()
        .then(data => {
          resolve(data)
        })
        .catch(err => {
          reject(err)
        })
    }
  })
}

const getVersion = (data: ArrayBuffer): number => {
  const dataHeader = new Uint8Array(data, 0, 4)
  if (dataHeader[0] === 80 && dataHeader[1] === 75 && dataHeader[2] === 3 && dataHeader[3] === 4) {
    return 1
  }
  return 2
}

export const parseSvga = async (url: string | Blob): Promise<SvgaPlayInfo> => {
  const data = await download(url)
  const dataHeader = new Uint8Array(data, 0, 4)
  const version = getVersion(dataHeader)

  if (version === 1) {
    const parseInfo = require('./v1').default
    const playInfo = await parseInfo(data)
    return playInfo
  } else {
    const parseInfo = require('./v2').default
    const playInfo = await parseInfo(data)
    return playInfo
  }
}
