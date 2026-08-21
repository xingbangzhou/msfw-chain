import {inflate} from 'zlib.es'

const mimeTypeMap = ['json', 'image/webp', 'video/mp4', 'audio/mpeg']

function toLatin1String(buffer: Uint8Array): string {
  let result = ''
  for (let i = 0; i < buffer.length; i++) {
    result += String.fromCharCode(buffer[i])
  }

  return decodeURIComponent(escape(result))
}

function src2Blob(type: number, src: Uint8Array<ArrayBufferLike>) {
  const body = src instanceof ArrayBuffer ? new Uint8Array(src) : src
  return new Blob([body as any], {type: mimeTypeMap[type]})
}

export function parseLka(buffer: ArrayBufferLike) {
  try {
    const signU8 = new Uint8Array(buffer, 0, 4)
    const signArr = signU8.values()
    if (
      signArr.next().value !== 89 ||
      signArr.next().value !== 77 ||
      signArr.next().value !== 65 ||
      signArr.next().value !== 84
    ) {
      throw new Error('Read LKA file faild, invalid format!')
    }

    let jsonStr = ''
    const sourceMap: Record<number, Blob> = {}

    const dv = new DataView(buffer)
    let offset = 4
    const totalLength = buffer.byteLength

    while (offset < totalLength) {
      const header = dv.getUint8(offset)
      offset += 1
      // 取首位是否为1
      const hasSourceId = header & 0x80 ? true : false
      // 取剩余7位值
      const type = header & 0x7f
      let sourceId = 0

      if (hasSourceId) {
        sourceId = dv.getUint16(offset, true)
        offset += 2
      }
      const length = dv.getUint32(offset, true)
      offset += 4
      let sourceBody: ArrayBuffer | Uint8Array = new Uint8Array(buffer, offset, length)
      offset += length

      if (type === 0) {
        sourceBody = inflate(new Uint8Array(sourceBody))
        if (sourceBody) {
          const srouceU8 = new Uint8Array(sourceBody)
          jsonStr = toLatin1String(srouceU8)
        }
      }

      if (sourceId && sourceBody) {
        sourceMap[sourceId] = src2Blob(type, sourceBody)
      }
    }

    return {sourceMap, jsonStr}
  } catch (error) {
    console.error(error)
    return undefined
  }
}
