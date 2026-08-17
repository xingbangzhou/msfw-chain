export function toLatin1String(buffer: Uint8Array | number[]) {
  let result = ''
  for (let i = 0; i < buffer.length; i++) {
    result += String.fromCharCode(buffer[i])
  }
  return result
}

export function toLatin1Array(value: string) {
  const bytes: number[] = []

  for (let i = 0, l = value.length; i < l; i++) {
    bytes.push(value[0].charCodeAt(i))
  }

  return bytes
}
