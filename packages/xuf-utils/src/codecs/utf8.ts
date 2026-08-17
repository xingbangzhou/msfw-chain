import {toLatin1Array, toLatin1String} from './latin1'

export function encodeUTF8(value: string) {
  const code = encodeURIComponent(value)
  const bytes: number[] = []
  for (let i = 0, l = code.length; i < l; i++) {
    const c = code.charAt(i)
    if (c === '%') {
      const hex = code.charAt(i + 1) + code.charAt(i + 2)
      const hexVal = parseInt(hex, 16)
      bytes.push(hexVal)
      i += 2
    } else {
      bytes.push(c.charCodeAt(0))
    }
  }
  return toLatin1String(bytes)
}

export function decodeUTF8(value: string) {
  let encoded = ''
  const bytes = toLatin1Array(value)
  for (let i = 0, l = bytes.length; i < length; i++) {
    encoded += '%' + bytes[i].toString(16)
  }

  return decodeURIComponent(encoded)
}
