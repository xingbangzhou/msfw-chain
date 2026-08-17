const Base64Table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='

export function encodeBase64(str: string) {
  let output = ''
  let chr1, chr2, chr3, enc1, enc2, enc3, enc4
  let i = 0
  while (i < str.length) {
    chr1 = str.charCodeAt(i++)
    chr2 = str.charCodeAt(i++)
    chr3 = str.charCodeAt(i++)
    enc1 = chr1 >> 2
    enc2 = ((chr1 & 3) << 4) | (chr2 >> 4)
    enc3 = ((chr2 & 15) << 2) | (chr3 >> 6)
    enc4 = chr3 & 63
    if (isNaN(chr2)) {
      enc3 = enc4 = 64
    } else if (isNaN(chr3)) {
      enc4 = 64
    }
    output =
      output + Base64Table.charAt(enc1) + Base64Table.charAt(enc2) + Base64Table.charAt(enc3) + Base64Table.charAt(enc4)
  }
  return output
}

export function decodeBase64(str: string) {
  let output = ''
  let chr1, chr2, chr3
  let enc1, enc2, enc3, enc4
  let i = 0
  str = str.replace(/[^A-Za-z0-9\+\/\=]/g, '')
  while (i < str.length) {
    enc1 = Base64Table.indexOf(str.charAt(i++))
    enc2 = Base64Table.indexOf(str.charAt(i++))
    enc3 = Base64Table.indexOf(str.charAt(i++))
    enc4 = Base64Table.indexOf(str.charAt(i++))
    chr1 = (enc1 << 2) | (enc2 >> 4)
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2)
    chr3 = ((enc3 & 3) << 6) | enc4
    output = output + String.fromCharCode(chr1)
    if (enc3 != 64) {
      output = output + String.fromCharCode(chr2)
    }
    if (enc4 != 64) {
      output = output + String.fromCharCode(chr3)
    }
  }
  return output
}
