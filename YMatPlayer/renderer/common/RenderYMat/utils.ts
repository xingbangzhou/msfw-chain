import axios from 'axios'
import {YMatPlayProps} from '../../../types'
import {autoUrlHttp} from '../../../utils/common'

export const loadYMat = async (file: ArrayBufferLike | string, mockJson?: YMatPlayProps) => {
  let url = ''
  let buffer: ArrayBufferLike | undefined = undefined
  if (typeof file === 'string') {
    url = file
    if (!url.includes('//')) {
      console.error('YMAT - load: ', 'invalid file url!')
      return
    }
    // 下载
    const response = await axios
      .get(autoUrlHttp(url), {
        responseType: 'arraybuffer',
      })
      .catch(err => {
        console.error('YMAT - init: ', `file download faild:\n ${err.message}`)
      })
    buffer = response?.data
  } else {
    buffer = file as ArrayBufferLike
  }
  if (!buffer) {
    console.error('YMAT - load: ', 'buffer is empty!')
    return
  }
  // 解析YmatFile
  const parser = require('./parser').default
  const res = await parser(buffer)
  if (!res) {
    console.error('YMAT - Parse file: ', 'parseBuffer faild！')
    return
  }
  // 取值
  const sourceMap = res.sourceMap as Record<string, Blob>
  let props: YMatPlayProps | undefined = undefined
  const jsonStr = res.jsonStr
  if (typeof jsonStr === 'string') {
    try {
      props = JSON.parse(jsonStr)
    } catch (err) {
      console.error('YMAT - Parse jsonStr: ', err)
      props = undefined
    }
  }

  if (!props) return

  return {
    sourceMap,
    playInfo: mockJson || props,
  }
}
